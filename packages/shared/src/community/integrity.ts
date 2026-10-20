/**
 * Integrity — pure.
 *
 * Genuine participation is the price of entry to a room. These rules decide
 * when repeated attempts to game that become a restriction. They are
 * deliberately mild and deliberately temporary: a model or a heuristic may file
 * a strike, but nothing here can remove a person. That is a human's call.
 */

import { RESTRICTION_DAYS, STRIKE_TTL_DAYS, STRIKES_FOR_RESTRICTION } from "./constants.js";

const DAY_MS = 86_400_000;

/**
 * When a restriction ends, or null if there isn't one. Three strikes within
 * the window restrict for a week from the latest; a strike while restricted
 * extends it.
 */
export function restrictedUntil(strikes: readonly { createdAt: Date }[], now: Date): Date | null {
  const recent = strikes
    .filter((s) => s.createdAt.getTime() > now.getTime() - STRIKE_TTL_DAYS * DAY_MS)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (recent.length < STRIKES_FOR_RESTRICTION) return null;
  const until = new Date(recent[recent.length - 1].createdAt.getTime() + RESTRICTION_DAYS * DAY_MS);
  return until > now ? until : null;
}
