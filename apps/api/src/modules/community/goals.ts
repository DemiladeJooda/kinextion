/**
 * Community goals — a shared target the whole community works toward
 * (weeks completed together), with a fixed reward on the other side.
 *
 * Deliberately not the chest: that's members proposing and voting on a
 * project to fund. This is simpler on purpose — one goal, one reward,
 * progress counted from a number the product already produces (closed
 * weeks), not a new thing members have to report. Fulfillment (actually
 * granting the class or membership month) happens by hand once achieved —
 * nothing here issues a real discount or payment.
 */

import { prisma } from "@kinextion/database";
import type { CommunityGoalInput, CommunityGoalView } from "@kinextion/shared";
import { CommunityError, notFound } from "./errors.js";
import { isActive, type CommunityDeps } from "./service.js";

async function requireMember(deps: CommunityDeps, userId: string, communityId: string) {
  const community = await deps.store.findCommunity(communityId);
  const membership = community ? await deps.store.findMembership(communityId, userId) : null;
  if (!community || !isActive(membership)) throw notFound("Community");
  return { community, membership: membership! };
}

/** Weeks closed since the goal was set — via the store, so this is the same
 *  history the community's own page reads, and the same path tests exercise. */
async function progressFor(deps: CommunityDeps, communityId: string, since: Date): Promise<number> {
  const results = await deps.store.listCommunityResults(communityId, 500);
  return results.filter((r) => r.closedAt >= since).length;
}

function view(goal: { id: string; title: string; targetWeeks: number; rewardLabel: string; achievedAt: Date | null; createdAt: Date }, progressWeeks: number): CommunityGoalView {
  return {
    id: goal.id,
    title: goal.title,
    targetWeeks: goal.targetWeeks,
    progressWeeks,
    rewardLabel: goal.rewardLabel,
    achievedAt: goal.achievedAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
  };
}

/** The community's current goal — the most recently set one — or null if none yet. */
export async function getCommunityGoal(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<CommunityGoalView | null> {
  await requireMember(deps, userId, communityId);

  const goal = await prisma.communityGoal.findFirst({
    where: { communityId },
    orderBy: { createdAt: "desc" },
  });
  if (!goal) return null;

  const progressWeeks = await progressFor(deps, communityId, goal.createdAt);

  if (!goal.achievedAt && progressWeeks >= goal.targetWeeks) {
    const updated = await prisma.communityGoal.update({
      where: { id: goal.id },
      data: { achievedAt: deps.clock.now() },
    });
    return view(updated, progressWeeks);
  }

  return view(goal, progressWeeks);
}

/** A steward sets a new goal. The previous one (if any) just stops being read. */
export async function setCommunityGoal(
  deps: CommunityDeps,
  userId: string,
  communityId: string,
  input: CommunityGoalInput
): Promise<CommunityGoalView> {
  const { membership } = await requireMember(deps, userId, communityId);
  if (membership.role !== "steward") {
    throw new CommunityError(403, "NOT_STEWARD", "Only a steward can set a community goal.");
  }

  // createdAt explicit, not the schema default — this module's progress
  // count has to agree with the same injectable clock as the rest of
  // community/*, or a test (or a real clock skew) could compare across times
  // that were never simultaneous.
  const goal = await prisma.communityGoal.create({
    data: {
      communityId,
      title: input.title,
      targetWeeks: input.targetWeeks,
      rewardLabel: input.rewardLabel,
      createdAt: deps.clock.now(),
    },
  });

  return view(goal, 0);
}
