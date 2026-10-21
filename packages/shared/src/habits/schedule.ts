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
 * break anything. A planned rest day is left out entirely: it's neutral, not
 * a miss and not a keep.
 */
function occurrences(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  today: DateKey,
  rest: ReadonlySet<DateKey> = EMPTY
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
    if (!done && rest.has(d)) continue;
    if (d === today && !done) continue;
    out.push({ key: d, done });
  }
  return out;
}

const EMPTY: ReadonlySet<DateKey> = new Set();

/** Earliest day worth walking from: the start date, else the oldest log. */
function walkStart(habit: ScheduledHabit, completed: ReadonlySet<DateKey>, today: DateKey): DateKey {
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  let earliest = habit.startDate ?? today;
  for (const d of completed) if (d < earliest) earliest = d;
  return earliest < floor ? floor : earliest;
}

/** Streak freezes available per calendar month, used automatically. */
export const STREAK_FREEZES_PER_MONTH = 1;

export interface HabitProgress {
  /** Kept occasions in the current run. Days for daily and custom habits,
   *  weeks for weekly ones. A forgiven miss doesn't add to it. */
  streak: number;
  /** Longest run inside the history passed in. */
  bestStreak: number;
  /** Kept ÷ due over the history passed in, or null before anything was due.
   *  Rest days aren't due. */
  consistency: number | null;
  /** "day" or "week" — what one unit of `streak` means. */
  unit: "day" | "week";
  /**
   * The streak is alive but its latest occasion was missed: doing the next
   * one saves it. Shown as "save your streak", never as "you broke it".
   */
  atRisk: boolean;
  /** Today's (or this week's) keep started a new run after a streak ended. */
  comeback: boolean;
}

/**
 * Streaks that survive a bad day.
 *
 *   - Done and "did the minimum" both count.
 *   - A planned rest day is neutral.
 *   - Never miss twice: one missed occasion puts the streak at risk instead
 *     of ending it. The next keep saves it.
 *   - A second miss in a row ends it, unless a streak freeze covers it — one
 *     a month, applied automatically.
 *
 * Why: missing a single day barely affects habit formation (Lally et al.
 * 2010), while showing someone a broken streak makes them drop off, and
 * that drop is smaller when a streak can be repaired (Silverman & Barasch
 * 2023). Coming back after a miss is the behaviour worth rewarding
 * (Milkman et al. 2021), so it's tracked as `comeback`.
 */
export function habitProgress(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  today: DateKey,
  rest: ReadonlySet<DateKey> = EMPTY
): HabitProgress {
  const occ = occurrences(habit, completed, walkStart(habit, completed, today), today, rest);

  let run = 0;
  let best = 0;
  let kept = 0;
  let missesInARow = 0;
  let everBroke = false;
  let runStartedAfterBreak = false;
  const freezesUsed = new Map<string, number>();

  for (const o of occ) {
    if (o.done) {
      if (run === 0) runStartedAfterBreak = everBroke;
      run++;
      kept++;
      missesInARow = 0;
      if (run > best) best = run;
      continue;
    }

    missesInARow++;
    if (run === 0) continue; // nothing to lose
    if (missesInARow === 1) continue; // never miss twice: the first is forgiven

    const month = o.key.slice(0, 7);
    const used = freezesUsed.get(month) ?? 0;
    if (used < STREAK_FREEZES_PER_MONTH) {
      freezesUsed.set(month, used + 1);
      continue;
    }

    run = 0;
    everBroke = true;
  }

  const last = occ[occ.length - 1];
  const current = isWeekly(habit) ? weekStartKey(today) : today;

  return {
    streak: run,
    bestStreak: best,
    consistency: occ.length ? kept / occ.length : null,
    unit: isWeekly(habit) ? "week" : "day",
    atRisk: run > 0 && missesInARow > 0,
    comeback: run === 1 && runStartedAfterBreak && !!last?.done && last.key === current,
  };
}

/** Occasions kept and occasions due between two dates (inclusive). Missed
 *  days count even though they have no log row — that's the point. Rest
 *  days don't count either way. */
export function tallyBetween(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  to: DateKey,
  rest: ReadonlySet<DateKey> = EMPTY
): { kept: number; due: number } {
  const occ = occurrences(habit, completed, from, to, rest);
  return { kept: occ.filter((o) => o.done).length, due: occ.length };
}

/** Kept ÷ due between two dates (inclusive), or null if nothing was due. */
export function consistencyBetween(
  habit: ScheduledHabit,
  completed: ReadonlySet<DateKey>,
  from: DateKey,
  to: DateKey,
  rest: ReadonlySet<DateKey> = EMPTY
): number | null {
  const { kept, due } = tallyBetween(habit, completed, from, to, rest);
  return due ? kept / due : null;
}

export interface DayHabit extends ScheduledHabit {
  id: string;
}

/** Share of a habit's score points earned by doing only the tiny version.
 *  Full streak credit, most of the score: the minimum should always be
 *  worth doing, and the full version still worth more. A design judgement. */
export const MINIMUM_SCORE_CREDIT = 0.75;

/**
 * The habit half of one day's score: how many habits were due that day and
 * how many of those were done. A habit done on a day it wasn't due is a
 * bonus, not extra credit — counting it would let the total exceed 100%.
 * A rest day leaves the denominator; a minimum earns MINIMUM_SCORE_CREDIT.
 */
export function habitTotalsForDay(
  habits: readonly DayHabit[],
  completedByHabit: ReadonlyMap<string, ReadonlySet<DateKey>>,
  day: DateKey,
  options: {
    restByHabit?: ReadonlyMap<string, ReadonlySet<DateKey>>;
    minimumByHabit?: ReadonlyMap<string, ReadonlySet<DateKey>>;
  } = {}
): { habitsTotal: number; habitsCompleted: number } {
  let habitsTotal = 0;
  let habitsCompleted = 0;
  for (const habit of habits) {
    const completed = completedByHabit.get(habit.id) ?? EMPTY;
    if (!isDueOn(habit, day, completed)) continue;
    if (!completed.has(day) && options.restByHabit?.get(habit.id)?.has(day)) continue;
    habitsTotal++;
    if (completed.has(day)) {
      habitsCompleted += options.minimumByHabit?.get(habit.id)?.has(day) ? MINIMUM_SCORE_CREDIT : 1;
    }
  }
  return { habitsTotal, habitsCompleted: Math.round(habitsCompleted * 100) / 100 };
}

/**
 * The score's "showing up" streak: consecutive days, ending yesterday, on
 * which at least one habit was done. A day when nothing was scheduled at all
 * (a rest day for every custom habit), or a day the user rested, is skipped
 * rather than counted as a break — nobody should lose a streak to their own
 * plan.
 */
export function showingUpStreak(
  habits: readonly ScheduledHabit[],
  activeDays: ReadonlySet<DateKey>,
  today: DateKey,
  maxDays = 90,
  restDays: ReadonlySet<DateKey> = EMPTY
): number {
  let streak = 0;
  for (let i = 1; i <= maxDays; i++) {
    const day = addDays(today, -i);
    if (activeDays.has(day)) {
      streak++;
      continue;
    }
    if (restDays.has(day)) continue;
    // Weekly habits never make a single day mandatory, so only fixed-day
    // schedules can turn an empty day into a break.
    const anythingPlanned = habits.some((h) => !isWeekly(h) && isPlannedOn(h, day));
    if (anythingPlanned) break;
  }
  return streak;
}

/**
 * Can a rest day be taken on `day`? One per habit per week (Mon–Sun), so rest
 * stays a plan rather than a way around every miss. A design judgement.
 */
export const REST_DAYS_PER_WEEK = 1;

export function canRestOn(rest: ReadonlySet<DateKey>, day: DateKey): boolean {
  const start = weekStartKey(day);
  let used = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d !== day && rest.has(d)) used++;
  }
  return used < REST_DAYS_PER_WEEK;
}
