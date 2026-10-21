/**
 * Pausing and restarting a habit without punishing the pause.
 *
 * "Pause it for now" is one of the changes "What would it take?" can
 * suggest, and it has to mean what it says: while paused, a habit isn't due,
 * isn't in the score and gets no reminders. And when it restarts, the days
 * spent paused mustn't show up as a run of misses — so each scheduled day in
 * the pause is written as a neutral rest day, which streaks and consistency
 * already skip. A day actually logged during the pause is left alone.
 */

import { prisma } from "@kinextion/database";
import { addDays, dateFromKey, dateKeyOf, isDueOn, type DateKey } from "@kinextion/shared";

/** Never backfill more than this, whatever pausedOn says. */
const MAX_PAUSE_BACKFILL_DAYS = 120;

interface StatusHabit {
  id: string;
  userId: string;
  status: string;
  pausedOn: Date | null;
  frequency: string;
  targetDays: unknown;
  perWeekTarget: number | null;
}

/**
 * Extra fields to write alongside a status change, after writing any rest
 * days the pause needs. Returns {} when the status isn't changing.
 */
export async function statusSideEffects(
  habit: StatusHabit,
  next: string | undefined,
  today: DateKey
): Promise<{ pausedOn?: Date | null }> {
  if (!next || next === habit.status) return {};

  if (next === "paused") return { pausedOn: dateFromKey(today) };

  if (habit.status === "paused") {
    const yesterday = addDays(today, -1);
    let from = habit.pausedOn ? dateKeyOf(habit.pausedOn) : today;
    const floor = addDays(today, -MAX_PAUSE_BACKFILL_DAYS);
    if (from < floor) from = floor;

    const days: DateKey[] = [];
    if (habit.frequency !== "weekly") {
      for (let d = from; d <= yesterday; d = addDays(d, 1)) {
        if (isDueOn(habit, d, new Set())) days.push(d);
      }
    }
    if (days.length) {
      await prisma.habitLog.createMany({
        data: days.map((d) => ({
          habitId: habit.id,
          userId: habit.userId,
          date: dateFromKey(d),
          completed: false,
          state: "rest",
          source: "pause",
        })),
        skipDuplicates: true,
      });
    }
    return { pausedOn: null };
  }

  return {};
}
