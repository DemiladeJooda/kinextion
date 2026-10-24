/**
 * What the guides know about the user's habits, for every chat turn.
 *
 * Before this, Altheo and Kairo were told the user's profile, mood, patterns
 * and remembered facts, but nothing about their habits — the product's core
 * loop. A guide that can't see that you skipped your walk twice, or what you
 * said would make it easier, can't coach. This builds a short, factual
 * section from the same shared logic the app uses, so the guide and the
 * Today screen never disagree.
 *
 * Text comes from the AI-tidied reading where there is one (polish.ts). A why
 * that read as distress is never included — only a note that something
 * sounded heavy, so the guide can check in without quoting it.
 */

import { prisma } from "@kinextion/database";
import {
  addDays,
  consistencyBetween,
  dateFromKey,
  dateKeyOf,
  describeHabitPlan,
  describeSchedule,
  displayFields,
  habitProgress,
  isDueOn,
  localDateKey,
} from "@kinextion/shared";
import { habitLogMaps, STREAK_LOG_FILTER, toScheduled } from "./score.js";

const CATEGORY = { physical: "Body", mental: "Mind", emotional: "Heart", spiritual: "Spirit" } as const;
const MAX_HABITS = 8;

export interface HabitsForChat {
  identityGoal: string | null;
  lines: string[];
}

export async function habitsForChat(
  userId: string,
  timeZone: string,
  identityGoal: string | null
): Promise<HabitsForChat> {
  const today = localDateKey(new Date(), timeZone);
  const [habits, logs, reflections, promises] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: MAX_HABITS,
    }),
    prisma.habitLog.findMany({
      where: { userId, ...STREAK_LOG_FILTER, date: { gte: dateFromKey(addDays(today, -60)) } },
      select: { habitId: true, date: true, completed: true, state: true },
    }),
    prisma.habitReflection.findMany({
      where: { userId, answer: { not: "" }, date: { gte: dateFromKey(addDays(today, -14)) } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.precommitment.findMany({
      where: { userId, forDate: dateFromKey(today) },
    }),
  ]);

  const maps = habitLogMaps(logs);
  const none = new Set<string>();
  const lines: string[] = [];

  for (const h of habits) {
    const scheduled = toScheduled(h, timeZone);
    const done = maps.completed.get(h.id) ?? none;
    const rest = maps.rest.get(h.id) ?? none;
    const shown = displayFields(h);
    const progress = habitProgress(scheduled, done, today, rest);
    const kept30 = consistencyBetween(scheduled, done, addDays(today, -29), today, rest);
    const plan = describeHabitPlan({ name: h.name, cue: shown.cue, response: shown.response }).plan;

    const todayState =
      h.status === "paused"
        ? "paused"
        : maps.minimum.get(h.id)?.has(today)
          ? "did the tiny version today"
          : done.has(today)
            ? "done today"
            : rest.has(today)
              ? "rest day today"
              : isDueOn(scheduled, today, done)
                ? "not done yet today"
                : "not scheduled today";

    const parts = [
      `- ${h.name} (${CATEGORY[h.category as keyof typeof CATEGORY] ?? h.category}, ${describeSchedule(h).toLowerCase()}${h.status === "established" ? ", graduated — automatic now" : ""})`,
      `plan: ${plan}`,
      todayState,
      progress.streak
        ? `${progress.streak}-${progress.unit} streak${progress.atRisk ? ", missed last time" : ""}`
        : "no current streak",
      kept30 === null ? null : `kept ${Math.round(kept30 * 100)}% of the last 30 days`,
      `id ${h.id}`,
    ].filter(Boolean);
    lines.push(parts.join("; "));

    if (shown.craving) lines.push(`  why it matters to them: ${shown.craving}`);
    if (shown.backupPlan) lines.push(`  their backup plan: ${shown.backupPlan}`);
    if (shown.concern) {
      lines.push(
        "  something they wrote about why this matters read as distress — never quote it; if it fits, gently check in"
      );
    }
  }

  const byId = new Map(habits.map((h) => [h.id, h.name]));
  for (const p of promises) {
    const name = byId.get(p.habitId);
    if (name) lines.push(`- They promised for today: ${p.text}`);
  }
  for (const r of reflections) {
    const name = byId.get(r.habitId);
    if (name) {
      lines.push(
        `- After missing ${name} on ${dateKeyOf(r.date)}, asked what would make it easier, they said: "${r.answer}"`
      );
    }
  }

  return { identityGoal, lines };
}
