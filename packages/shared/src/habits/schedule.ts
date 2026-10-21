/**
 * When a habit is due, and how well it has been kept.
 *
 * This is the one implementation. It replaces three streak loops (the phone,
 * the score, the therapist report) that each counted differently, and the
 * first code anywhere to read `frequency` / `targetDays` — before this, a
 * Mon/Wed/Fri habit showed every day and lost its streak every Tuesday.
 *
 * Schedules, as stored today:
 *   daily  — every day.
 *   custom — the weekdays in `targetDays` (0 = Sunday). No days picked
 *            behaves like daily rather than never.
 *   weekly — X times per week (Mon–Sun; `perWeekTarget`, default once), on
 *            whichever days suit. It's due each day until the week's target
 *            is met, then rests until Monday.
 *
 * Everything here is pure: callers pass completed dates as `DateKey`s and the
 * user's own "today", so the same answers come out on the phone, the server
 * and in tests.
 */

import { addDays, dayOfWeek, weekStartKey, type DateKey } from "./dates.js";

export interface ScheduledHabit {
  frequency: string;
  targetDays?: unknown;
  /** First day the habit can be due — its creation date in the user's zone.
   *  Days before it are never counted as misses. */
  startDate?: DateKey | null;
  /** Weekly habits only: times per week. Null or missing means once. */
  perWeekTarget?: number | null;
}

function weeklyTarget(habit: ScheduledHabit): number {
  const n = habit.perWeekTarget ?? 1;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 7) : 1;
}

/** How far back a walk is allowed to go. Two years is beyond any real streak
 *  the app can see, and keeps a corrupt row from looping forever. */
const MAX_LOOKBACK_DAYS = 730;

export function normalizeTargetDays(targetDays: unknown): number[] {
  if (!Array.isArray(targetDays)) return [];
  return [...new Set(targetDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))];
}

function isWeekly(habit: ScheduledHabit): boolean {
  return habit.frequency === "weekly";
}

/** Fixed-day schedules: does this weekday ever carry the habit? */
function isPlannedOn(habit: ScheduledHabit, key: DateKey): boolean {
  if (habit.startDate && key < habit.startDate) return false;
  if (habit.frequency !== "custom") return true;
  const days = normalizeTargetDays(habit.targetDays);
  return days.length === 0 || days.includes(dayOfWeek(key));
}

/**
 * Should this habit appear on `key`'s list and count toward that day?
 *
 * Weekly habits need the completions: once the week's target is met they're
 * not due for the rest of it — but the day that met it still shows them, done.
 */
export function isDueOn(habit: ScheduledHabit, key: DateKey, completed: ReadonlySet<DateKey>): boolean {
  if (habit.startDate && key < habit.startDate) return false;
  if (!isWeekly(habit)) return isPlannedOn(habit, key);

  if (completed.has(key)) return true;
  let doneThisWeek = 0;
  for (let d = weekStartKey(key); d < key; d = addDays(d, 1)) {
    if (completed.has(d)) doneThisWeek++;
  }
  return doneThisWeek < weeklyTarget(habit);
}

/** Short human description — "Every day", "Mon · Wed · Fri", "Once a week". */
export function describeSchedule(habit: ScheduledHabit): string {
  if (isWeekly(habit)) {
    const n = weeklyTarget(habit);
    return n === 1 ? "Once a week" : `${n} times a week`;
  }
  if (habit.frequency !== "custom") return "Every day";
  const days = normalizeTargetDays(habit.targetDays).sort();
  if (days.length === 0 || days.length === 7) return "Every day";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Monday-first reads the way people plan a week.
  return [...days.filter((d) => d !== 0), ...days.filter((d) => d === 0)].map((d) => names[d]).join(" · ");
}

interface Occurrence {
  key: DateKey;
  done: boolean;
}

/**
 * Every occasion the habit was due from `from` to `today`, oldest first. For
 * weekly habits an occasion is a week; for the rest, a scheduled day.
 *
 * Today (or this week) is left out while it's still open and not done yet —
 * an unticked habit at 9am hasn't been missed, so it must neither extend nor
 * break anything.
 */
function occurrences(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  today: DateKey
): Occurrence[] {
  const start = habit.startDate && habit.startDate > from ? habit.startDate : from;
  const out: Occurrence[] = [];

  if (isWeekly(habit)) {
    const thisWeek = weekStartKey(today);
    const target = weeklyTarget(habit);
    for (let week = weekStartKey(start); week <= thisWeek; week = addDays(week, 7)) {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(week, i);
        if (d > today) break;
        if (completed.has(d)) count++;
      }
      const done = count >= target;
      if (week === thisWeek && !done) continue;
      out.push({ key: week, done });
    }
    return out;
  }

  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isPlannedOn(habit, d)) continue;
    const done = completed.has(d);
    if (d === today && !done) continue;
    out.push({ key: d, done });
  }
  return out;
}

/** Earliest day worth walking from: the start date, else the oldest log. */
function walkStart(habit: ScheduledHabit, completed: ReadonlySet<DateKey>, today: DateKey): DateKey {
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  let earliest = habit.startDate ?? today;
  for (const d of completed) if (d < earliest) earliest = d;
  return earliest < floor ? floor : earliest;
}

export interface HabitProgress {
  /** Consecutive kept occasions ending at the latest one. Days for daily and
   *  custom habits, weeks for weekly ones. */
  streak: number;
  /** Longest run inside the history passed in. */
  bestStreak: number;
  /** Kept ÷ due over the history passed in, or null before anything was due. */
  consistency: number | null;
  /** "day" or "week" — what one unit of `streak` means. */
  unit: "day" | "week";
}

export function habitProgress(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  today: DateKey
): HabitProgress {
  const occ = occurrences(habit, completed, walkStart(habit, completed, today), today);

  let best = 0;
  let run = 0;
  let kept = 0;
  for (const o of occ) {
    if (o.done) {
      run++;
      kept++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return {
    streak: run,
    bestStreak: best,
    consistency: occ.length ? kept / occ.length : null,
    unit: isWeekly(habit) ? "week" : "day",
  };
}

/** Occasions kept and occasions due between two dates (inclusive). Missed
 *  days count even though they have no log row — that's the point. */
export function tallyBetween(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  to: DateKey
): { kept: number; due: number } {
  const occ = occurrences(habit, completed, from, to);
  return { kept: occ.filter((o) => o.done).length, due: occ.length };
}

/** Kept ÷ due between two dates (inclusive), or null if nothing was due. */
export function consistencyBetween(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  to: DateKey
): number | null {
  const { kept, due } = tallyBetween(habit, completed, from, to);
  return due ? kept / due : null;
}

export interface DayHabit extends ScheduledHabit {
  id: string;
}

/**
 * The habit half of one day's score: how many habits were due that day and
 * how many of those were done. A habit done on a day it wasn't due is a
 * bonus, not extra credit — counting it would let the total exceed 100%.
 */
export function habitTotalsForDay(
  habits: readonly DayHabit[],
  completedByHabit: ReadonlyMap<string, ReadonlySet<DateKey>>,
  day: DateKey
): { habitsTotal: number; habitsCompleted: number } {
  let habitsTotal = 0;
  let habitsCompleted = 0;
  const none: ReadonlySet<DateKey> = new Set();
  for (const habit of habits) {
    const completed = completedByHabit.get(habit.id) ?? none;
    if (!isDueOn(habit, day, completed)) continue;
    habitsTotal++;
    if (completed.has(day)) habitsCompleted++;
  }
  return { habitsTotal, habitsCompleted };
}

/**
 * The score's "showing up" streak: consecutive days, ending yesterday, on
 * which at least one habit was done. A day when nothing was scheduled at all
 * (a rest day for every custom habit) is skipped rather than counted as a
 * break — nobody should lose a streak to their own plan.
 */
export function showingUpStreak(
  habits: readonly ScheduledHabit[],
  activeDays: ReadonlySet<DateKey>,
  today: DateKey,
  maxDays = 90
): number {
  let streak = 0;
  for (let i = 1; i <= maxDays; i++) {
    const day = addDays(today, -i);
    if (activeDays.has(day)) {
      streak++;
      continue;
    }
    // Weekly habits never make a single day mandatory, so only fixed-day
    // schedules can turn an empty day into a break.
    const anythingPlanned = habits.some((h) => !isWeekly(h) && isPlannedOn(h, day));
    if (anythingPlanned) break;
  }
  return streak;
}
