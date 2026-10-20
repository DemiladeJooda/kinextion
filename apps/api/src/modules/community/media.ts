/**
 * Media: upload tickets, completion, playback, purge.
 *
 * The API never touches a byte. It hands the phone a presigned PUT, checks
 * the object landed at a sane size, and later hands listeners short-lived
 * presigned GETs — but only through `resolvePlayback`, and only after the room
 * rules in responses.ts have said yes.
 *
 * Every asset carries `purgeAfter` from the moment it's created. An upload
 * nobody attaches is gone in a day; an attached one gets its date moved by the
 * response lifecycle. The purge step deletes the stored object, not just the
 * row — deleting only the row would leave the video in the bucket forever.
 */

import {
  ABANDONED_UPLOAD_HOURS,
  MAX_AUDIO_BYTES,
  MAX_PENDING_UPLOADS,
  MAX_RESPONSE_SECONDS,
  MAX_VIDEO_BYTES,
  MEDIA_MIME_TYPES,
  MIN_RESPONSE_SECONDS,
  PLAYBACK_URL_TTL_SECONDS,
  UPLOAD_URL_TTL_SECONDS,
  type CompleteUploadInput,
  type CreateUploadInput,
  type MediaAssetView,
  type PlaybackView,
  type UploadTicketView,
} from "@kinextion/shared";
import type { MediaStorage } from "../../lib/media/storage.js";
import { HOUR_MS } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import type { CommunityDeps } from "./service.js";
import type { MediaAssetRecord } from "./store.js";

export function requireStorage(deps: CommunityDeps): MediaStorage {
  if (!deps.media) {
    throw new CommunityError(503, "MEDIA_UNAVAILABLE", "Recording uploads aren't available right now.");
  }
  return deps.media;
}

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
};

/**
 * Storage keys carry no user id or community — just a random name under a
 * month folder — so a URL that leaks says nothing about whose it is.
 */
export function mediaKey(rng: () => number, mimeType: string, now: Date): string {
  let name = "";
  for (let i = 0; i < 32; i++) name += Math.floor(rng() * 16).toString(16);
  const month = now.toISOString().slice(0, 7).replace("-", "/");
  return `media/${month}/${name}.${EXTENSIONS[mimeType] ?? "bin"}`;
}

export const maxBytesFor = (kind: "video" | "audio") => (kind === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES);

export function assetView(asset: MediaAssetRecord): MediaAssetView {
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    durationSec: asset.durationSec,
    bytes: asset.bytes,
  };
}

/** Issue an upload ticket for a recording or an existing file. */
export async function createUpload(
  deps: CommunityDeps,
  userId: string,
  input: CreateUploadInput
): Promise<UploadTicketView> {
  const storage = requireStorage(deps);
  const now = deps.clock.now();

  if (!(MEDIA_MIME_TYPES[input.kind] as readonly string[]).includes(input.mimeType)) {
    throw new CommunityError(400, "UNSUPPORTED_MEDIA", `That file type isn't supported for ${input.kind}.`);
  }
  if (input.durationSec < MIN_RESPONSE_SECONDS) {
    throw new CommunityError(
      400,
      "TOO_SHORT",
      `Responses need to be at least ${Math.round(MIN_RESPONSE_SECONDS / 60)} minutes.`
    );
  }
  if (input.durationSec > MAX_RESPONSE_SECONDS) {
    throw new CommunityError(400, "TOO_LONG", `Responses can be up to ${MAX_RESPONSE_SECONDS / 60} minutes.`);
  }
  if (input.bytes > maxBytesFor(input.kind)) {
    throw new CommunityError(400, "TOO_LARGE", "That file is too large to upload.");
  }
  if ((await deps.store.countPendingUploads(userId)) >= MAX_PENDING_UPLOADS) {
    throw new CommunityError(
      429,
      "TOO_MANY_UPLOADS",
      "You have several uploads that never finished. Try again once those have cleared."
    );
  }

  const storageKey = mediaKey(deps.rng, input.mimeType, now);
  const asset = await deps.store.createMediaAsset({
    ownerId: userId,
    kind: input.kind,
    storageKey,
    mimeType: input.mimeType,
    durationSec: input.durationSec,
    bytes: input.bytes,
    purgeAfter: new Date(now.getTime() + ABANDONED_UPLOAD_HOURS * HOUR_MS),
    at: now,
  });

  const ticket = storage.presignUpload(storageKey, UPLOAD_URL_TTL_SECONDS);
  return {
    assetId: asset.id,
    uploadUrl: ticket.url,
    method: "PUT",
    headers: { "Content-Type": input.mimeType },
    expiresAt: ticket.expiresAt.toISOString(),
  };
}

async function requireOwnAsset(deps: CommunityDeps, userId: string, assetId: string) {
  const asset = await deps.store.findMediaAsset(assetId);
  // Someone else's asset id is indistinguishable from one that doesn't exist.
  if (!asset || asset.ownerId !== userId) throw notFound("Recording");
  return asset;
}

/**
 * Confirm the upload landed. Checks the stored object's real size — the
 * declared one was only a promise — and refuses anything over the ceiling,
 * deleting it rather than keeping it around.
 */
export async function completeUpload(
  deps: CommunityDeps,
  userId: string,
  assetId: string,
  input: CompleteUploadInput
): Promise<MediaAssetView> {
  const storage = requireStorage(deps);
  const now = deps.clock.now();
  const asset = await requireOwnAsset(deps, userId, assetId);

  if (asset.status === "ready") return assetView(asset);
  if (asset.status !== "pending") {
    throw new CommunityError(409, "UPLOAD_CLOSED", "This upload can't be completed any more.");
  }

  const stored = await storage.head(asset.storageKey);
  if (!stored) {
    throw new CommunityError(409, "UPLOAD_MISSING", "The file hasn't finished uploading yet.");
  }
  if (stored.bytes === null) {
    // Storage answered but wouldn't say how big the file is, so the size limit
    // can't be enforced. Fail closed and let the client retry rather than
    // accept an unmeasured file.
    throw new CommunityError(
      409,
      "UPLOAD_UNVERIFIED",
      "We couldn't confirm that upload. Try sending it again."
    );
  }
  if (stored.bytes > maxBytesFor(asset.kind)) {
    await storage.delete(asset.storageKey);
    await deps.store.markMediaRejected(asset.id, now);
    throw new CommunityError(413, "TOO_LARGE", "That file is too large, so it wasn't kept.");
  }

  await deps.store.markMediaReady(asset.id, {
    bytes: stored.bytes,
    contentHash: input.contentHash ?? null,
    signalRatio: input.signalRatio ?? null,
  });
  return assetView((await deps.store.findMediaAsset(asset.id))!);
}

/**
 * The only way a playback URL is made. Storage-only today: a short-lived
 * presigned GET. A managed video service would branch on `playbackId` here.
 */
export function resolvePlayback(storage: MediaStorage, asset: MediaAssetRecord): PlaybackView {
  if (asset.status !== "ready") {
    throw new CommunityError(410, "MEDIA_GONE", "This recording is no longer available.");
  }
  const signed = storage.presignDownload(asset.storageKey, PLAYBACK_URL_TTL_SECONDS);
  return {
    kind: asset.kind,
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    durationSec: asset.durationSec,
  };
}

/** Preview your own recording before you submit it. */
export async function playOwnUpload(deps: CommunityDeps, userId: string, assetId: string): Promise<PlaybackView> {
  const storage = requireStorage(deps);
  return resolvePlayback(storage, await requireOwnAsset(deps, userId, assetId));
}

/**
 * Delete every stored object whose time has come. A storage failure leaves
 * the asset due, so the next pass retries it; nothing is marked purged unless
 * the object is really gone.
 */
export async function purgeDueMedia(deps: CommunityDeps, limit = 500): Promise<{ purged: number; failed: number }> {
  if (!deps.media) return { purged: 0, failed: 0 };
  const now = deps.clock.now();
  let purged = 0;
  let failed = 0;
  for (const asset of await deps.store.listMediaDueForPurge(now, limit)) {
    try {
      await deps.media.delete(asset.storageKey);
      await deps.store.markMediaPurged(asset.id, now);
      purged++;
    } catch {
      failed++;
    }
  }
  return { purged, failed };
}
