/**
 * Logging a habit for a day, with every rule in one place.
 *
 * Used by the log route (a tap, a notification button) and by the guides
 * when someone says "I did my push-ups" in chat — so a log made in
 * conversation follows exactly the same rules as one made with a tap:
 * nothing in the future, yesterday only until noon, one rest day a week.
 */

import { prisma } from "@kinextion/database";
import {
  addDays,
  canRestOn,
  dateFromKey,
  dateKeyOf,
  localDateKey,
  localHour,
  weekStartKey,
} from "@kinextion/shared";

/** Yesterday stays editable until this local hour — long enough to catch a
 *  habit done last night but never ticked, short enough that history stays
 *  history. */
export const BACKFILL_UNTIL_HOUR = 12;

export interface LogDayInput {
  userId: string;
  timeZone: string;
  habitId: string;
  /** The user's own calendar day. */
  date: string;
  state?: "done" | "minimum" | "rest";
  /** Whether the day counts; ignored for a rest day, which never does. */
  completed: boolean;
  notes?: string;
  value?: number;
  source?: "tap" | "notification" | "backfill" | "integration" | "chat";
}

export type LogDayResult =
  | { ok: true; log: Awaited<ReturnType<typeof prisma.habitLog.upsert>>; habitName: string }
  | { ok: false; status: number; error: string };

export async function logHabitDay(input: LogDayInput): Promise<LogDayResult> {
  const { userId, timeZone, habitId, date, notes, value } = input;
  const state = input.state ?? "done";
  const completed = state === "rest" ? false : input.completed;
  const source = input.source ?? "tap";

  /**
   * Nothing can be logged for a day that hasn't started yet. One day of
   * slack, because a client too old to send X-Time-Zone is judged against
   * UTC, and east of Greenwich the user's today is already UTC's tomorrow.
   */
  const today = localDateKey(new Date(), timeZone);
  if (date > addDays(today, 1)) {
    return { ok: false, status: 400, error: "That day hasn't happened yet." };
  }
  if (date < today) {
    const yesterday = addDays(today, -1);
    if (date !== yesterday || localHour(new Date(), timeZone) >= BACKFILL_UNTIL_HOUR) {
      return {
        ok: false,
        status: 400,
        error: "Yesterday can be changed until noon. Earlier days are locked.",
      };
    }
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.userId !== userId) {
    return { ok: false, status: 404, error: "Habit not found" };
  }

  // One planned rest day per habit per week, so rest stays a plan rather
  // than a way around every miss.
  if (state === "rest") {
    const weekStart = weekStartKey(date);
    const rested = await prisma.habitLog.findMany({
      where: {
        userId,
        habitId,
        state: "rest",
        completed: false,
        date: { gte: dateFromKey(weekStart), lte: dateFromKey(addDays(weekStart, 6)) },
      },
      select: { date: true },
    });
    if (!canRestOn(new Set(rested.map((r) => dateKeyOf(r.date))), date)) {
      return { ok: false, status: 400, error: "You've already taken this week's rest day for this habit." };
    }
  }

  const day = dateFromKey(date);
  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date: day } },
    create: {
      habitId,
      userId: habit.userId,
      date: day,
      completed,
      notes,
      state,
      value,
      source: date < today && source === "tap" ? "backfill" : source,
    },
    update: { completed, notes, state, value, loggedAt: new Date() },
  });
  return { ok: true, log, habitName: habit.name };
}
