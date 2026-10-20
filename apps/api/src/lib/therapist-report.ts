/**
 * Builds the Therapist Starter Pack summary: real, computed context from
 * what a user has actually tracked in Kinextion, scoped strictly to the
 * categories they've consented to share. Nothing here is inferred beyond
 * the data itself — no diagnosis, no clinical language, just observations
 * a licensed therapist can use to get oriented faster.
 */

import { prisma } from "@kinextion/database";
import { toDateString, type TherapistCategoriesInput } from "@kinextion/shared";
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
  days = 30
): Promise<TherapistReportSummary> {
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const summary: TherapistReportSummary = {
    periodStart: toDateString(periodStart),
    periodEnd: toDateString(periodEnd),
    categories,
  };

  if (categories.habits) {
    const [habits, logs] = await Promise.all([
      prisma.habit.findMany({ where: { userId, isActive: true } }),
      prisma.habitLog.findMany({ where: { userId, date: { gte: periodStart } } }),
    ]);
    const completed = logs.filter((l) => l.completed).length;
    const streaks = new Map<string, number>();
    for (const habit of habits) {
      let streak = 0;
      const cursor = new Date();
      const habitLogs = new Set(
        logs.filter((l) => l.habitId === habit.id && l.completed).map((l) => toDateString(l.date))
      );
      while (habitLogs.has(toDateString(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      streaks.set(habit.id, streak);
    }
    summary.habits = {
      total: habits.length,
      completionRate: logs.length > 0 ? completed / logs.length : 0,
      longestActiveStreak: Math.max(0, ...streaks.values()),
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
