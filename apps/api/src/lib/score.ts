/**
 * Today's Kinextion Score, computed in one place.
 *
 * Both /api/score/today and the check-in route need this, and an earlier draft
 * of the check-in had its own copy. Two copies of a scoring rule is how the
 * number on the home screen ends up disagreeing with the number returned when
 * you save — and it would also have meant two copies of the streak loop below,
 * which is a known N+1 waiting to be fixed. One implementation, one place to
 * fix it.
 */

import { prisma } from "@kinextion/database";
import { calculateKinextionScore, toDateString } from "@kinextion/shared";

/** How far back a streak is allowed to run before we stop counting. */
const MAX_STREAK_LOOKBACK = 90;

export function startOfToday(): Date {
  return new Date(toDateString(new Date()));
}

/**
 * Walks backwards day by day until it finds one with no completed habit.
 *
 * Known cost: up to 90 sequential queries on every home-screen load. It is
 * left as-is here rather than optimised in passing, because replacing it with
 * one grouped query is a change worth making deliberately and testing on its
 * own — but it now lives in exactly one function, so that change is a one-file
 * change rather than a hunt.
 */
async function computeStreak(userId: string, todayDate: Date): Promise<number> {
  let streakDays = 0;
  const cursor = new Date(todayDate);

  for (let i = 0; i < MAX_STREAK_LOOKBACK; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const dayLogs = await prisma.habitLog.findMany({
      where: { userId, date: new Date(toDateString(cursor)), completed: true },
    });
    if (dayLogs.length === 0) break;
    streakDays++;
  }

  return streakDays;
}

/**
 * Recompute today's score from live data and persist it.
 *
 * Reads *all* of today's mood entries rather than one: the home screen can
 * write a mood-only entry after a full check-in, and reading a single row
 * would then decide reflection wasn't done and quietly take those points back.
 */
export async function recomputeTodayScore(userId: string) {
  const todayDate = startOfToday();

  const [habits, habitLogs, workoutLog, moodEntries] = await Promise.all([
    prisma.habit.findMany({ where: { userId, isActive: true } }),
    prisma.habitLog.findMany({ where: { userId, date: todayDate } }),
    prisma.workoutLog.findFirst({ where: { userId, createdAt: { gte: todayDate } } }),
    prisma.moodEntry.findMany({ where: { userId, createdAt: { gte: todayDate } } }),
  ]);

  const breakdown = {
    habitsCompleted: habitLogs.filter((l: { completed: boolean }) => l.completed).length,
    habitsTotal: habits.length,
    workoutLogged: !!workoutLog,
    moodCheckedIn: moodEntries.length > 0,
    reflectionDone: moodEntries.some(
      (e: { journal: string | null; gratitude: string | null }) => !!(e.journal || e.gratitude)
    ),
    streakDays: await computeStreak(userId, todayDate),
  };

  const overallScore = calculateKinextionScore(breakdown);

  return prisma.kinextionScore.upsert({
    where: { userId_date: { userId, date: todayDate } },
    create: { userId, date: todayDate, overallScore, breakdown },
    update: { overallScore, breakdown },
  });
}

export type ScorePeriod = "weekly" | "monthly" | "yearly";

/** Start of the given period, anchored to `now` — Monday for weekly, the 1st
 *  for monthly and yearly. This is what makes the displayed score "reset":
 *  the average below only ever looks at rows from this date forward. */
function periodStart(period: ScorePeriod, now: Date): Date {
  const d = new Date(now);
  if (period === "weekly") {
    const isoDay = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - isoDay);
  } else if (period === "monthly") {
    d.setDate(1);
  } else {
    d.setMonth(0, 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The score shown on the home screen: an average over the current period
 * rather than a single day, so it reads as a rolling rating (closer to a
 * chess ELO) instead of a total that only ever grows. `recomputeTodayScore`
 * still owns the per-day number this averages over.
 */
export async function computePeriodScore(userId: string, period: ScorePeriod) {
  const start = periodStart(period, new Date());

  const rows = await prisma.kinextionScore.findMany({
    where: { userId, date: { gte: start } },
    orderBy: { date: "asc" },
  });

  const average = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.overallScore, 0) / rows.length)
    : null;

  return {
    period,
    periodStart: toDateString(start),
    average,
    daysLogged: rows.length,
  };
}
