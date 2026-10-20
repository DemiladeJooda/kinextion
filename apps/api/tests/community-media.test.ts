/**
 * The media pipeline against in-memory storage: tickets, completion, the size
 * check that trusts the stored object rather than the client, and a purge
 * that deletes the file, not just the row.
 */

import { describe, expect, it } from "vitest";
import {
  ABANDONED_UPLOAD_HOURS,
  MAX_PENDING_UPLOADS,
  MAX_VIDEO_BYTES,
  PLAYBACK_URL_TTL_SECONDS,
  seededRng,
} from "@kinextion/shared";
import { HOUR_MS, ManualClock } from "../src/modules/community/clock.js";
import { CommunityError } from "../src/modules/community/errors.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import {
  completeUpload,
  createUpload,
  mediaKey,
  playOwnUpload,
  purgeDueMedia,
} from "../src/modules/community/media.js";
import type { CommunityDeps } from "../src/modules/community/service.js";
import { MemoryCommunityStore } from "./support/memory-community-store.js";
import { MemoryMediaStorage } from "./support/memory-media-storage.js";

function setup({ withStorage = true } = {}) {
  const store = new MemoryCommunityStore();
  const clock = new ManualClock("2026-09-14T17:00:00Z");
  const media = new MemoryMediaStorage(() => clock.now());
  const deps = {
    store,
    clock,
    rng: seededRng(8),
    media: withStorage ? media : null,
  } satisfies CommunityDeps;
  return { store, clock, media, deps };
}

const video = { kind: "video" as const, mimeType: "video/mp4", durationSec: 420, bytes: 180_000_000 };

async function expectRefusal(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err, `expected ${status} ${code}`).toBeInstanceOf(CommunityError);
  expect((err as CommunityError).statusCode).toBe(status);
  expect((err as CommunityError).code).toBe(code);
}

describe("upload tickets", () => {
  it("issues a presigned PUT and a pending asset that expires if abandoned", async () => {
    const { deps, store, clock } = setup();
    const ticket = await createUpload(deps, "u1", video);
    expect(ticket).toMatchObject({ method: "PUT", headers: { "Content-Type": "video/mp4" } });
    expect(ticket.uploadUrl).toContain("https://storage.test/put/media/2026/09/");

    const asset = store.state.media[0];
    expect(asset).toMatchObject({ ownerId: "u1", status: "pending", kind: "video" });
    expect(asset.purgeAfter).toEqual(new Date(clock.now().getTime() + ABANDONED_UPLOAD_HOURS * HOUR_MS));
  });

  it("keeps who and where out of the storage key", async () => {
    const key = mediaKey(seededRng(1), "audio/m4a", new Date("2026-09-14T00:00:00Z"));
    expect(key).toMatch(/^media\/2026\/09\/[0-9a-f]{32}\.m4a$/);
  });

  it.each([
    [{ ...video, durationSec: 119 }, "TOO_SHORT"],
    [{ ...video, durationSec: 1201 }, "TOO_LONG"],
    [{ ...video, bytes: MAX_VIDEO_BYTES + 1 }, "TOO_LARGE"],
    [{ ...video, mimeType: "video/webm" }, "UNSUPPORTED_MEDIA"],
    [{ ...video, kind: "audio" as const }, "UNSUPPORTED_MEDIA"],
  ])("refuses %o with %s", async (input, code) => {
    const { deps } = setup();
    await expectRefusal(createUpload(deps, "u1", input), 400, code);
  });

  it("accepts a two-minute recording — the floor, exactly", async () => {
    const { deps } = setup();
    await expect(createUpload(deps, "u1", { ...video, durationSec: 120 })).resolves.toHaveProperty("assetId");
  });

  it("limits unfinished uploads per person", async () => {
    const { deps } = setup();
    for (let i = 0; i < MAX_PENDING_UPLOADS; i++) await createUpload(deps, "u1", video);
    await expectRefusal(createUpload(deps, "u1", video), 429, "TOO_MANY_UPLOADS");
    await expect(createUpload(deps, "u2", video)).resolves.toHaveProperty("assetId");
  });

  it("answers 503, not a crash, when storage isn't configured", async () => {
    const { deps } = setup({ withStorage: false });
    await expectRefusal(createUpload(deps, "u1", video), 503, "MEDIA_UNAVAILABLE");
  });
});

describe("completing an upload", () => {
  it("checks the stored object is really there before marking it ready", async () => {
    const { deps, store, media } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    await expectRefusal(completeUpload(deps, "u1", assetId, {}), 409, "UPLOAD_MISSING");

    media.put(store.state.media[0].storageKey, 175_000_000);
    const view = await completeUpload(deps, "u1", assetId, { contentHash: "a".repeat(64), signalRatio: 0.82 });
    expect(view).toMatchObject({ status: "ready", bytes: 175_000_000 });
    expect(store.state.media[0]).toMatchObject({ contentHash: "a".repeat(64), signalRatio: 0.82 });
  });

  it("trusts the stored size over the declared one, and deletes an oversized file", async () => {
    const { deps, store, media } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    const key = store.state.media[0].storageKey;
    media.put(key, MAX_VIDEO_BYTES + 10);

    await expectRefusal(completeUpload(deps, "u1", assetId, {}), 413, "TOO_LARGE");
    expect(media.deleted).toContain(key);
    expect(store.state.media[0].status).toBe("rejected");
  });

  it("refuses an upload whose size storage won't confirm, rather than recording it as empty", async () => {
    const { deps, store, media } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    media.put(store.state.media[0].storageKey, 1000);
    // Storage answers, but without a size — the state a compressed response leaves us in.
    media.head = async () => ({ bytes: null });

    await expectRefusal(completeUpload(deps, "u1", assetId, {}), 409, "UPLOAD_UNVERIFIED");
    expect(store.state.media[0].status).toBe("pending");
  });

  it("is idempotent once ready", async () => {
    const { deps, store, media } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    media.put(store.state.media[0].storageKey, 1000);
    await completeUpload(deps, "u1", assetId, {});
    await expect(completeUpload(deps, "u1", assetId, {})).resolves.toMatchObject({ status: "ready" });
  });

  it("won't complete or play someone else's upload, and doesn't confirm it exists", async () => {
    const { deps, store, media } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    media.put(store.state.media[0].storageKey, 1000);
    await expectRefusal(completeUpload(deps, "u2", assetId, {}), 404, "NOT_FOUND");
    await completeUpload(deps, "u1", assetId, {});
    await expectRefusal(playOwnUpload(deps, "u2", assetId), 404, "NOT_FOUND");
  });
});

describe("playback", () => {
  it("gives the owner a short-lived URL to preview before submitting", async () => {
    const { deps, store, media, clock } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    media.put(store.state.media[0].storageKey, 1000);
    await completeUpload(deps, "u1", assetId, {});

    const playback = await playOwnUpload(deps, "u1", assetId);
    expect(playback).toMatchObject({ kind: "video", durationSec: 420 });
    expect(playback.url).toContain("https://storage.test/get/");
    expect(new Date(playback.expiresAt).getTime()).toBe(clock.now().getTime() + PLAYBACK_URL_TTL_SECONDS * 1000);
  });

  it("refuses to play something that isn't ready", async () => {
    const { deps } = setup();
    const { assetId } = await createUpload(deps, "u1", video);
    await expectRefusal(playOwnUpload(deps, "u1", assetId), 410, "MEDIA_GONE");
  });
});

describe("purging", () => {
  it("deletes abandoned uploads from storage, not just the database", async () => {
    const { deps, store, media, clock } = setup();
    await createUpload(deps, "u1", video);
    const key = store.state.media[0].storageKey;
    media.put(key, 1000);

    clock.advanceHours(ABANDONED_UPLOAD_HOURS - 1);
    expect((await runMaintenance(deps)).media.purged).toBe(0);

    clock.advanceHours(2);
    expect((await runMaintenance(deps)).media).toEqual({ purged: 1, failed: 0 });
    expect(media.objects.has(key)).toBe(false);
    expect(store.state.media[0].status).toBe("purged");
  });

  it("leaves an asset due when storage fails, so the next pass retries", async () => {
    const { deps, store, media, clock } = setup();
    await createUpload(deps, "u1", video);
    clock.advanceHours(ABANDONED_UPLOAD_HOURS + 1);

    media.failDeletes = true;
    expect(await purgeDueMedia(deps)).toEqual({ purged: 0, failed: 1 });
    expect(store.state.media[0].status).toBe("pending");

    media.failDeletes = false;
    expect(await purgeDueMedia(deps)).toEqual({ purged: 1, failed: 0 });
  });
});
