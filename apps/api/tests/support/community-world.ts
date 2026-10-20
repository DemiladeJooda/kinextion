/**
 * A community with a room open right now, for tests that start inside a week.
 *
 * Built through the real flow — invites, maintenance, a ballot decided at the
 * real Dallas boundary — so every test downstream of it exercises the same
 * path users do. The clock sits an hour into W39's open room.
 */

import { expect } from "vitest";
import { cycleBoundaries, seededRng, type SubmitResponseInput } from "@kinextion/shared";
import { HOUR_MS, ManualClock } from "../../src/modules/community/clock.js";
import { CommunityError } from "../../src/modules/community/errors.js";
import { completeUpload, createUpload } from "../../src/modules/community/media.js";
import { runMaintenance } from "../../src/modules/community/maintenance.js";
import { submitResponse } from "../../src/modules/community/responses.js";
import {
  acceptInvite,
  createCommunity,
  createInvite,
  type CommunityDeps,
} from "../../src/modules/community/service.js";
import { MemoryCommunityStore } from "./memory-community-store.js";
import { MemoryMediaStorage } from "./memory-media-storage.js";

export const W39 = cycleBoundaries("2026-W39");

export async function buildWorld({
  members = 8,
  name = "Favour House",
  prefix = "m",
  extra = {} as Partial<CommunityDeps>,
} = {}) {
  const store = new MemoryCommunityStore();
  const clock = new ManualClock("2026-09-14T17:00:00Z");
  const media = new MemoryMediaStorage(() => clock.now());
  const deps = { store, clock, rng: seededRng(3), media, ...extra } satisfies CommunityDeps;

  const ids = Array.from({ length: members }, (_, i) => `${prefix}${i + 1}`);
  for (const id of ids) store.setDisplayName(id, `Member ${id}`);

  const community = await foundWith(deps, ids, name);
  await runMaintenance(deps);
  clock.set(W39.votingOpensAt);
  await runMaintenance(deps);
  clock.set(new Date(W39.opensAt.getTime() + HOUR_MS));
  await runMaintenance(deps);

  const cycle = store.state.cycles.find((c) => c.communityId === community && c.weekKey === "2026-W39")!;
  const topic = store.state.topics.find((t) => t.cycleId === cycle.id)!;
  return { store, clock, media, deps, members: ids, communityId: community, cycle, topic };
}

/**
 * Close the current week and land an hour into the next one's open room,
 * settling everything on the way. Returns the new week's topic.
 */
export async function advanceToNextWeek(world: Awaited<ReturnType<typeof buildWorld>>, weekKey = "2026-W40") {
  const next = cycleBoundaries(weekKey);
  world.clock.set(next.votingOpensAt);
  await runMaintenance(world.deps);
  world.clock.set(new Date(next.opensAt.getTime() + HOUR_MS));
  await runMaintenance(world.deps);

  const cycle = world.store.state.cycles.find(
    (c) => c.communityId === world.communityId && c.weekKey === weekKey
  )!;
  const topic = world.store.state.topics.find((t) => t.cycleId === cycle.id)!;
  return { cycle, topic };
}

export async function foundWith(deps: CommunityDeps, ids: string[], name: string): Promise<string> {
  const { community } = await createCommunity(deps, ids[0], { name });
  // Founding is capped at MAX_OPEN_INVITES; larger test communities are grown directly.
  const invited = ids.slice(1, 50);
  const tokens = [];
  for (const _ of invited) tokens.push((await createInvite(deps, ids[0], community.id)).token);
  for (const [i, id] of invited.entries()) await acceptInvite(deps, id, tokens[i]);
  for (const id of ids.slice(50)) {
    await deps.store.upsertMembership({ communityId: community.id, userId: id, role: "member", at: deps.clock.now() });
  }
  return community.id;
}

let fileCounter = 0;

/** Upload a finished recording for `userId` and return its asset id. */
export async function upload(
  deps: CommunityDeps & { media: MemoryMediaStorage; store: MemoryCommunityStore },
  userId: string,
  {
    durationSec = 420,
    kind = "video" as "video" | "audio",
    contentHash,
    signalRatio = 0.8,
  }: { durationSec?: number; kind?: "video" | "audio"; contentHash?: string; signalRatio?: number } = {}
): Promise<string> {
  const mimeType = kind === "video" ? "video/mp4" : "audio/m4a";
  const { assetId } = await createUpload(deps, userId, { kind, mimeType, durationSec, bytes: 50_000_000 });
  const asset = deps.store.state.media.find((m) => m.id === assetId)!;
  deps.media.put(asset.storageKey, 50_000_000);
  await completeUpload(deps, userId, assetId, {
    contentHash: contentHash ?? (++fileCounter).toString(16).padStart(64, "0"),
    signalRatio,
  });
  return assetId;
}

/** Record, upload and submit a response for `userId` to `topicId`. */
export async function speak(
  deps: CommunityDeps & { media: MemoryMediaStorage; store: MemoryCommunityStore },
  userId: string,
  topicId: string,
  options: Partial<SubmitResponseInput> & Parameters<typeof upload>[2] = {}
) {
  const mediaId = await upload(deps, userId, options);
  return submitResponse(deps, userId, topicId, { mediaId, visibility: options.visibility ?? "community" });
}

export async function expectRefusal(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err, `expected ${status} ${code}, got ${err instanceof Error ? err.message : err}`).toBeInstanceOf(
    CommunityError
  );
  expect((err as CommunityError).statusCode).toBe(status);
  expect((err as CommunityError).code).toBe(code);
}
