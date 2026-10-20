/**
 * Close, reveal, forget.
 *
 * When a week's room closes, three things happen, in this order and never the
 * other way round:
 *
 *   1. Snapshot — where the room landed, aggregated across every circle,
 *      written as a CycleResult that holds no individual. The only permanent
 *      record of the week.
 *   2. Publish — responses their speakers marked public get thirty days on
 *      Discover.
 *   3. Forget — every other recording is scheduled for deletion, those
 *      responses are removed, and every reaction and comment goes with them.
 *
 * The database steps run in one transaction, so a crash leaves the week
 * unsettled rather than half-settled; the next pass simply does it again. The
 * stored files are deleted by the media purge step, which retries until the
 * object is really gone. Deleting media before the snapshot is committed would
 * lose a community's history permanently — that ordering is the whole module.
 */

import {
  PUBLIC_TTL_DAYS,
  REVEAL_HEADLINE,
  revealPercentages,
  type CommunityHistoryView,
  type CycleResultView,
} from "@kinextion/shared";
import { DAY_MS } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import { requireTopicMember } from "./responses.js";
import { isActive, type CommunityDeps } from "./service.js";
import type { CycleRecord, CycleResultRecord } from "./store.js";

export async function settleCycle(deps: CommunityDeps, cycle: CycleRecord): Promise<"settled" | "skipped"> {
  const now = deps.clock.now();
  if (cycle.settledAt || now < cycle.closesAt) return "skipped";

  return deps.store.transaction(async (tx) => {
    const topic = await tx.findTopicForCycle(cycle.id);
    if (!topic) {
      return (await tx.markSettled(cycle.id, now)) ? "settled" : "skipped";
    }

    const responses = await tx.listTopicResponses(topic.id);
    const submitted = responses.filter((r) => r.status === "submitted");

    // 1. Snapshot.
    if (submitted.length > 0) {
      const counts = await tx.countTopicReactions(topic.id);
      const comments = await tx.countTopicComments(topic.id);
      await tx.upsertCycleResult({
        communityId: cycle.communityId,
        cycleId: cycle.id,
        weekKey: cycle.weekKey,
        topicKey: topic.topicKey,
        topicText: topic.text,
        closedAt: cycle.closesAt,
        ...revealPercentages(counts),
        reactionCount: counts.agree + counts.mixed + counts.disagree,
        participantCount: submitted.length,
        responseCount: submitted.length,
        commentCount: comments,
        at: now,
      });
    }

    // 2. Publish.
    const published = submitted.filter((r) => r.visibility === "public_after_close");
    const expiresAt = new Date(cycle.closesAt.getTime() + PUBLIC_TTL_DAYS * DAY_MS);
    await tx.publishResponses(
      published.map((r) => r.id),
      cycle.closesAt,
      expiresAt
    );
    await tx.setMediaPurgeAfter(
      published.flatMap((r) => (r.mediaId ? [r.mediaId] : [])),
      expiresAt
    );

    // 3. Forget.
    await tx.deleteTopicConversation(topic.id);
    const forgotten = responses.filter((r) => !published.includes(r));
    await tx.setMediaPurgeAfter(
      forgotten.flatMap((r) => (r.mediaId ? [r.mediaId] : [])),
      now
    );
    await tx.deleteResponses(forgotten.map((r) => r.id));

    return (await tx.markSettled(cycle.id, now)) ? "settled" : "skipped";
  });
}

export async function settleDueCycles(deps: CommunityDeps, onError?: (message: string) => void): Promise<number> {
  let settled = 0;
  for (const cycle of await deps.store.listCyclesToSettle(deps.clock.now())) {
    try {
      if ((await settleCycle(deps, cycle)) === "settled") settled++;
    } catch (err) {
      if (!onError) throw err;
      onError(`cycle ${cycle.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return settled;
}

/**
 * Public responses leave Discover after thirty days. Their recordings were
 * already scheduled for that moment at settlement; this removes the rows.
 */
export async function expirePublicResponses(deps: CommunityDeps): Promise<number> {
  const expired = await deps.store.listExpiredPublicResponses(deps.clock.now(), 500);
  await deps.store.transaction(async (tx) => {
    await tx.setMediaPurgeAfter(
      expired.flatMap((r) => (r.mediaId ? [r.mediaId] : [])),
      deps.clock.now()
    );
    await tx.deleteResponses(expired.map((r) => r.id));
  });
  return expired.length;
}

export function resultView(result: CycleResultRecord): CycleResultView {
  return {
    weekKey: result.weekKey,
    closedAt: result.closedAt.toISOString(),
    topic: { text: result.topicText, topicKey: result.topicKey },
    headline: REVEAL_HEADLINE,
    agreePct: result.agreePct,
    mixedPct: result.mixedPct,
    disagreePct: result.disagreePct,
    voices: result.participantCount,
    reactions: result.reactionCount,
    comments: result.commentCount,
  };
}

/** The reveal. A 404 until the week has closed and been settled — never a partial answer. */
export async function getTopicResult(deps: CommunityDeps, userId: string, topicId: string): Promise<CycleResultView> {
  const ctx = await requireTopicMember(deps, userId, topicId);
  if (ctx.stage !== "settled") {
    throw new CommunityError(404, "RESULT_NOT_READY", "Where the room landed is revealed when the week closes.");
  }
  const result = await deps.store.findCycleResult(ctx.cycle.id);
  if (!result) throw new CommunityError(404, "NO_RESULT", "Nobody spoke this week, so there's nothing to reveal.");
  return resultView(result);
}

/**
 * A community's history — the part of every week that remains. Readable by
 * members, and by anyone for an active community: a result holds no one.
 */
export async function getCommunityHistory(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<CommunityHistoryView> {
  const community = await deps.store.findCommunity(communityId);
  if (!community) throw notFound("Community");
  const member = isActive(await deps.store.findMembership(communityId, userId));
  if (!member && community.status !== "active") throw notFound("Community");

  const results = (await deps.store.listCommunityResults(communityId, 200)).map(resultView);
  const byKey = new Map<string, CycleResultView[]>();
  for (const r of results) byKey.set(r.topic.topicKey, [...(byKey.get(r.topic.topicKey) ?? []), r]);

  return {
    community: { id: community.id, name: community.name, slug: community.slug },
    results,
    recurring: [...byKey.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([topicKey, list]) => ({ topicKey, text: list[0].topic.text, results: list })),
  };
}
