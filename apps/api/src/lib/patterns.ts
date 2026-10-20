/**
 * Correlates wearable metrics against mood and habit completion to surface
 * real, computed patterns — not guesses. Every insight carries the sample
 * size it was built from, and nothing is returned below MIN_CORRELATION_SAMPLE
 * days of overlap: a thin pattern is worse than no pattern.
 */

import { prisma } from "@kinextion/database";
import { correlateByDate, toDateString, type DailyPoint } from "@kinextion/shared";

export interface PatternInsight {
  metricType: string;
  /** Human-readable, e.g. "Higher sleep_score tends to come with a better mood." */
  summary: string;
  r: number;
  n: number;
}

const METRIC_LABEL: Record<string, string> = {
  sleep_score: "sleep",
  sleep_duration: "sleep duration",
  hrv: "HRV",
  resting_heart_rate: "resting heart rate",
  workout: "workout time",
  steps: "steps",
};

const MIN_ABS_R = 0.35;
const LOOKBACK_DAYS = 60;

/** Correlation threshold worth a mention. Below it, we'd be reading noise as signal. */
function isNotable(r: number): boolean {
  return Math.abs(r) >= MIN_ABS_R;
}

export async function computePatterns(userId: string): Promise<PatternInsight[]> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const [metrics, moodEntries, habitLogs] = await Promise.all([
    prisma.wearableMetric.findMany({ where: { userId, date: { gte: since } } }),
    prisma.moodEntry.findMany({ where: { userId, createdAt: { gte: since } } }),
    prisma.habitLog.findMany({ where: { userId, date: { gte: since } } }),
  ]);

  if (metrics.length === 0) return [];

  // One mood value per day — the latest entry if there were several.
  const moodByDate = new Map<string, number>();
  for (const m of moodEntries) {
    moodByDate.set(toDateString(m.createdAt), m.mood);
  }
  const moodSeries: DailyPoint[] = [...moodByDate.entries()].map(([date, value]) => ({ date, value }));

  // Daily habit completion rate.
  const habitDayTotals = new Map<string, { done: number; total: number }>();
  for (const log of habitLogs) {
    const date = toDateString(log.date);
    const entry = habitDayTotals.get(date) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (log.completed) entry.done += 1;
    habitDayTotals.set(date, entry);
  }
  const habitSeries: DailyPoint[] = [...habitDayTotals.entries()].map(([date, { done, total }]) => ({
    date,
    value: total > 0 ? done / total : 0,
  }));

  // Group wearable metrics by type into daily series.
  const metricsByType = new Map<string, DailyPoint[]>();
  for (const m of metrics) {
    const date = toDateString(m.date);
    const series = metricsByType.get(m.metricType) ?? [];
    series.push({ date, value: m.value });
    metricsByType.set(m.metricType, series);
  }

  const insights: PatternInsight[] = [];

  for (const [metricType, series] of metricsByType) {
    const label = METRIC_LABEL[metricType] ?? metricType;

    const moodCorr = correlateByDate(series, moodSeries);
    if (moodCorr && isNotable(moodCorr.r)) {
      const direction = moodCorr.r > 0 ? "higher" : "lower";
      insights.push({
        metricType,
        r: moodCorr.r,
        n: moodCorr.n,
        summary: `Days with more ${label} tend to come with a ${direction} mood (based on ${moodCorr.n} overlapping days).`,
      });
    }

    const habitCorr = correlateByDate(series, habitSeries);
    if (habitCorr && isNotable(habitCorr.r)) {
      const direction = habitCorr.r > 0 ? "more" : "fewer";
      insights.push({
        metricType,
        r: habitCorr.r,
        n: habitCorr.n,
        summary: `Days with more ${label} tend to come with ${direction} habits completed (based on ${habitCorr.n} overlapping days).`,
      });
    }
  }

  return insights.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
