/**
 * The community chest — a ledger, not a wallet.
 *
 * What a community earns belongs to the community and goes to a shared
 * project the community chooses. Members propose projects, a steward calls
 * the vote once there are enough, and the same ballot machinery that picks a
 * week's topic picks the project. The chosen project is recorded as pending
 * verification; no money moves anywhere in this module.
 *
 * Proposals carry no author, for the same reason suggestions don't: people
 * should vote on the project, not on who asked for it.
 */

import {
  CHEST_VOTE_DAYS,
  MAX_CHEST_OPTIONS,
  MAX_OPEN_CHEST_PROPOSALS,
  MIN_CHEST_PROPOSALS,
  type BallotView,
  type ChestProposalInput,
  type ChestProposalView,
  type ChestView,
} from "@kinextion/shared";
import { DAY_MS } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import { isActive, type CommunityDeps } from "./service.js";
import type { BallotRecord, ChestProposalRecord } from "./store.js";
import { getBallot } from "./topics.js";

async function requireMember(deps: CommunityDeps, userId: string, communityId: string) {
  const community = await deps.store.findCommunity(communityId);
  const membership = community ? await deps.store.findMembership(communityId, userId) : null;
  if (!community || !isActive(membership)) throw notFound("Community");
  return { community, membership };
}

function proposalView(p: ChestProposalRecord, userId: string): ChestProposalView {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    isMine: p.userId === userId,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function getChest(deps: CommunityDeps, userId: string, communityId: string): Promise<ChestView> {
  const { community } = await requireMember(deps, userId, communityId);
  const [balanceCents, entries, proposals, latest] = await Promise.all([
    deps.store.chestBalance(communityId),
    deps.store.listChestEntries(communityId, 50),
    deps.store.listChestProposals(communityId, ["proposed", "on_ballot", "chosen", "not_chosen"]),
    deps.store.latestBallot(communityId, "chest_project"),
  ]);
  return {
    community: { id: community.id, name: community.name, slug: community.slug },
    balanceCents,
    currency: "USD",
    entries: entries.map((e) => ({ kind: e.kind, cents: e.cents, memo: e.memo, createdAt: e.createdAt.toISOString() })),
    proposals: proposals.map((p) => proposalView(p, userId)),
    openBallotId: latest?.status === "open" ? latest.id : null,
  };
}

export async function proposeProject(
  deps: CommunityDeps,
  userId: string,
  communityId: string,
  input: ChestProposalInput
): Promise<ChestProposalView> {
  const { community } = await requireMember(deps, userId, communityId);
  if (community.status !== "active") throw new CommunityError(409, "NOT_ACTIVE", "This community isn't active.");

  const open = await deps.store.listChestProposals(communityId, ["proposed", "on_ballot"]);
  if (open.filter((p) => p.userId === userId).length >= MAX_OPEN_CHEST_PROPOSALS) {
    throw new CommunityError(
      409,
      "PROPOSAL_LIMIT",
      `You already have ${MAX_OPEN_CHEST_PROPOSALS} projects waiting for a vote.`
    );
  }

  const proposal = await deps.store.createChestProposal({
    communityId,
    userId,
    title: input.title,
    description: input.description || null,
    at: deps.clock.now(),
  });
  return proposalView(proposal, userId);
}

/** A steward puts the waiting proposals to the community. */
export async function callChestVote(deps: CommunityDeps, userId: string, communityId: string): Promise<BallotView> {
  const now = deps.clock.now();
  const { community, membership } = await requireMember(deps, userId, communityId);
  if (membership.role !== "steward") throw new CommunityError(403, "NOT_STEWARD", "Only a steward can call a chest vote.");
  if (community.status !== "active") throw new CommunityError(409, "NOT_ACTIVE", "This community isn't active.");

  const latest = await deps.store.latestBallot(communityId, "chest_project");
  if (latest?.status === "open") throw new CommunityError(409, "CHEST_VOTE_OPEN", "There's already a chest vote open.");

  // Oldest first, so proposals that have waited longest are heard first.
  const waiting = (await deps.store.listChestProposals(communityId, ["proposed"])).reverse();
  if (waiting.length < MIN_CHEST_PROPOSALS) {
    throw new CommunityError(
      409,
      "NOT_ENOUGH_PROPOSALS",
      `A chest vote needs at least ${MIN_CHEST_PROPOSALS} proposed projects.`
    );
  }
  const onBallot = waiting.slice(0, MAX_CHEST_OPTIONS);

  const ballot = await deps.store.transaction(async (tx) => {
    const created = await tx.createBallot({
      communityId,
      cycleId: null,
      kind: "chest_project",
      opensAt: now,
      closesAt: new Date(now.getTime() + CHEST_VOTE_DAYS * DAY_MS),
      options: onBallot.map((p) => ({ text: p.title, rationale: p.description, theme: null })),
      at: now,
    });
    const options = await tx.listBallotOptions(created.id);
    await tx.attachProposalsToBallot(
      onBallot.map((p, i) => ({ proposalId: p.id, optionId: options[i].id })),
      created.id
    );
    return created;
  });

  return getBallot(deps, userId, ballot.id);
}

/**
 * Apply a decided chest ballot: the winning project is chosen and recorded in
 * the ledger as pending verification, at zero cents — a decision, not a payment.
 */
export async function applyChestDecision(
  deps: CommunityDeps,
  tx: CommunityDeps["store"],
  ballot: BallotRecord,
  winnerOptionId: string | null
): Promise<void> {
  const chosen = await tx.resolveChestBallot(ballot.id, winnerOptionId);
  if (chosen) {
    await tx.createChestEntry({
      communityId: ballot.communityId,
      cents: 0,
      kind: "allocation",
      memo: `Chosen by the community: ${chosen.title} — pending verification`,
      at: deps.clock.now(),
    });
  }
}
