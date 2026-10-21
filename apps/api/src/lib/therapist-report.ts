/**
 * Builds the Therapist Starter Pack summary: real, computed context from
 * what a user has actually tracked in Kinextion, scoped strictly to the
 * categories they've consented to share. Nothing here is inferred beyond
 * the data itself — no diagnosis, no clinical language, just observations
 * a licensed therapist can use to get oriented faster.
 */

import { prisma } from "@kinextion/database";
import {
  addDays,
  dateFromKey,
  habitProgress,
  localDateKey,
  tallyBetween,
  toDateString,
  type TherapistCategoriesInput,
} from "@kinextion/shared";
import { completedByHabit, toScheduled } from "./score.js";
import { computePatterns } from "./patterns.js";

export type TherapistShareCategories = TherapistCategoriesInput;

export const EMPTY_CATEGORIES: TherapistShareCategories = {
  habits: false,
  moodTrends: false,
  journalExcerpts: false,
  patterns: false,
  score: false,
};

export interface TherapistReportSummary {
  periodStart: string;
  periodEnd: string;
  categories: TherapistShareCategories;
  habits?: {
    total: number;
    completionRate: number; // 0..1 over the period
    longestActiveStreak: number;
  };
  moodTrends?: {
    entries: number;
    averageMood: number | null;
    averageEnergy: number | null;
    averageStress: number | null;
    commonTags: string[];
  };
  journalExcerpts?: Array<{ date: string; journal?: string; gratitude?: string }>;
  patterns?: string[];
  score?: {
    average: number | null;
    trend: "up" | "down" | "flat" | "not_enough_data";
  };
}

export async function buildTherapistReport(
  userId: string,
  categories: TherapistShareCategories,
  days = 30,
  timeZone = "UTC"
): Promise<TherapistReportSummary> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);
  const endKey = localDateKey(periodEnd, timeZone);
  const startKey = addDays(endKey, -days);

  const summary: TherapistReportSummary = {
    periodStart: startKey,
    periodEnd: endKey,
    categories,
  };

  if (categories.habits) {
    // Logs reach back further than the period so a streak that started
    // before it is still counted in full.
    const [habits, logs] = await Promise.all([
      prisma.habit.findMany({ where: { userId, isActive: true } }),
      prisma.habitLog.findMany({
        where: { userId, completed: true, date: { gte: dateFromKey(addDays(startKey, -90)) } },
        select: { habitId: true, date: true, completed: true },
      }),
    ]);
    const byHabit = completedByHabit(logs);

    /**
     * Rate = kept ÷ due across every habit's own schedule. The old version
     * divided by logged rows, and a missed day has no row — so a habit kept
     * three days out of thirty read as 100%. A therapist is the last person
     * who should be shown a flattering number.
     */
    let kept = 0;
    let due = 0;
    let longest = 0;
    for (const habit of habits) {
      const scheduled = toScheduled(habit, timeZone);
      const completed = byHabit.get(habit.id) ?? new Set<string>();
      const tally = tallyBetween(scheduled, completed, startKey, endKey);
      kept += tally.kept;
      due += tally.due;
      longest = Math.max(longest, habitProgress(scheduled, completed, endKey).streak);
    }

    summary.habits = {
      total: habits.length,
      completionRate: due > 0 ? kept / due : 0,
      longestActiveStreak: longest,
    };
  }

  if (categories.moodTrends || categories.journalExcerpts) {
    const entries = await prisma.moodEntry.findMany({
      where: { userId, createdAt: { gte: periodStart } },
      orderBy: { createdAt: "asc" },
    });

    if (categories.moodTrends) {
      const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
      const tagCounts = new Map<string, number>();
      for (const e of entries) {
        for (const tag of (e.tags as string[] | null) ?? []) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      summary.moodTrends = {
        entries: entries.length,
        averageMood: avg(entries.map((e) => e.mood)),
        averageEnergy: avg(entries.filter((e) => e.energy != null).map((e) => e.energy as number)),
        averageStress: avg(entries.filter((e) => e.stress != null).map((e) => e.stress as number)),
        commonTags: [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => tag),
      };
    }

    if (categories.journalExcerpts) {
      summary.journalExcerpts = entries
        .filter((e) => e.journal || e.gratitude)
        .map((e) => ({
          date: toDateString(e.createdAt),
          journal: e.journal ?? undefined,
          gratitude: e.gratitude ?? undefined,
        }));
    }
  }

  if (categories.patterns) {
    const patterns = await computePatterns(userId);
    summary.patterns = patterns.map((p) => p.summary);
  }

  if (categories.score) {
    const scores = await prisma.kinextionScore.findMany({
      where: { userId, date: { gte: periodStart } },
      orderBy: { date: "asc" },
    });
    const values = scores.map((s) => s.overallScore);
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

    let trend: "up" | "down" | "flat" | "not_enough_data" = "not_enough_data";
    if (values.length >= 6) {
      const mid = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
      const delta = secondHalf - firstHalf;
      trend = Math.abs(delta) < 3 ? "flat" : delta > 0 ? "up" : "down";
    }

    summary.score = { average, trend };
  }

  return summary;
}
