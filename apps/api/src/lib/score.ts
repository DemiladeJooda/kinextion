/**
 * Today's Kinextion Score, computed in one place.
 *
 * Both /api/score/today and the check-in route need this, and an earlier draft
 * of the check-in had its own copy. Two copies of a scoring rule is how the
 * number on the home screen ends up disagreeing with the number returned when
 * you save. One implementation, one place to fix it.
 *
 * "Today" is the user's today: every function here takes their IANA zone
 * (from the X-Time-Zone header, see plugins/time-zone.ts). Before that, the
 * day rolled over at UTC midnight — 7pm in Dallas.
 */

import { prisma } from "@kinextion/database";
import {
  addDays,
  calculateKinextionScore,
  dateFromKey,
  dateKeyOf,
  dayStartInstant,
  habitTotalsForDay,
  localDateKey,
  showingUpStreak,
  type DateKey,
} from "@kinextion/shared";

/** How far back a streak is allowed to run before we stop counting. */
const MAX_STREAK_LOOKBACK = 90;

/**
 * The instant the user's day began — the lower bound for "created today" on
 * timestamp columns (mood entries, recommendations).
 */
export function startOfToday(timeZone = "UTC"): Date {
  return dayStartInstant(localDateKey(new Date(), timeZone), timeZone);
}

/** Habits as the shared schedule module wants them: with a start date in the
 *  user's own zone, so the day a habit was created is its first due day. */
export function toScheduled<T extends { createdAt: Date }>(habit: T, timeZone: string) {
  return { ...habit, startDate: localDateKey(habit.createdAt, timeZone) };
}

type LogRow = { habitId: string; date: Date; completed: boolean; state?: string | null };

function add(map: Map<string, Set<DateKey>>, habitId: string, key: DateKey) {
  const set = map.get(habitId);
  if (set) set.add(key);
  else map.set(habitId, new Set([key]));
}

/**
 * Log dates grouped by habit, three ways: days that count (done or minimum),
 * planned rest days, and the subset of counted days that were the minimum.
 */
export function habitLogMaps(logs: LogRow[]) {
  const completed = new Map<string, Set<DateKey>>();
  const rest = new Map<string, Set<DateKey>>();
  const minimum = new Map<string, Set<DateKey>>();
  for (const log of logs) {
    const key = dateKeyOf(log.date);
    if (log.completed) {
      add(completed, log.habitId, key);
      if (log.state === "minimum") add(minimum, log.habitId, key);
    } else if (log.state === "rest") {
      add(rest, log.habitId, key);
    }
  }
  return { completed, rest, minimum };
}

/** Completed (done or minimum) log dates grouped by habit. */
export function completedByHabit(logs: LogRow[]) {
  return habitLogMaps(logs).completed;
}

/** Every log row that matters to a streak: kept days and rest days. */
export const STREAK_LOG_FILTER = { OR: [{ completed: true }, { state: "rest" }] };

/**
 * Recompute today's score from live data and persist it.
 *
 * One query for 90 days of completed logs feeds both today's habit totals and
 * the streak — the old version walked back a day at a time, up to 90
 * sequential queries per home-screen load.
 *
 * Reads *all* of today's mood entries rather than one: the home screen can
 * write a mood-only entry after a full check-in, and reading a single row
 * would then decide reflection wasn't done and quietly take those points back.
 */
export async function recomputeTodayScore(userId: string, timeZone = "UTC") {
  const today = localDateKey(new Date(), timeZone);
  const todayDate = dateFromKey(today);
  const dayStart = dayStartInstant(today, timeZone);

  const [habits, recentLogs, workoutLog, moodEntries] = await Promise.all([
    prisma.habit.findMany({ where: { userId, isActive: true } }),
    prisma.habitLog.findMany({
      where: {
        userId,
        ...STREAK_LOG_FILTER,
        date: { gte: dateFromKey(addDays(today, -MAX_STREAK_LOOKBACK)), lte: todayDate },
      },
      select: { habitId: true, date: true, completed: true, state: true },
    }),
    prisma.workoutLog.findFirst({ where: { userId, createdAt: { gte: dayStart } } }),
    prisma.moodEntry.findMany({ where: { userId, createdAt: { gte: dayStart } } }),
  ]);

  const scheduled = habits.map((h) => toScheduled(h, timeZone));
  const maps = habitLogMaps(recentLogs);
  const activeDays = new Set(recentLogs.filter((l) => l.completed).map((l) => dateKeyOf(l.date)));
  const restDays = new Set(recentLogs.filter((l) => !l.completed).map((l) => dateKeyOf(l.date)));

  const breakdown = {
    ...habitTotalsForDay(scheduled, maps.completed, today, {
      restByHabit: maps.rest,
      minimumByHabit: maps.minimum,
    }),
    workoutLogged: !!workoutLog,
    moodCheckedIn: moodEntries.length > 0,
    reflectionDone: moodEntries.some(
      (e: { journal: string | null; gratitude: string | null }) => !!(e.journal || e.gratitude)
    ),
    streakDays: showingUpStreak(scheduled, activeDays, today, MAX_STREAK_LOOKBACK, restDays),
  };

  const overallScore = calculateKinextionScore(breakdown);

  return prisma.kinextionScore.upsert({
    where: { userId_date: { userId, date: todayDate } },
    create: { userId, date: todayDate, overallScore, breakdown },
    update: { overallScore, breakdown },
  });
}

export type ScorePeriod = "weekly" | "monthly" | "yearly";

/** Start of the given period on the user's calendar — Monday for weekly, the
 *  1st for monthly and yearly. This is what makes the displayed score
 *  "reset": the average below only ever looks at rows from this date on. */
function periodStart(period: ScorePeriod, today: DateKey): DateKey {
  if (period === "weekly") {
    const isoDay = (dateFromKey(today).getUTCDay() + 6) % 7; // 0 = Monday
    return addDays(today, -isoDay);
  }
  if (period === "monthly") return `${today.slice(0, 7)}-01`;
  return `${today.slice(0, 4)}-01-01`;
}

/**
 * The score shown on the home screen: an average over the current period
 * rather than a single day, so it reads as a rolling rating (closer to a
 * chess ELO) instead of a total that only ever grows. `recomputeTodayScore`
 * still owns the per-day number this averages over.
 */
export async function computePeriodScore(userId: string, period: ScorePeriod, timeZone = "UTC") {
  const start = periodStart(period, localDateKey(new Date(), timeZone));

  const rows = await prisma.kinextionScore.findMany({
    where: { userId, date: { gte: dateFromKey(start) } },
    orderBy: { date: "asc" },
  });

  const average = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.overallScore, 0) / rows.length)
    : null;

  return {
    period,
    periodStart: start,
    average,
    daysLogged: rows.length,
  };
}
