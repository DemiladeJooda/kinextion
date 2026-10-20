/**
 * Production wiring for the community layer: Prisma, the real clock (or a
 * movable one in dev), Claude for topic synthesis, R2 for media, and the
 * integrity checks. Built once per server so the community routes, the public
 * Discover routes and the guides' chat context all share one set.
 */

import { r2StorageFromEnv } from "../../lib/media/storage.js";
import { OffsetClock, cryptoRng, systemClock } from "./clock.js";
import { generateTopicsWithClaude } from "./facilitator.js";
import { checkSubmissionIntegrity } from "./integrity.js";
import { PrismaCommunityStore } from "./prisma-store.js";
import type { CommunityDeps } from "./service.js";

export function createCommunityDeps({ devTools = false }: { devTools?: boolean } = {}): CommunityDeps {
  const clock = devTools ? new OffsetClock() : systemClock;
  const deps: CommunityDeps = {
    store: new PrismaCommunityStore(),
    clock,
    rng: cryptoRng,
    generateTopics: generateTopicsWithClaude,
    media: r2StorageFromEnv(clock),
  };
  deps.checkIntegrity = (userId, asset) => checkSubmissionIntegrity(deps, userId, asset);
  return deps;
}

let shared: CommunityDeps | null = null;

/** The server's instance, for callers outside the route plugins (the guides' chat context). */
export function sharedCommunityDeps(): CommunityDeps {
  shared ??= createCommunityDeps();
  return shared;
}

export function setSharedCommunityDeps(deps: CommunityDeps): void {
  shared = deps;
}
