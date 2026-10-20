/**
 * The week: cycles, and where you sit.
 *
 * Every active community gets a cycle per ISO week, all on one global
 * schedule in COMMUNITY_TIME_ZONE. A cycle is created while its gathering can
 * still happen — a community that forms on a Saturday joins the week after
 * next rather than opening a room with no question in it.
 *
 * Stage is never stored. It's `stageFor(boundaries, now)` every time, so a
 * late job can't leave a room showing the wrong state.
 */

import {
  COMMUNITY_TIME_ZONE,
  cycleBoundaries,
  isWeekKey,
  shiftWeekKey,
  stageFor,
  weekKeyFor,
  type ActiveChoiceView,
  type CycleView,
  type MyWeekView,
  type WeekView,
} from "@kinextion/shared";
import { CommunityError, notFound } from "./errors.js";
import { isActive, type CommunityDeps } from "./service.js";
import type { ActiveChoiceRecord, CycleRecord } from "./store.js";

/** How far ahead cycles are created. Two weeks covers every gathering that can be open. */
const WEEKS_AHEAD = 2;

/**
 * Make sure each community has every cycle whose gathering hasn't closed yet.
 * Idempotent: existing cycles are never modified.
 */
export async function ensureCycles(deps: CommunityDeps, communityIds?: string[]): Promise<number> {
  const now = deps.clock.now();
  const ids = communityIds ?? (await deps.store.listActiveCommunityIds());
  const current = weekKeyFor(now);
  let created = 0;

  for (let offset = 0; offset <= WEEKS_AHEAD; offset++) {
    const boundaries = cycleBoundaries(shiftWeekKey(current, offset));
    if (now >= boundaries.votingOpensAt) continue;

    const existing = new Set(
      (await deps.store.listCyclesFor(ids, boundaries.weekKey)).map((c) => c.communityId)
    );
    for (const communityId of ids) {
      if (existing.has(communityId)) continue;
      await deps.store.ensureCycle({ communityId, ...boundaries, at: now });
      created++;
    }
  }
  return created;
}

function choiceView(choice: ActiveChoiceRecord | null): ActiveChoiceView | null {
  return choice ? { communityId: choice.communityId, locked: choice.lockedAt !== null } : null;
}

/**
 * Build the views for a set of cycles, as `userId` sees them. Later phases
 * fill `topic`, `ballotId` and `you` from their own tables; everything a
 * cycle view shows is assembled here so there's one place to audit it.
 */
export async function cycleViews(
  deps: CommunityDeps,
  userId: string,
  cycles: CycleRecord[]
): Promise<CycleView[]> {
  const now = deps.clock.now();
  const views: CycleView[] = [];
  for (const cycle of cycles) {
    const community = await deps.store.findCommunity(cycle.communityId);
    if (!community) continue;
    const stage = stageFor(cycle, now);
    const [topic, ballot, mySuggestions] = await Promise.all([
      deps.store.findTopicForCycle(cycle.id),
      deps.store.findCycleBallot(cycle.id, "topic"),
      deps.store.listMySuggestions(cycle.id, userId),
    ]);
    const myVote = ballot ? await deps.store.findBallotVote(ballot.id, userId) : null;
    const myResponse = topic ? await deps.store.findResponseFor(topic.id, userId) : null;
    const showTopic = stage === "open" || stage === "closed" || stage === "settled";
    views.push({
      id: cycle.id,
      weekKey: cycle.weekKey,
      stage,
      gatheringOpensAt: cycle.gatheringOpensAt.toISOString(),
      votingOpensAt: cycle.votingOpensAt.toISOString(),
      opensAt: cycle.opensAt.toISOString(),
      closesAt: cycle.closesAt.toISOString(),
      community: { id: community.id, name: community.name, slug: community.slug },
      topic: showTopic && topic ? { id: topic.id, text: topic.text } : null,
      ballotId: ballot?.id ?? null,
      you: {
        suggestions: mySuggestions.length,
        voted: myVote !== null,
        response: myResponse?.status ?? "none",
      },
    });
  }
  return views;
}

async function weekView(
  deps: CommunityDeps,
  userId: string,
  weekKey: string,
  communityIds: string[]
): Promise<WeekView> {
  const [choice, cycles] = await Promise.all([
    deps.store.findActiveChoice(userId, weekKey),
    deps.store.listCyclesFor(communityIds, weekKey),
  ]);
  return {
    weekKey,
    choice: choiceView(choice),
    cycles: await cycleViews(deps, userId, cycles),
  };
}

/** "Your week": this week's rooms and next week's, across every community you're in. */
export async function getMyWeek(deps: CommunityDeps, userId: string): Promise<MyWeekView> {
  const now = deps.clock.now();
  const mine = await deps.store.listMyCommunities(userId);
  const activeIds = mine.filter((r) => r.community.status === "active").map((r) => r.community.id);
  await ensureCycles(deps, activeIds);

  const current = weekKeyFor(now);
  return {
    now: now.toISOString(),
    timeZone: COMMUNITY_TIME_ZONE,
    current: await weekView(deps, userId, current, activeIds),
    next: await weekView(deps, userId, shiftWeekKey(current, 1), activeIds),
  };
}

/**
 * Choose where to sit for a week — one community, or none.
 *
 * Changeable until you speak. Choosing none carries no penalty of any kind:
 * nothing is recorded against you, and nothing reminds you.
 */
export async function chooseActiveCommunity(
  deps: CommunityDeps,
  userId: string,
  weekKey: string,
  communityId: string | null
): Promise<ActiveChoiceView> {
  const now = deps.clock.now();
  if (!isWeekKey(weekKey)) throw new CommunityError(400, "INVALID", "Not a valid week");

  const current = weekKeyFor(now);
  if (weekKey !== current && weekKey !== shiftWeekKey(current, 1)) {
    throw new CommunityError(400, "WEEK_OUT_OF_RANGE", "You can choose for this week or next week.");
  }
  if (now >= cycleBoundaries(weekKey).closesAt) {
    throw new CommunityError(409, "WEEK_CLOSED", "This week's rooms have closed.");
  }

  if (communityId !== null) {
    const community = await deps.store.findCommunity(communityId);
    const membership = community ? await deps.store.findMembership(communityId, userId) : null;
    if (!community || !isActive(membership)) throw notFound("Community");
    if (community.status !== "active") {
      throw new CommunityError(409, "NOT_ACTIVE", "This community isn't active yet.");
    }
    await ensureCycles(deps, [communityId]);
    if (!(await deps.store.findCycleFor(communityId, weekKey))) {
      throw new CommunityError(
        409,
        "NO_ROOM_THIS_WEEK",
        "This community doesn't have a room that week — it formed after that week's topic was chosen."
      );
    }
  }

  const choice = await deps.store.setActiveChoice({ userId, weekKey, communityId, at: now });
  if (!choice) {
    throw new CommunityError(
      409,
      "CHOICE_LOCKED",
      "You've already spoken this week, so your community for the week is set."
    );
  }
  return choiceView(choice)!;
}
