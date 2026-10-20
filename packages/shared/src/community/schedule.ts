/**
 * The community week, as pure calendar math.
 *
 * No clock reads: every function takes the instant it reasons about. The API
 * injects its clock, tests pass fixed dates, and a full seven-day cycle can be
 * walked through in milliseconds. That property is the reason the weekly loop
 * is testable at all, so nothing in here may call `new Date()` or `Date.now()`.
 *
 * Time-zone handling uses only `Intl.DateTimeFormat`, which Node and Hermes
 * both ship — no dependency, and the same code runs on the phone.
 */

import { COMMUNITY_TIME_ZONE, CYCLE_SCHEDULE } from "./constants.js";

const DAY_MS = 86_400_000;

// ─── Zoned wall time ─────────────────────────────────────────────

interface CalendarDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

interface ZonedParts extends CalendarDate {
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading of `instant` in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string = COMMUNITY_TIME_ZONE): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Milliseconds `timeZone` is ahead of UTC at `instant` (negative west of Greenwich). */
function offsetAt(instant: number, timeZone: string): number {
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Drop sub-second noise so the subtraction is an exact offset.
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The UTC instant at which `timeZone`'s clocks read the given wall time.
 *
 * Guess using the offset at the naive instant, then correct once using the
 * offset at the result — which resolves the case where a DST change falls
 * between the two. Wall times inside a spring-forward gap don't exist; the
 * schedule never uses them.
 */
export function zonedTimeToUtc(
  date: CalendarDate,
  hour: number,
  minute: number,
  timeZone: string = COMMUNITY_TIME_ZONE
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = naive - offsetAt(naive, timeZone);
  const second = naive - offsetAt(first, timeZone);
  return new Date(second);
}

// ─── ISO weeks ───────────────────────────────────────────────────

function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 1 (Monday) to 7 (Sunday). */
function isoWeekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() || 7;
}

function isoWeekOf(date: CalendarDate): { isoYear: number; week: number } {
  // The ISO week belongs to whichever year its Thursday falls in.
  const thursday = addDays(date, 4 - isoWeekday(date));
  const yearStart = Date.UTC(thursday.year, 0, 1);
  const dayOfYear = (Date.UTC(thursday.year, thursday.month - 1, thursday.day) - yearStart) / DAY_MS;
  return { isoYear: thursday.year, week: Math.floor(dayOfYear / 7) + 1 };
}

const WEEK_KEY = /^(\d{4})-W(\d{2})$/;

/** "2026-W38" → the Monday that week starts on. Throws on a malformed key. */
export function mondayOfWeek(weekKey: string): CalendarDate {
  const match = WEEK_KEY.exec(weekKey);
  if (!match) throw new Error(`Not a week key: "${weekKey}"`);
  const isoYear = Number(match[1]);
  const week = Number(match[2]);

  // January 4th is always in ISO week 1.
  const jan4 = { year: isoYear, month: 1, day: 4 };
  const mondayOfWeek1 = addDays(jan4, 1 - isoWeekday(jan4));
  const monday = addDays(mondayOfWeek1, (week - 1) * 7);

  // Round-trip to reject "2026-W60" rather than silently rolling into 2027.
  if (formatWeekKey(isoWeekOf(monday)) !== weekKey) {
    throw new Error(`Not a real week: "${weekKey}"`);
  }
  return monday;
}

function formatWeekKey({ isoYear, week }: { isoYear: number; week: number }): string {
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function isWeekKey(value: string): boolean {
  try {
    mondayOfWeek(value);
    return true;
  } catch {
    return false;
  }
}

/** The ISO week `instant` falls in, read on community-time calendars. */
export function weekKeyFor(instant: Date): string {
  return formatWeekKey(isoWeekOf(zonedParts(instant)));
}

export function shiftWeekKey(weekKey: string, weeks: number): string {
  return formatWeekKey(isoWeekOf(addDays(mondayOfWeek(weekKey), weeks * 7)));
}

// ─── Cycles ──────────────────────────────────────────────────────

export interface CycleBoundaries {
  weekKey: string;
  gatheringOpensAt: Date;
  votingOpensAt: Date;
  opensAt: Date;
  closesAt: Date;
}

/** Every boundary of the cycle whose room is open during `weekKey`. */
export function cycleBoundaries(weekKey: string): CycleBoundaries {
  const monday = mondayOfWeek(weekKey);
  const at = (b: { weekOffset: number; isoDay: number; hour: number; minute: number }) =>
    zonedTimeToUtc(addDays(monday, b.weekOffset * 7 + (b.isoDay - 1)), b.hour, b.minute);

  return {
    weekKey,
    gatheringOpensAt: at(CYCLE_SCHEDULE.gatheringOpens),
    votingOpensAt: at(CYCLE_SCHEDULE.votingOpens),
    opensAt: at(CYCLE_SCHEDULE.roomOpens),
    closesAt: at(CYCLE_SCHEDULE.roomCloses),
  };
}

export const CYCLE_STAGES = [
  "scheduled",
  "gathering",
  "voting",
  "open",
  "closed",
  "settled",
] as const;

export type CycleStage = (typeof CYCLE_STAGES)[number];

/**
 * Where a cycle is at `now`.
 *
 * Derived from the boundaries rather than stored, so a job that runs late can
 * never leave a room showing the wrong stage. The one exception is `settled`,
 * which is a fact about work done at close — not about the time — and so is
 * passed in.
 */
export function stageFor(
  cycle: Pick<CycleBoundaries, "gatheringOpensAt" | "votingOpensAt" | "opensAt" | "closesAt"> & {
    settledAt?: Date | null;
  },
  now: Date
): CycleStage {
  if (cycle.settledAt) return "settled";
  const t = now.getTime();
  if (t < cycle.gatheringOpensAt.getTime()) return "scheduled";
  if (t < cycle.votingOpensAt.getTime()) return "gathering";
  if (t < cycle.opensAt.getTime()) return "voting";
  if (t < cycle.closesAt.getTime()) return "open";
  return "closed";
}
