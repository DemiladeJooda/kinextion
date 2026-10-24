/**
 * The plan's success measures, from the real database. Read-only.
 *
 *   pnpm --filter @kinextion/api habit:metrics          # last 28 days
 *   pnpm --filter @kinextion/api habit:metrics -- 90    # last 90 days
 *
 * Counts and rates only. No names, no habit text, nothing anyone wrote.
 */

import { prisma } from "@kinextion/database";
import { addDays, dateKeyOf, habitMetrics, localDateKey } from "@kinextion/shared";

const days = Number(process.argv[2] ?? 28);
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

const m = habitMetrics(
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

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const n = (x: number | null) => (x === null ? "—" : String(x));

console.log(`
Habits — ${m.window.from} to ${m.window.to} (${m.window.weeks} weeks), ${m.users} user${m.users === 1 ? "" : "s"}

  Logging days per user per week   ${n(m.loggingDaysPerUserPerWeek)}
  Recovery after a single miss     ${pct(m.recoveryAfterMiss.rate)}  (${m.recoveryAfterMiss.misses} misses)
  Habits with anchor + tiny        ${pct(m.anchorAndTiny.rate)}  (${m.anchorAndTiny.habits} active)
  Still going at day 30            ${pct(m.survival30.rate)}  (${m.survival30.habits} old enough)
  Automaticity, week 4             ${n(m.automaticity.week4)} / 7  (${m.automaticity.checks4} checks)
  Automaticity, week 8             ${n(m.automaticity.week8)} / 7  (${m.automaticity.checks8} checks)

  Where logs came from             ${Object.entries(m.sources)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ") || "—"}
`);
await prisma.$disconnect();
