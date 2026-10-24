/**
 * The plan's success measures over the last `days` days, from the database.
 * Shared by the `habit:metrics` script and the admin route. Counts and rates
 * only: no names, no habit text, nothing anyone wrote.
 */

import { prisma } from "@kinextion/database";
import { addDays, dateKeyOf, habitMetrics, localDateKey, type HabitMetrics } from "@kinextion/shared";

export async function loadHabitMetrics(days = 28): Promise<HabitMetrics> {
  const to = addDays(localDateKey(), -1); // through yesterday: today isn't over
  const from = addDays(to, -(days - 1));
  const lookback = new Date(`${addDays(from, -70)}T00:00:00Z`);

  const [habits, logs, checks] = await Promise.all([
    prisma.habit.findMany({
      select: {
        id: true,
        userId: true,
        frequency: true,
        targetDays: true,
        perWeekTarget: true,
        createdAt: true,
        startsOn: true,
        cue: true,
        response: true,
        isActive: true,
      },
    }),
    prisma.habitLog.findMany({
      where: { date: { gte: lookback } },
      select: { habitId: true, userId: true, date: true, completed: true, state: true, source: true },
    }),
    prisma.automaticityCheck.findMany({ select: { habitId: true, date: true, score: true } }),
  ]);

  return habitMetrics(
    habits.map((h) => ({
      id: h.id,
      userId: h.userId,
      frequency: h.frequency,
      targetDays: h.targetDays,
      perWeekTarget: h.perWeekTarget,
      startDate: dateKeyOf(h.startsOn ?? h.createdAt),
      hasAnchor: Boolean(h.cue?.trim()),
      hasTiny: Boolean(h.response?.trim()),
      isActive: h.isActive,
    })),
    logs.map((l) => ({ ...l, date: dateKeyOf(l.date) })),
    checks.map((c) => ({ ...c, date: dateKeyOf(c.date) })),
    from,
    to
  );
}
