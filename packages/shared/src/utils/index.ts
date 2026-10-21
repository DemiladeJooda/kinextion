import { SCORE_WEIGHTS, MAX_SCORE } from "../constants/index.js";
import type { ScoreBreakdown } from "../types/index.js";
import { localDateKey } from "../habits/dates.js";

export * from "./insights.js";
export * from "./preferences.js";

/**
 * Calculate the Kinextion Score from daily activity breakdown.
 * Score is 0-100, weighted across habits, workouts, mood, reflection, and streaks.
 */
export function calculateKinextionScore(breakdown: ScoreBreakdown): number {
  const habitScore =
    breakdown.habitsTotal > 0
      ? (breakdown.habitsCompleted / breakdown.habitsTotal) *
        SCORE_WEIGHTS.habitsCompletion
      : 0;

  const workoutScore = breakdown.workoutLogged
    ? SCORE_WEIGHTS.workoutLogged
    : 0;

  const moodScore = breakdown.moodCheckedIn ? SCORE_WEIGHTS.moodCheckIn : 0;

  const reflectionScore = breakdown.reflectionDone
    ? SCORE_WEIGHTS.reflection
    : 0;

  const streakBonus = Math.min(
    breakdown.streakDays * 2,
    SCORE_WEIGHTS.streakBonus
  );

  const total = Math.round(
    habitScore + workoutScore + moodScore + reflectionScore + streakBonus
  );

  return Math.min(total, MAX_SCORE);
}

/**
 * The UTC calendar date of `date` as YYYY-MM-DD.
 *
 * Right for values read from a `@db.Date` column (stored as UTC midnight).
 * Wrong for "what day is it for the user" — that's `localDateKey` in
 * ../habits/dates.ts, which knows their time zone.
 */
export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Today as YYYY-MM-DD in this runtime's own time zone — on a phone, the
 * user's. Server code should use `localDateKey(now, request.timeZone)`.
 */
export function today(): string {
  return localDateKey();
}
