/**
 * The community module's only source of "now" and of randomness.
 *
 * Nothing in modules/community may call `new Date()`, `Date.now()` or
 * `Math.random()` directly. Every stage transition, deadline and panel draw
 * takes these instead, which is what lets a test walk a full week — or a
 * 72-hour admission window — in milliseconds, and lets the dev tools
 * fast-forward a real database without editing timestamps.
 */

import { randomInt } from "node:crypto";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock a dev route can move. */
export interface AdjustableClock extends Clock {
  advance(ms: number): void;
  set(to: Date | string): void;
}

export const isAdjustable = (clock: Clock): clock is AdjustableClock =>
  typeof (clock as AdjustableClock).advance === "function" &&
  typeof (clock as AdjustableClock).set === "function";

/**
 * Real time plus an offset. Used only when COMMUNITY_DEV_TOOLS is on, so a
 * developer can push a real database through a whole week in a minute without
 * editing a single timestamp.
 */
export class OffsetClock implements AdjustableClock {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  advance(ms: number): void {
    this.offsetMs += ms;
  }

  set(to: Date | string): void {
    this.offsetMs = new Date(to).getTime() - Date.now();
  }

  get offset(): number {
    return this.offsetMs;
  }
}

/** A clock that only moves when told to. */
export class ManualClock implements AdjustableClock {
  private current: number;

  constructor(start: Date | string) {
    this.current = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  set(to: Date | string): void {
    this.current = new Date(to).getTime();
  }

  advance(ms: number): void {
    this.current += ms;
  }

  advanceHours(hours: number): void {
    this.advance(hours * 3_600_000);
  }
}

/** Float in [0, 1). */
export type Rng = () => number;

/**
 * Panel draws decide who is asked about a real person joining a real group,
 * so production uses a cryptographic source rather than Math.random.
 */
export const cryptoRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
