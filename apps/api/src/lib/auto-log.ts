/**
 * Habits that log themselves from a connected service.
 *
 * After a sync, any habit linked to that service ("Evening walk ← any
 * Strava activity") is logged for today and yesterday when the reading
 * counts. It never overwrites something the user logged or undid: a day
 * that already has a row is theirs. Logs are marked source "integration"
 * with a note naming the service, so the app shows where each one came from.
 */

import { prisma } from "@kinextion/database";
import {
  PROVIDER_LABEL,
  addDays,
  autoLogDecision,
  autoLogSchema,
  dateFromKey,
  localDateKey,
} from "@kinextion/shared";

export interface AutoLogged {
  habitId: string;
  habitName: string;
  date: string;
  state: "done" | "minimum";
  /** "Strava: 32 min". */
  detail: string;
}

export async function autoLogFromMetrics(
  userId: string,
  timeZone: string,
  provider: string,
  metrics: ReadonlyArray<{ metricType: string; date: string; value: number; unit?: string }>
): Promise<AutoLogged[]> {
  const today = localDateKey(new Date(), timeZone);
  const days = new Set([today, addDays(today, -1)]);
  const recent = metrics.filter((m) => days.has(m.date));
  if (!recent.length) return [];

  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true, status: { not: "paused" } },
  });
  const linked = habits.flatMap((h) => {
    const rule = autoLogSchema.safeParse(h.autoLog);
    return rule.success && rule.data.provider === provider ? [{ habit: h, rule: rule.data }] : [];
  });
  if (!linked.length) return [];

  const existing = await prisma.habitLog.findMany({
    where: { habitId: { in: linked.map((l) => l.habit.id) }, date: { in: [...days].map(dateFromKey) } },
    select: { habitId: true, date: true },
  });
  const taken = new Set(existing.map((e) => `${e.habitId}:${e.date.toISOString().slice(0, 10)}`));

  const out: AutoLogged[] = [];
  for (const { habit, rule } of linked) {
    for (const m of recent) {
      if (taken.has(`${habit.id}:${m.date}`)) continue;
      const decision = autoLogDecision(
        { ...habit, autoLog: rule },
        { provider, metric: m.metricType, value: m.value }
      );
      if (!decision) continue;
      const detail = `${PROVIDER_LABEL[provider] ?? provider}: ${Math.round(m.value).toLocaleString("en-US")} ${m.unit ?? ""}`.trim();
      await prisma.habitLog.create({
        data: {
          habitId: habit.id,
          userId,
          date: dateFromKey(m.date),
          completed: true,
          state: decision.state,
          value: habit.measureTarget ? decision.value : undefined,
          source: "integration",
          notes: detail,
        },
      });
      taken.add(`${habit.id}:${m.date}`);
      out.push({ habitId: habit.id, habitName: habit.name, date: m.date, state: decision.state, detail });
    }
  }
  return out;
}
