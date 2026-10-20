/**
 * Speak before you listen.
 *
 * This module is the gate. A member's community for the week stays closed to
 * them until they've submitted their own response to the week's topic. The
 * rule is enforced here and nowhere else: `requireRoomAccess` is the single
 * check every room read goes through — the room, a response, its playback URL,
 * its comments — so there is no second path around it to forget.
 *
 * One response per person per topic, forever. Withdrawing re-locks the room
 * and the slot stays spent; the unique index in storage makes a replacement
 * impossible even if a future change here gets it wrong.
 */

import {
  MIN_RESPONSE_SECONDS,
  assignCircle,
  stageFor,
  type CycleStage,
  type MyResponseView,
  type SubmitResponseInput,
  type TopicView,
} from "@kinextion/shared";
import { DAY_MS } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import { isActive, type CommunityDeps } from "./service.js";
import {
  DuplicateResponseError,
  type CommunityRecord,
  type CycleRecord,
  type MediaAssetRecord,
  type RoomResponseRecord,
  type TopicRecord,
} from "./store.js";

/** Weeks of circle history considered when seating someone. */
const PARTNER_HISTORY_WEEKS = 4;

/** Safety net: community media is purged at settlement, but never survives this long past close regardless. */
const MEDIA_GRACE_DAYS = 7;

const ROOM_STAGES: CycleStage[] = ["open", "closed"];

export interface TopicContext {
  topic: TopicRecord;
  cycle: CycleRecord;
  community: CommunityRecord;
  stage: CycleStage;
}

/** The topic and its surroundings, for a member. Anyone else gets a 404. */
export async function requireTopicMember(deps: CommunityDeps, userId: string, topicId: string): Promise<TopicContext> {
  const topic = await deps.store.findTopic(topicId);
  const cycle = topic ? await deps.store.findCycle(topic.cycleId) : null;
  const community = cycle ? await deps.store.findCommunity(cycle.communityId) : null;
  const membership = community ? await deps.store.findMembership(community.id, userId) : null;
  if (!topic || !cycle || !community || !isActive(membership)) throw notFound("Topic");
  return { topic, cycle, community, stage: stageFor(cycle, deps.clock.now()) };
}

export interface RoomAccess extends TopicContext {
  response: RoomResponseRecord;
  circleId: string;
}

/**
 * The gate. Returns the caller's own submitted response and circle, or refuses:
 *
 *   404 NOT_FOUND              not a member (a 403 would confirm the room exists)
 *   409 ROOM_NOT_OPEN          the week's conversation hasn't started, or has been settled
 *   403 NOT_ACTIVE_COMMUNITY   you chose a different community this week
 *   403 UNLOCK_REQUIRED        you haven't spoken, or you withdrew
 */
export async function requireRoomAccess(deps: CommunityDeps, userId: string, topicId: string): Promise<RoomAccess> {
  const ctx = await requireTopicMember(deps, userId, topicId);
  if (!ROOM_STAGES.includes(ctx.stage)) {
    throw new CommunityError(
      409,
      "ROOM_NOT_OPEN",
      ctx.stage === "settled" ? "This week's conversation has closed." : "This room hasn't opened yet."
    );
  }

  const [choice, response] = await Promise.all([
    deps.store.findActiveChoice(userId, ctx.cycle.weekKey),
    deps.store.findResponseFor(topicId, userId),
  ]);
  if (choice?.communityId && choice.communityId !== ctx.community.id) {
    throw new CommunityError(
      403,
      "NOT_ACTIVE_COMMUNITY",
      "You're sitting with a different community this week."
    );
  }
  if (!response || response.status !== "submitted" || !response.circleId) {
    throw new CommunityError(403, "UNLOCK_REQUIRED", "Share your own response to open the room.");
  }
  return { ...ctx, response, circleId: response.circleId };
}

export function myResponseView(response: RoomResponseRecord, kind: MediaAssetRecord["kind"]): MyResponseView {
  return {
    id: response.id,
    topicId: response.topicId,
    status: response.status,
    visibility: response.visibility,
    kind,
    durationSec: response.durationSec,
    createdAt: response.createdAt.toISOString(),
    withdrawnAt: response.withdrawnAt?.toISOString() ?? null,
  };
}

async function viewOf(deps: CommunityDeps, response: RoomResponseRecord): Promise<MyResponseView> {
  const media = response.mediaId ? await deps.store.findMediaAsset(response.mediaId) : null;
  return myResponseView(response, media?.kind ?? "video");
}

/** The topic as a member sees it — including whether their room is locked. */
export async function getTopic(deps: CommunityDeps, userId: string, topicId: string): Promise<TopicView> {
  const ctx = await requireTopicMember(deps, userId, topicId);
  const [choice, response] = await Promise.all([
    deps.store.findActiveChoice(userId, ctx.cycle.weekKey),
    deps.store.findResponseFor(topicId, userId),
  ]);
  const chosen = choice?.communityId === ctx.community.id;
  return {
    id: ctx.topic.id,
    text: ctx.topic.text,
    community: { id: ctx.community.id, name: ctx.community.name, slug: ctx.community.slug },
    cycle: {
      id: ctx.cycle.id,
      weekKey: ctx.cycle.weekKey,
      stage: ctx.stage,
      opensAt: ctx.cycle.opensAt.toISOString(),
      closesAt: ctx.cycle.closesAt.toISOString(),
    },
    you: {
      chosen,
      choseElsewhere: !!choice?.communityId && !chosen,
      response: response ? await viewOf(deps, response) : null,
      room: response?.status === "submitted" && !(choice?.communityId && !chosen) ? "open" : "locked",
    },
  };
}

/**
 * Speak. Validates the recording, seats you in a circle, locks your choice of
 * community for the week, and opens the room — all in one transaction.
 */
export async function submitResponse(
  deps: CommunityDeps,
  userId: string,
  topicId: string,
  input: SubmitResponseInput
): Promise<MyResponseView> {
  const now = deps.clock.now();
  const ctx = await requireTopicMember(deps, userId, topicId);

  if (ctx.community.status !== "active") {
    throw new CommunityError(409, "COMMUNITY_CLOSED", "This community has closed.");
  }
  if (ctx.stage !== "open") {
    throw new CommunityError(
      409,
      "ROOM_NOT_OPEN",
      ctx.stage === "closed" || ctx.stage === "settled"
        ? "This week's conversation has closed."
        : "This room hasn't opened yet."
    );
  }
  if (await deps.store.findResponseFor(topicId, userId)) {
    throw new CommunityError(
      409,
      "ALREADY_RESPONDED",
      "You've already spoken on this topic. Each person gets one response, and a withdrawn one can't be replaced."
    );
  }

  const choice = await deps.store.findActiveChoice(userId, ctx.cycle.weekKey);
  if (choice?.communityId && choice.communityId !== ctx.community.id) {
    throw new CommunityError(
      409,
      "NOT_ACTIVE_COMMUNITY",
      "You're sitting with a different community this week. Switch before you speak here."
    );
  }

  const asset = await deps.store.findMediaAsset(input.mediaId);
  if (!asset || asset.ownerId !== userId) throw notFound("Recording");
  if (asset.status !== "ready") {
    throw new CommunityError(409, "MEDIA_NOT_READY", "That recording hasn't finished uploading.");
  }
  if (await deps.store.isMediaAttached(asset.id)) {
    throw new CommunityError(409, "MEDIA_IN_USE", "That recording has already been shared.");
  }
  if ((asset.durationSec ?? 0) < MIN_RESPONSE_SECONDS) {
    throw new CommunityError(
      422,
      "TOO_SHORT",
      `Responses need to be at least ${Math.round(MIN_RESPONSE_SECONDS / 60)} minutes.`
    );
  }
  if (deps.checkIntegrity) await deps.checkIntegrity(userId, asset);

  // Placement is decided from a read outside the transaction. Two people
  // speaking at the same instant might both open "the next" circle — the
  // circle's unique ordinal turns that into one shared circle, never two.
  const [circles, expectedSpeakers, recentPartners] = await Promise.all([
    deps.store.listCircles(ctx.cycle.id),
    deps.store.countActiveChoices(ctx.community.id, ctx.cycle.weekKey),
    deps.store.recentCirclePartners(ctx.community.id, userId, ctx.cycle.weekKey, PARTNER_HISTORY_WEEKS),
  ]);
  const placement = assignCircle({
    circles: circles.map((c) => ({ id: c.circle.id, ordinal: c.circle.ordinal, members: c.memberIds })),
    // Someone speaking without having chosen first is about to choose: count them.
    expectedSpeakers: expectedSpeakers + (choice ? 0 : 1),
    recentPartners,
  });

  try {
    const response = await deps.store.transaction(async (tx) => {
      if (!choice) {
        await tx.setActiveChoice({ userId, weekKey: ctx.cycle.weekKey, communityId: ctx.community.id, at: now });
      }
      if (!(await tx.lockActiveChoice(userId, ctx.cycle.weekKey, ctx.community.id, now))) {
        // Already locked to this community is fine — the response constraint
        // below decides whether this is a second response. Anything else means
        // the choice moved elsewhere since we read it.
        const current = await tx.findActiveChoice(userId, ctx.cycle.weekKey);
        if (current?.communityId !== ctx.community.id) {
          throw new CommunityError(
            409,
            "NOT_ACTIVE_COMMUNITY",
            "You're sitting with a different community this week. Switch before you speak here."
          );
        }
      }

      const circleId =
        placement.kind === "existing"
          ? placement.circleId
          : (await tx.createCircle(ctx.cycle.id, placement.ordinal, now)).id;
      await tx.seatInCircle(circleId, ctx.cycle.id, userId);
      const seatCircle = (await tx.findCircleSeat(ctx.cycle.id, userId)) ?? circleId;

      const created = await tx.createResponse({
        topicId,
        circleId: seatCircle,
        userId,
        mediaId: asset.id,
        visibility: input.visibility,
        durationSec: asset.durationSec ?? 0,
        at: now,
      });
      await tx.setMediaPurgeAfter([asset.id], new Date(ctx.cycle.closesAt.getTime() + MEDIA_GRACE_DAYS * DAY_MS));
      // Marks the recording as spoken, so re-uploading the same file is caught.
      await tx.markMediaUsed(asset.id, now);
      return created;
    });
    return myResponseView(response, asset.kind);
  } catch (err) {
    if (err instanceof DuplicateResponseError) {
      throw new CommunityError(
        409,
        "ALREADY_RESPONDED",
        "You've already spoken on this topic. Each person gets one response, and a withdrawn one can't be replaced."
      );
    }
    throw err;
  }
}

/**
 * Withdraw your response. The recording is deleted, the room locks again, and
 * the slot stays spent — you can't speak on this topic a second time.
 */
export async function withdrawResponse(
  deps: CommunityDeps,
  userId: string,
  responseId: string
): Promise<MyResponseView> {
  const now = deps.clock.now();
  const response = await deps.store.findResponse(responseId);
  if (!response || response.userId !== userId) throw notFound("Response");
  if (response.status !== "submitted") {
    throw new CommunityError(409, "NOT_SUBMITTED", "This response has already been withdrawn.");
  }

  await deps.store.transaction(async (tx) => {
    if (!(await tx.withdrawResponse(response.id, now))) {
      throw new CommunityError(409, "NOT_SUBMITTED", "This response has already been withdrawn.");
    }
    if (response.mediaId) await tx.setMediaPurgeAfter([response.mediaId], now);
  });

  return viewOf(deps, (await deps.store.findResponse(response.id))!);
}
