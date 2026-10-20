/**
 * Genuine participation is the price of entry.
 *
 * Checked at submission, before a response can unlock a room:
 *
 *   - A restriction in force refuses outright, with its end date.
 *   - A silent recording is refused — the recorder meters as it records and
 *     reports how much of the file was audible, so this never needs the file.
 *   - A recording already submitted before (same content hash) is refused.
 *
 * A refusal leaves the room locked and files a strike. Three strikes in thirty
 * days restricts for a week. Nothing here removes an account: strikes carry
 * review fields for a person, and escalation beyond a temporary restriction is
 * theirs to decide.
 *
 * Relevance — whether a response engages the topic at all — needs a
 * transcript and is deliberately deferred.
 */

import {
  MIN_SIGNAL_RATIO,
  STRIKE_TTL_DAYS,
  restrictedUntil,
  type StandingView,
} from "@kinextion/shared";
import { DAY_MS } from "./clock.js";
import { CommunityError } from "./errors.js";
import type { CommunityDeps } from "./service.js";
import type { MediaAssetRecord } from "./store.js";

async function fileStrike(deps: CommunityDeps, userId: string, reason: string) {
  const now = deps.clock.now();
  await deps.store.createStrike({
    userId,
    reason,
    severity: "low",
    responseId: null,
    expiresAt: new Date(now.getTime() + STRIKE_TTL_DAYS * DAY_MS),
    at: now,
  });
}

async function currentRestriction(deps: CommunityDeps, userId: string): Promise<Date | null> {
  const now = deps.clock.now();
  const strikes = await deps.store.listRecentStrikes(userId, new Date(now.getTime() - STRIKE_TTL_DAYS * DAY_MS));
  return restrictedUntil(strikes, now);
}

export async function checkSubmissionIntegrity(
  deps: CommunityDeps,
  userId: string,
  asset: MediaAssetRecord
): Promise<void> {
  const until = await currentRestriction(deps, userId);
  if (until) {
    throw new CommunityError(
      403,
      "RESTRICTED",
      `Sharing is paused on your account until ${until.toISOString().slice(0, 10)} after several recordings that didn't count.`
    );
  }

  if (asset.signalRatio !== null && asset.signalRatio < MIN_SIGNAL_RATIO) {
    await fileStrike(deps, userId, "silent_recording");
    throw new CommunityError(
      422,
      "SILENT_RECORDING",
      "We couldn't hear you in that recording. Try again somewhere you can speak up."
    );
  }

  if (asset.contentHash) {
    const reused = await deps.store.findUsedMediaByHash(userId, asset.contentHash, asset.id);
    if (reused.length > 0) {
      await fileStrike(deps, userId, "reused_recording");
      throw new CommunityError(
        422,
        "REUSED_RECORDING",
        "That recording has been shared before. Each week's response needs to be new."
      );
    }
  }
}

export async function getMyStanding(deps: CommunityDeps, userId: string): Promise<StandingView> {
  const now = deps.clock.now();
  const strikes = await deps.store.listRecentStrikes(userId, new Date(now.getTime() - STRIKE_TTL_DAYS * DAY_MS));
  const until = restrictedUntil(strikes, now);
  return { restrictedUntil: until?.toISOString() ?? null, recentStrikes: strikes.length };
}
