/**
 * What the guides cost to run over the last `days` days, from the AiUsage
 * table. Shared by the `ai:costs` script and the admin route. Dollars and
 * counts only: no user ids leave this file, and nothing anyone said is
 * stored to begin with.
 */

import { prisma } from "@kinextion/database";

const usd = (micros: number) => Math.round(micros) / 1_000_000;

export interface TaskRow {
  task: string;
  calls: number;
  costMicros: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface AICostInput {
  days: number;
  from: Date;
  to: Date;
  byTask: TaskRow[];
  byModel: Array<{ model: string; calls: number; costMicros: number }>;
  /** Spend per person; `userId: null` is work charged to no one. */
  byUser: Array<{ userId: string | null; calls: number; costMicros: number }>;
  /** Everyone who did anything in the window, AI or not. */
  activeUsers: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

export function aiCostMetrics(input: AICostInput) {
  const { days, byTask, byModel, byUser } = input;
  const total = byTask.reduce((s, t) => s + t.costMicros, 0);
  const calls = byTask.reduce((s, t) => s + t.calls, 0);

  const people = byUser.filter((u) => u.userId !== null);
  const unattributed = byUser.find((u) => u.userId === null);
  const personal = people.map((u) => u.costMicros).sort((a, b) => a - b);
  const personalTotal = personal.reduce((s, c) => s + c, 0);
  const toMonth = 30 / days;

  const tokens = byTask.reduce(
    (s, t) => ({
      fresh: s.fresh + t.inputTokens + t.cacheWriteTokens,
      cached: s.cached + t.cacheReadTokens,
    }),
    { fresh: 0, cached: 0 }
  );

  return {
    window: { days, from: input.from.toISOString(), to: input.to.toISOString() },
    totalUsd: usd(total),
    calls,
    /** The whole bill spread over a 30-day month at this window's rate. */
    projectedMonthlyUsd: usd(total * toMonth),
    activeUsers: input.activeUsers,
    aiUsers: people.length,
    /**
     * What one person costs in a 30-day month, two ways. `perActiveUser`
     * is the planning number: the whole bill, shared work included, over
     * everyone who used the app. `perAIUser` describes only people who
     * actually talked to a guide.
     */
    monthly: {
      perActiveUserUsd: input.activeUsers ? usd((total * toMonth) / input.activeUsers) : null,
      perAIUserUsd: people.length ? usd((personalTotal * toMonth) / people.length) : null,
      medianAIUserUsd: people.length ? usd(percentile(personal, 0.5) * toMonth) : null,
      p90AIUserUsd: people.length ? usd(percentile(personal, 0.9) * toMonth) : null,
      heaviestAIUserUsd: people.length ? usd(personal[personal.length - 1] * toMonth) : null,
    },
    unattributed: { calls: unattributed?.calls ?? 0, usd: usd(unattributed?.costMicros ?? 0) },
    /** Share of input read from the prompt cache, at a fraction of the price. */
    cacheReadShare: tokens.fresh + tokens.cached ? tokens.cached / (tokens.fresh + tokens.cached) : null,
    byTask: [...byTask]
      .sort((a, b) => b.costMicros - a.costMicros)
      .map((t) => ({
        task: t.task,
        calls: t.calls,
        usd: usd(t.costMicros),
        share: total ? t.costMicros / total : 0,
        avgCallUsd: t.calls ? usd(t.costMicros / t.calls) : 0,
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        cacheReadTokens: t.cacheReadTokens,
      })),
    byModel: [...byModel]
      .sort((a, b) => b.costMicros - a.costMicros)
      .map((m) => ({ model: m.model, calls: m.calls, usd: usd(m.costMicros) })),
  };
}

export type AICostMetrics = ReturnType<typeof aiCostMetrics>;

export async function loadAICostMetrics(days = 28): Promise<AICostMetrics> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const where = { createdAt: { gte: from, lt: to } };
  const sums = { costMicros: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true } as const;

  const [byTask, byModel, byUser, loggers, checkers, talkers] = await Promise.all([
    prisma.aiUsage.groupBy({ by: ["task"], where, _sum: sums, _count: { _all: true } }),
    prisma.aiUsage.groupBy({ by: ["model"], where, _sum: { costMicros: true }, _count: { _all: true } }),
    prisma.aiUsage.groupBy({ by: ["userId"], where, _sum: { costMicros: true }, _count: { _all: true } }),
    // Active means did something: logged a habit, checked in, or used a guide.
    prisma.habitLog.findMany({ where: { date: { gte: from } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.moodEntry.findMany({ where, select: { userId: true }, distinct: ["userId"] }),
    prisma.aiUsage.findMany({ where: { ...where, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
  ]);

  const active = new Set([...loggers, ...checkers, ...talkers].map((r) => r.userId));

  return aiCostMetrics({
    days,
    from,
    to,
    byTask: byTask.map((t) => ({
      task: t.task,
      calls: t._count._all,
      costMicros: t._sum.costMicros ?? 0,
      inputTokens: t._sum.inputTokens ?? 0,
      outputTokens: t._sum.outputTokens ?? 0,
      cacheReadTokens: t._sum.cacheReadTokens ?? 0,
      cacheWriteTokens: t._sum.cacheWriteTokens ?? 0,
    })),
    byModel: byModel.map((m) => ({ model: m.model, calls: m._count._all, costMicros: m._sum.costMicros ?? 0 })),
    byUser: byUser.map((u) => ({ userId: u.userId, calls: u._count._all, costMicros: u._sum.costMicros ?? 0 })),
    activeUsers: active.size,
  });
}
