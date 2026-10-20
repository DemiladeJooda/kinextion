/**
 * Suggest → synthesize → vote → decide.
 *
 * Members privately tell Kairo what's been on their minds during gathering.
 * When voting opens, the facilitator turns those into four options. When the
 * room opens, the most-voted option becomes the week's topic. The same ballot
 * machinery decides whether to close a community, and — in phase 10 — what a
 * chest is for.
 *
 * Nothing here ever returns a count. A topic ballot reveals what won, never by
 * how much; a suggestion is never shown with its author.
 */

import {
  CLOSURE_COOLDOWN_DAYS,
  CLOSURE_VOTE_DAYS,
  MAX_SUGGESTIONS_PER_CYCLE,
  RECENT_TOPIC_WEEKS,
  decideClosure,
  stageFor,
  tallyBallot,
  topicKeyFor,
  type BallotView,
  type MySuggestionsView,
} from "@kinextion/shared";
import { synthesizeTopics } from "@kinextion/ai-core";
import { applyChestDecision } from "./chest.js";
import { DAY_MS } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import { isActive, type CommunityDeps } from "./service.js";
import type { BallotRecord, CycleRecord } from "./store.js";

async function requireCycleMember(deps: CommunityDeps, userId: string, cycleId: string) {
  const cycle = await deps.store.findCycle(cycleId);
  const membership = cycle ? await deps.store.findMembership(cycle.communityId, userId) : null;
  if (!cycle || !isActive(membership)) throw notFound("Week");
  return cycle;
}

// ─── Suggestions ─────────────────────────────────────────────────

export async function submitSuggestion(
  deps: CommunityDeps,
  userId: string,
  cycleId: string,
  text: string
): Promise<MySuggestionsView> {
  const now = deps.clock.now();
  const cycle = await requireCycleMember(deps, userId, cycleId);
  const stage = stageFor(cycle, now);
  if (stage !== "gathering") {
    throw new CommunityError(
      409,
      "NOT_GATHERING",
      stage === "scheduled"
        ? "Suggestions for this week haven't opened yet."
        : "Suggestions for this week have closed."
    );
  }

  const mine = await deps.store.listMySuggestions(cycleId, userId);
  if (mine.length >= MAX_SUGGESTIONS_PER_CYCLE) {
    throw new CommunityError(
      409,
      "SUGGESTION_LIMIT",
      `You've shared ${MAX_SUGGESTIONS_PER_CYCLE} thoughts this week — that's plenty for Kairo to work with.`
    );
  }

  await deps.store.createSuggestion({ cycleId, userId, text, at: now });
  return mySuggestions(deps, userId, cycleId);
}

export async function mySuggestions(
  deps: CommunityDeps,
  userId: string,
  cycleId: string
): Promise<MySuggestionsView> {
  await requireCycleMember(deps, userId, cycleId);
  const mine = await deps.store.listMySuggestions(cycleId, userId);
  return {
    suggestions: mine.map((s) => ({ text: s.text, createdAt: s.createdAt.toISOString() })),
    remaining: Math.max(0, MAX_SUGGESTIONS_PER_CYCLE - mine.length),
  };
}

// ─── Synthesis ───────────────────────────────────────────────────

/**
 * Build a cycle's topic ballot. The model call happens outside any
 * transaction; the write is claimed with `markSynthesized`, so two
 * overlapping runs can both think, but only one ballot is ever created.
 */
export async function synthesizeCycle(
  deps: CommunityDeps,
  cycle: CycleRecord
): Promise<"created" | "skipped"> {
  const now = deps.clock.now();
  const community = await deps.store.findCommunity(cycle.communityId);
  if (!community || community.status !== "active") return "skipped";

  const [suggestions, recent] = await Promise.all([
    deps.store.listSuggestionTexts(cycle.id),
    deps.store.listRecentTopics(cycle.communityId, cycle.weekKey, RECENT_TOPIC_WEEKS),
  ]);

  // Order carries no information about who said what.
  const shuffled = [...suggestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(deps.rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const result = await synthesizeTopics({
    communityName: community.name,
    suggestions: shuffled,
    recentTopics: recent.map((t) => ({ text: t.text, theme: t.theme })),
    generate: deps.generateTopics,
    rng: deps.rng,
  });

  return deps.store.transaction(async (tx) => {
    if (!(await tx.markSynthesized(cycle.id, now))) return "skipped";
    await tx.createBallot({
      communityId: cycle.communityId,
      cycleId: cycle.id,
      kind: "topic",
      opensAt: cycle.votingOpensAt,
      closesAt: cycle.opensAt,
      options: result.options.map((o) => ({ text: o.text, rationale: o.rationale, theme: o.theme })),
      at: now,
    });
    return "created";
  });
}

export async function synthesizeDueCycles(deps: CommunityDeps, onError?: (message: string) => void): Promise<number> {
  let created = 0;
  for (const cycle of await deps.store.listCyclesAwaitingSynthesis(deps.clock.now())) {
    try {
      if ((await synthesizeCycle(deps, cycle)) === "created") created++;
    } catch (err) {
      if (!onError) throw err;
      onError(`cycle ${cycle.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return created;
}

// ─── Ballots ─────────────────────────────────────────────────────

async function requireBallotMember(deps: CommunityDeps, userId: string, ballotId: string) {
  const ballot = await deps.store.findBallot(ballotId);
  const membership = ballot ? await deps.store.findMembership(ballot.communityId, userId) : null;
  if (!ballot || !isActive(membership)) throw notFound("Ballot");
  return ballot;
}

async function ballotView(deps: CommunityDeps, userId: string, ballot: BallotRecord): Promise<BallotView> {
  const [options, myVote] = await Promise.all([
    deps.store.listBallotOptions(ballot.id),
    deps.store.findBallotVote(ballot.id, userId),
  ]);
  return {
    id: ballot.id,
    kind: ballot.kind,
    status: ballot.status,
    opensAt: ballot.opensAt.toISOString(),
    closesAt: ballot.closesAt.toISOString(),
    options: options.map((o) => ({ id: o.id, text: o.text, rationale: o.rationale })),
    myVote,
    decidedOptionId: ballot.decidedOptionId,
  };
}

export async function getBallot(deps: CommunityDeps, userId: string, ballotId: string): Promise<BallotView> {
  return ballotView(deps, userId, await requireBallotMember(deps, userId, ballotId));
}

export async function listCommunityBallots(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<BallotView[]> {
  const membership = await deps.store.findMembership(communityId, userId);
  if (!isActive(membership)) throw notFound("Community");
  const ballots = await deps.store.listCommunityBallots(communityId, ["open", "decided"]);
  return Promise.all(ballots.slice(0, 10).map((b) => ballotView(deps, userId, b)));
}

/** Vote, or move your vote, while the ballot is open. */
export async function voteOnBallot(
  deps: CommunityDeps,
  userId: string,
  ballotId: string,
  optionId: string
): Promise<{ recorded: true }> {
  const now = deps.clock.now();
  const ballot = await requireBallotMember(deps, userId, ballotId);
  if (ballot.status !== "open" || now >= ballot.closesAt) {
    throw new CommunityError(409, "BALLOT_CLOSED", "This vote has closed.");
  }
  if (now < ballot.opensAt) {
    throw new CommunityError(409, "BALLOT_NOT_OPEN", "This vote hasn't opened yet.");
  }
  const options = await deps.store.listBallotOptions(ballotId);
  if (!options.some((o) => o.id === optionId)) {
    throw new CommunityError(400, "INVALID", "That isn't one of the options.");
  }
  await deps.store.castBallotVote({ ballotId, optionId, userId, at: now });
  return { recorded: true };
}

/**
 * Propose closing a community. Opens a week-long vote that needs half the
 * community to take part and two thirds of them to agree. A failed vote can't
 * be re-proposed for a month.
 */
export async function proposeClosure(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<BallotView> {
  const now = deps.clock.now();
  const community = await deps.store.findCommunity(communityId);
  const membership = community ? await deps.store.findMembership(communityId, userId) : null;
  if (!community || !isActive(membership)) throw notFound("Community");
  if (community.status !== "active") {
    throw new CommunityError(409, "NOT_ACTIVE", "Only an active community can vote to close.");
  }

  const latest = await deps.store.latestBallot(communityId, "closure");
  if (latest?.status === "open") {
    throw new CommunityError(409, "CLOSURE_OPEN", "There's already a vote on closing this community.");
  }
  if (latest && now.getTime() < latest.closesAt.getTime() + CLOSURE_COOLDOWN_DAYS * DAY_MS) {
    throw new CommunityError(
      409,
      "CLOSURE_COOLDOWN",
      "This community voted on closing recently. It can be proposed again in a few weeks."
    );
  }

  const ballot = await deps.store.createBallot({
    communityId,
    cycleId: null,
    kind: "closure",
    opensAt: now,
    closesAt: new Date(now.getTime() + CLOSURE_VOTE_DAYS * DAY_MS),
    options: [
      { text: "Close this community", rationale: null, theme: null },
      { text: "Keep it going", rationale: null, theme: null },
    ],
    at: now,
  });
  return ballotView(deps, userId, ballot);
}

async function decideBallot(deps: CommunityDeps, ballot: BallotRecord): Promise<void> {
  const now = deps.clock.now();
  const [options, votes] = await Promise.all([
    deps.store.listBallotOptions(ballot.id),
    deps.store.listBallotVoteOptionIds(ballot.id),
  ]);
  const { winnerId, counts } = tallyBallot(options, votes.map((optionId) => ({ optionId })));

  await deps.store.transaction(async (tx) => {
    if (ballot.kind === "topic") {
      const winner = options.find((o) => o.id === winnerId);
      if (!(await tx.decideBallot(ballot.id, winnerId, now))) return;
      if (winner && ballot.cycleId) {
        await tx.createTopic({
          cycleId: ballot.cycleId,
          text: winner.text,
          topicKey: topicKeyFor(winner.text),
          theme: winner.theme,
          at: now,
        });
      }
      return;
    }

    if (ballot.kind === "closure") {
      const [close, keep] = options;
      const outcome = decideClosure({
        closeVotes: counts.get(close.id) ?? 0,
        keepVotes: counts.get(keep.id) ?? 0,
        activeMembers: await tx.countActiveMembers(ballot.communityId),
      });
      if (!(await tx.decideBallot(ballot.id, outcome === "close" ? close.id : keep.id, now))) return;
      if (outcome === "close") {
        await tx.transitionCommunity(ballot.communityId, "active", "archived", now);
      }
      return;
    }

    if (ballot.kind === "chest_project") {
      if (!(await tx.decideBallot(ballot.id, winnerId, now))) return;
      await applyChestDecision(deps, tx, ballot, winnerId);
    }
  });
}

export async function decideDueBallots(
  deps: CommunityDeps,
  kinds: BallotRecord["kind"][] = ["topic", "closure"],
  onError?: (message: string) => void
): Promise<number> {
  let decided = 0;
  for (const ballot of await deps.store.listBallotsDue(deps.clock.now())) {
    if (!kinds.includes(ballot.kind)) continue;
    try {
      await decideBallot(deps, ballot);
      decided++;
    } catch (err) {
      if (!onError) throw err;
      onError(`ballot ${ballot.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return decided;
}
