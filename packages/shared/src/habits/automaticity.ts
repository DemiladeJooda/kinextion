/**
 * Has it become automatic yet?
 *
 * Completion says a habit was done; it doesn't say whether it has become a
 * habit. The Self-Report Behavioural Automaticity Index (SRBAI; Gardner,
 * Abraham, Lally & de Bruijn 2012) measures that directly with four short
 * statements rated 1–7. Kinextion asks them once a week, right after a
 * habit is ticked, and plots the answers. When the curve levels off high,
 * the habit can graduate: it moves out of "building", its reminders stop,
 * and a slot opens for the next one.
 *
 * Typical time to automaticity is about two months, often much longer
 * (Lally et al. 2010: median 66 days, range 18–254; Singh et al. 2024:
 * medians 59–66 days, individuals 4–335). The thresholds below are design
 * judgements to tune with real data, not findings.
 */

import { z } from "zod";
import { addDays, daysBetween, type DateKey } from "./dates.js";

/** The four SRBAI items, as statements completed by the habit's name. */
export const SRBAI_ITEMS = [
  "I do automatically",
  "I do without having to consciously remember",
  "I do without thinking",
  "I start doing before I realise I'm doing it",
] as const;

export const SRBAI_MIN = 1;
export const SRBAI_MAX = 7;

/** Days between checks. */
export const CHECK_EVERY_DAYS = 7;
/** A habit this young hasn't had time to become anything yet. */
export const FIRST_CHECK_AFTER_DAYS = 7;

/** Graduation: two checks in a row averaging at least this… */
export const GRADUATE_AT = 5.5;
/** …and the last three within this much of each other (the curve has levelled). */
export const PLATEAU_RANGE = 0.5;

export interface AutomaticityPoint {
  date: DateKey;
  score: number;
}

/** Mean of the four items, to one decimal. */
export function srbaiScore(items: readonly number[]): number {
  if (items.length !== SRBAI_ITEMS.length) throw new Error("SRBAI needs four answers");
  for (const n of items) {
    if (!Number.isInteger(n) || n < SRBAI_MIN || n > SRBAI_MAX) throw new Error("Answers run 1 to 7");
  }
  return Math.round((items.reduce((a, b) => a + b, 0) / items.length) * 10) / 10;
}

/**
 * Should the weekly check be offered now? Only for a habit still being
 * built, old enough to have changed, done today (the moment it's freshest),
 * and not checked in the last week.
 */
export function checkDue(habit: {
  status?: string | null;
  startDate: DateKey;
  doneToday: boolean;
  lastCheck: DateKey | null;
}, today: DateKey): boolean {
  if ((habit.status ?? "building") !== "building") return false;
  if (!habit.doneToday) return false;
  if (daysBetween(habit.startDate, today) < FIRST_CHECK_AFTER_DAYS) return false;
  return !habit.lastCheck || daysBetween(habit.lastCheck, today) >= CHECK_EVERY_DAYS;
}

/** Ready to graduate: high, and levelled off. Points oldest first. */
export function readyToGraduate(points: readonly AutomaticityPoint[]): boolean {
  if (points.length < 3) return false;
  const last3 = points.slice(-3).map((p) => p.score);
  const last2 = last3.slice(-2);
  const high = last2.every((s) => s >= GRADUATE_AT);
  const level = Math.max(...last3) - Math.min(...last3) <= PLATEAU_RANGE;
  return high && level;
}

/**
 * Where the habit is on the formation arc, in words that set expectations
 * rather than a finish line: early on, a dip is normal and two months is
 * typical; past that, it's about the curve, not the calendar.
 */
export function formationNote(startDate: DateKey, today: DateKey, latest: number | null): string {
  const day = Math.max(1, daysBetween(startDate, today) + 1);
  if (latest !== null && latest >= GRADUATE_AT) {
    return `Day ${day}. It's feeling automatic — a couple more checks will confirm it.`;
  }
  if (day < 14) return `Day ${day}. Early days: this part takes effort for everyone.`;
  if (day < 60) return `Day ${day}. Most habits take about two months to feel automatic, often longer. A dip around now is normal.`;
  return `Day ${day}. Past the two-month mark — some habits take much longer, and that's normal too.`;
}

export type DayCell = "done" | "minimum" | "rest" | "missed" | "off" | "future" | "before";

/**
 * The habit page's heatmap: `weeks` columns of Monday–Sunday cells ending
 * with the current week. Each cell says what happened that day.
 */
export function heatmap(
  habit: { startDate: DateKey; isDue: (day: DateKey) => boolean },
  logs: { done: ReadonlySet<DateKey>; minimum: ReadonlySet<DateKey>; rest: ReadonlySet<DateKey> },
  today: DateKey,
  weeks = 12
): { weekStart: DateKey; days: { day: DateKey; cell: DayCell }[] }[] {
  const dow = (new Date(`${today}T00:00:00.000Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const thisMonday = addDays(today, -dow);
  const out: { weekStart: DateKey; days: { day: DateKey; cell: DayCell }[] }[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(thisMonday, -7 * w);
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      let cell: DayCell;
      if (day > today) cell = "future";
      else if (day < habit.startDate) cell = "before";
      else if (logs.minimum.has(day)) cell = "minimum";
      else if (logs.done.has(day)) cell = "done";
      else if (logs.rest.has(day)) cell = "rest";
      else if (!habit.isDue(day)) cell = "off";
      else if (day === today) cell = "future";
      else cell = "missed";
      return { day, cell };
    });
    out.push({ weekStart, days });
  }
  return out;
}

export const automaticityCheckSchema = z.object({
  items: z.array(z.number().int().min(SRBAI_MIN).max(SRBAI_MAX)).length(SRBAI_ITEMS.length),
});
