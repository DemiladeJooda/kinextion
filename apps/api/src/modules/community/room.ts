/**
 * Inside the room: listening, reacting, commenting.
 *
 * Every function here starts at `requireRoomAccess` — the gate — and then
 * narrows to the caller's circle. A member of circle two asking for a
 * response in circle one gets the same 404 as someone asking for a response
 * that doesn't exist.
 *
 * Reactions are private while the room is open. You can see and change your
 * own; nobody, including the API, can see a total. Comments are live.
 */

import {
  seededOrder,
  type CommentInput,
  type CommentView,
  type PlaybackView,
  type ReactionVerdict,
  type ReportInput,
  type RoomResponseItem,
  type RoomView,
} from "@kinextion/shared";
import { CommunityError, notFound } from "./errors.js";
import { requireStorage, resolvePlayback } from "./media.js";
import { myResponseView, requireRoomAccess, type RoomAccess } from "./responses.js";
import type { CommunityDeps } from "./service.js";
import type { RoomResponseRecord } from "./store.js";

/** A response the caller may hear: submitted, and in their own circle (or their own). */
async function requireAudibleResponse(
  deps: CommunityDeps,
  userId: string,
  responseId: string
): Promise<{ access: RoomAccess; response: RoomResponseRecord }> {
  const response = await deps.store.findResponse(responseId);
  if (!response) throw notFound("Response");
  // The gate first: a locked room refuses before anything about this response is decided.
  const access = await requireRoomAccess(deps, userId, response.topicId);
  if (response.status !== "submitted" || response.circleId !== access.circleId) throw notFound("Response");
  return { access, response };
}

function requireOpenForWriting(access: RoomAccess) {
  if (access.stage !== "open") {
    throw new CommunityError(409, "ROOM_CLOSED", "This week's conversation has closed.");
  }
}

export async function getRoom(deps: CommunityDeps, userId: string, topicId: string): Promise<RoomView> {
  const access = await requireRoomAccess(deps, userId, topicId);
  const inCircle = await deps.store.listCircleResponses(access.circleId);
  const others = inCircle.filter((r) => r.userId !== userId);
  const ordered = seededOrder(others, `${userId}:${topicId}`);

  const ids = ordered.map((r) => r.id);
  const [names, reactions, commentCounts, media, mineMedia] = await Promise.all([
    deps.store.displayNames(ordered.map((r) => r.userId)),
    deps.store.myReactions(userId, ids),
    deps.store.commentCounts(ids),
    Promise.all(ordered.map((r) => (r.mediaId ? deps.store.findMediaAsset(r.mediaId) : null))),
    access.response.mediaId ? deps.store.findMediaAsset(access.response.mediaId) : null,
  ]);

  const responses: RoomResponseItem[] = ordered.map((r, i) => ({
    id: r.id,
    speaker: { displayName: names.get(r.userId) ?? null },
    kind: media[i]?.kind ?? "video",
    durationSec: r.durationSec,
    createdAt: r.createdAt.toISOString(),
    myReaction: reactions.get(r.id) ?? null,
    commentCount: commentCounts.get(r.id) ?? 0,
  }));

  return {
    topic: { id: access.topic.id, text: access.topic.text },
    community: { id: access.community.id, name: access.community.name, slug: access.community.slug },
    cycle: { weekKey: access.cycle.weekKey, stage: access.stage, closesAt: access.cycle.closesAt.toISOString() },
    circle: { voices: inCircle.length },
    mine: myResponseView(access.response, mineMedia?.kind ?? "video"),
    responses,
  };
}

/** A fresh, short-lived playback URL — only through the gate. */
export async function playResponse(deps: CommunityDeps, userId: string, responseId: string): Promise<PlaybackView> {
  const storage = requireStorage(deps);
  const { response } = await requireAudibleResponse(deps, userId, responseId);
  const asset = response.mediaId ? await deps.store.findMediaAsset(response.mediaId) : null;
  if (!asset) throw new CommunityError(410, "MEDIA_GONE", "This recording is no longer available.");
  return resolvePlayback(storage, asset);
}

/** Agree, mixed or disagree — privately, and changeable until the room closes. */
export async function reactToResponse(
  deps: CommunityDeps,
  userId: string,
  responseId: string,
  verdict: ReactionVerdict
): Promise<{ recorded: true }> {
  const { access, response } = await requireAudibleResponse(deps, userId, responseId);
  requireOpenForWriting(access);
  if (response.userId === userId) {
    throw new CommunityError(409, "OWN_RESPONSE", "You can't react to your own response.");
  }
  await deps.store.upsertReaction({ responseId, userId, verdict, at: deps.clock.now() });
  return { recorded: true };
}

export async function listComments(deps: CommunityDeps, userId: string, responseId: string): Promise<CommentView[]> {
  await requireAudibleResponse(deps, userId, responseId);
  const comments = await deps.store.listComments(responseId);
  const [names, likes] = await Promise.all([
    deps.store.displayNames([...new Set(comments.map((c) => c.userId))]),
    deps.store.commentLikes(
      comments.map((c) => c.id),
      userId
    ),
  ]);
  return comments.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    author: { displayName: c.deletedAt ? null : (names.get(c.userId) ?? null) },
    isMine: c.userId === userId,
    body: c.deletedAt ? null : c.body,
    deleted: c.deletedAt !== null,
    createdAt: c.createdAt.toISOString(),
    likeCount: likes.counts.get(c.id) ?? 0,
    likedByMe: likes.mine.has(c.id),
  }));
}

/** Comment, or reply to a top-level comment. One level of replies — the response is the conversation. */
export async function addComment(
  deps: CommunityDeps,
  userId: string,
  responseId: string,
  input: CommentInput
): Promise<CommentView> {
  const { access } = await requireAudibleResponse(deps, userId, responseId);
  requireOpenForWriting(access);

  if (input.parentId) {
    const parent = await deps.store.findComment(input.parentId);
    if (!parent || parent.responseId !== responseId) throw notFound("Comment");
    if (parent.parentId !== null) {
      throw new CommunityError(400, "REPLY_DEPTH", "Replies can't be replied to — reply to the original comment.");
    }
    if (parent.deletedAt) throw new CommunityError(409, "COMMENT_DELETED", "That comment was deleted.");
  }

  const comment = await deps.store.createComment({
    responseId,
    userId,
    parentId: input.parentId ?? null,
    body: input.body,
    at: deps.clock.now(),
  });
  const names = await deps.store.displayNames([userId]);
  return {
    id: comment.id,
    parentId: comment.parentId,
    author: { displayName: names.get(userId) ?? null },
    isMine: true,
    body: comment.body,
    deleted: false,
    createdAt: comment.createdAt.toISOString(),
    likeCount: 0,
    likedByMe: false,
  };
}

async function requireAudibleComment(deps: CommunityDeps, userId: string, commentId: string) {
  const comment = await deps.store.findComment(commentId);
  if (!comment) throw notFound("Comment");
  const { access } = await requireAudibleResponse(deps, userId, comment.responseId);
  return { comment, access };
}

export async function setCommentLike(
  deps: CommunityDeps,
  userId: string,
  commentId: string,
  liked: boolean
): Promise<{ liked: boolean }> {
  const { comment, access } = await requireAudibleComment(deps, userId, commentId);
  requireOpenForWriting(access);
  if (comment.deletedAt) throw new CommunityError(409, "COMMENT_DELETED", "That comment was deleted.");
  await deps.store.setCommentLike(commentId, userId, liked, deps.clock.now());
  return { liked };
}

export async function deleteComment(deps: CommunityDeps, userId: string, commentId: string): Promise<{ deleted: true }> {
  const comment = await deps.store.findComment(commentId);
  if (!comment || comment.userId !== userId) throw notFound("Comment");
  if (!comment.deletedAt) await deps.store.softDeleteComment(commentId, deps.clock.now());
  return { deleted: true };
}

/**
 * Report a response or comment. Always recorded for a person to review; a
 * report never hides or removes anything on its own.
 */
export async function reportContent(
  deps: CommunityDeps,
  userId: string,
  target: { responseId: string } | { commentId: string },
  input: ReportInput
): Promise<{ recorded: true }> {
  if ("commentId" in target) {
    await requireAudibleComment(deps, userId, target.commentId);
  } else {
    await requireAudibleResponse(deps, userId, target.responseId);
  }
  await deps.store.createReport({
    reporterId: userId,
    responseId: "responseId" in target ? target.responseId : null,
    commentId: "commentId" in target ? target.commentId : null,
    reason: input.reason,
    note: input.note ?? null,
    at: deps.clock.now(),
  });
  return { recorded: true };
}
