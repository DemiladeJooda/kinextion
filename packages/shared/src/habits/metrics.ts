/**
 * How we'll know the habits feature works — the measures from the plan.
 *
 *   - Logging days per user per week: the main measure of engagement.
 *   - Recovery after a miss: of the times a habit was missed once, how often
 *     the next due day was kept. The research says this is where people are
 *     won or lost, so it's the number the forgiving-streak design is for.
 *   - Habits with an anchor and a tiny version: whether people actually use
 *     the strongest finding.
 *   - 30-day survival: habits still being done at day 30.
 *   - Automaticity at weeks 4 and 8: the outcome that actually matters.
 *   - Where logs come from: tap, notification, chat, a connected service, the widget.
 *
 * Pure, so it's tested here and the report script only fetches and prints.
 * Time from opening the app to logging isn't here: it's measured on the
 * device (lib/usage.ts) and never leaves it.
 */

import { addDays, daysBetween, type DateKey } from "./dates.js";
import { isDueOn, type ScheduledHabit } from "./schedule.js";

export interface MetricHabit extends ScheduledHabit {
  id: string;
  userId: string;
  startDate: DateKey;
  hasAnchor: boolean;
  hasTiny: boolean;
  isActive: boolean;
}

export interface MetricLog {
  habitId: string;
  userId: string;
  date: DateKey;
  completed: boolean;
  state: string;
  source: string | null;
}

export interface MetricCheck {
  habitId: string;
  date: DateKey;
  score: number;
}

export interface HabitMetrics {
  window: { from: DateKey; to: DateKey; weeks: number };
  users: number;
  loggingDaysPerUserPerWeek: number | null;
  recoveryAfterMiss: { rate: number | null; misses: number };
  anchorAndTiny: { rate: number | null; habits: number };
  survival30: { rate: number | null; habits: number };
  automaticity: { week4: number | null; week8: number | null; checks4: number; checks8: number };
  sources: Record<string, number>;
}

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 1000 : null);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export function habitMetrics(
  habits: readonly MetricHabit[],
  logs: readonly MetricLog[],
  checks: readonly MetricCheck[],
  from: DateKey,
  to: DateKey
): HabitMetrics {
  const weeks = Math.max(1, (daysBetween(from, to) + 1) / 7);
  const inWindow = logs.filter((l) => l.date >= from && l.date <= to);

  // Engagement: distinct days with any log, per user who has a habit.
  const users = new Set(habits.map((h) => h.userId));
  const loggedDays = new Set(inWindow.map((l) => `${l.userId}:${l.date}`));

  // Per habit, which days were kept and rested.
  const kept = new Map<string, Set<DateKey>>();
  const rested = new Map<string, Set<DateKey>>();
  for (const l of logs) {
    const into = l.completed ? kept : l.state === "rest" ? rested : null;
    if (!into) continue;
    const set = into.get(l.habitId) ?? new Set<DateKey>();
    set.add(l.date);
    into.set(l.habitId, set);
  }

  // Recovery: a due day missed after a kept one; did the next due day get kept?
  let misses = 0;
  let recovered = 0;
  for (const h of habits) {
    if (h.frequency === "weekly") continue; // "missed" isn't a single day for X-a-week habits
    const done = kept.get(h.id) ?? new Set<DateKey>();
    const rest = rested.get(h.id) ?? new Set<DateKey>();
    const due: DateKey[] = [];
    for (let d = h.startDate > from ? h.startDate : from; d < to; d = addDays(d, 1)) {
      if (isDueOn(h, d, done) && !rest.has(d)) due.push(d);
    }
    for (let i = 1; i < due.length - 1; i++) {
      if (!done.has(due[i]) && done.has(due[i - 1])) {
        misses++;
        if (done.has(due[i + 1])) recovered++;
      }
    }
  }

  // Survival: habits at least 30 days old, kept at least once in days 23–30.
  const old = habits.filter((h) => daysBetween(h.startDate, to) >= 30);
  const surviving = old.filter((h) => {
    const done = kept.get(h.id);
    if (!done) return false;
    for (let i = 22; i < 30; i++) if (done.has(addDays(h.startDate, i))) return true;
    return false;
  });

  // Automaticity: checks taken around week 4 (days 22–35) and week 8 (50–63).
  const startOf = new Map(habits.map((h) => [h.id, h.startDate]));
  const around = (lo: number, hi: number) =>
    checks
      .filter((c) => {
        const s = startOf.get(c.habitId);
        if (!s) return false;
        const age = daysBetween(s, c.date);
        return age >= lo && age <= hi;
      })
      .map((c) => c.score);
  const w4 = around(22, 35);
  const w8 = around(50, 63);

  const active = habits.filter((h) => h.isActive);
  const sources: Record<string, number> = {};
  for (const l of inWindow) {
    if (!l.completed) continue;
    const k = l.source ?? "tap";
    sources[k] = (sources[k] ?? 0) + 1;
  }

  return {
    window: { from, to, weeks: Math.round(weeks * 10) / 10 },
    users: users.size,
    loggingDaysPerUserPerWeek: users.size ? Math.round((loggedDays.size / users.size / weeks) * 100) / 100 : null,
    recoveryAfterMiss: { rate: share(recovered, misses), misses },
    anchorAndTiny: { rate: share(active.filter((h) => h.hasAnchor && h.hasTiny).length, active.length), habits: active.length },
    survival30: { rate: share(surviving.length, old.length), habits: old.length },
    automaticity: { week4: mean(w4), week8: mean(w8), checks4: w4.length, checks8: w8.length },
    sources,
  };
}
