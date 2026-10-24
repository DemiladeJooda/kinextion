/**
 * The scheduled retention pass.
 *
 * Runs the whole attention-budget policy over stored data: strip raw
 * provider payloads, roll daily points into weekly shape, compact overflowing
 * conversations, and evict facts that fell below the line.
 *
 * Every step reports what it touched, and `dryRun` reports without deleting —
 * a retention job whose behaviour you can't observe before it runs is one
 * nobody will turn on.
 */

import { prisma, Prisma } from "@kinextion/database";
import { bucketByWeek, cutoffDate, DEFAULT_RETENTION, type RetentionPolicy } from "@kinextion/shared";
import { compactConversation, pruneFacts } from "./store.js";

export interface RetentionReport {
  dryRun: boolean;
  payloadsStripped: number;
  metricsRolledUp: number;
  metricsDeleted: number;
  conversationsCompacted: number;
  messagesDeleted: number;
  factsEvicted: number;
  errors: string[];
}

/**
 * Drop the untouched provider envelope once the numbers derived from it have
 * settled. This is the single biggest saving in the policy — raw payloads
 * dwarf the metrics extracted from them — and it costs nothing analytically.
 */
async function stripRawPayloads(
  now: Date,
  policy: RetentionPolicy,
  dryRun: boolean
): Promise<number> {
  const cutoff = new Date(cutoffDate(now, policy.rawPayloadDays));
  const where = { date: { lt: cutoff }, raw: { not: Prisma.DbNull } };

  if (dryRun) return prisma.wearableMetric.count({ where });

  const result = await prisma.wearableMetric.updateMany({
    where,
    data: { raw: Prisma.DbNull },
  });
  return result.count;
}

/**
 * Collapse daily wearable rows into weekly buckets, then delete the dailies.
 *
 * Rollups carry count/sum/min/max as well as the average so they stay
 * re-aggregatable — a rollup you can only read and never merge is a dead end.
 */
async function rollUpWearables(
  now: Date,
  policy: RetentionPolicy,
  dryRun: boolean
): Promise<{ rolledUp: number; deleted: number }> {
  const cutoff = new Date(cutoffDate(now, policy.rawMetricDays));

  const stale = await prisma.wearableMetric.findMany({
    where: { date: { lt: cutoff } },
    select: { id: true, userId: true, metricType: true, date: true, value: true },
  });
  if (stale.length === 0) return { rolledUp: 0, deleted: 0 };

  // Group by (user, metric) so each series buckets independently.
  const series = new Map<string, { userId: string; metricKey: string; points: typeof stale }>();
  for (const row of stale) {
    const key = `${row.userId}::${row.metricType}`;
    const entry = series.get(key);
    if (entry) entry.points.push(row);
    else series.set(key, { userId: row.userId, metricKey: row.metricType, points: [row] });
  }

  let rolledUp = 0;

  for (const { userId, metricKey, points } of series.values()) {
    const buckets = bucketByWeek(
      points.map((p) => ({ date: p.date.toISOString().slice(0, 10), value: p.value }))
    );

    if (dryRun) {
      rolledUp += buckets.length;
      continue;
    }

    for (const bucket of buckets) {
      await prisma.metricRollup.upsert({
        where: {
          userId_scope_metricKey_granularity_periodStart: {
            userId,
            scope: "wearable",
            metricKey,
            granularity: "week",
            periodStart: new Date(bucket.periodStart),
          },
        },
        create: {
          userId,
          scope: "wearable",
          metricKey,
          granularity: "week",
          periodStart: new Date(bucket.periodStart),
          periodEnd: new Date(bucket.periodEnd),
          count: bucket.count,
          sum: bucket.sum,
          min: bucket.min,
          max: bucket.max,
          avg: bucket.avg,
        },
        // A re-run covering the same week replaces the bucket rather than
        // double-counting it, so the job is safe to run more than once.
        update: {
          periodEnd: new Date(bucket.periodEnd),
          count: bucket.count,
          sum: bucket.sum,
          min: bucket.min,
          max: bucket.max,
          avg: bucket.avg,
        },
      });
      rolledUp += 1;
    }
  }

  if (dryRun) return { rolledUp, deleted: stale.length };

  const deleted = await prisma.wearableMetric.deleteMany({
    where: { id: { in: stale.map((s) => s.id) } },
  });

  return { rolledUp, deleted: deleted.count };
}

/** Compact conversations that have grown past the verbatim window. */
async function compactConversations(
  policy: RetentionPolicy,
  dryRun: boolean
): Promise<{ conversations: number; messages: number; errors: string[] }> {
  const idleSince = new Date(Date.now() - policy.chatIdleDays * 86_400_000);
  const busy = await prisma.conversation.findMany({
    where: { messages: { some: {} } },
    select: {
      id: true,
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  // Long conversations shed their overflow; quiet ones are folded down
  // entirely, so no transcript outlives the few days it's useful for.
  const candidates = busy
    .map((c) => ({
      id: c.id,
      foldAll: (c.messages[0]?.createdAt ?? new Date()) < idleSince,
      long: c._count.messages > policy.chatWindowTurns + policy.chatSummaryTrigger,
    }))
    .filter((c) => c.foldAll || c.long);

  if (dryRun) {
    return { conversations: candidates.length, messages: 0, errors: [] };
  }

  let conversations = 0;
  let messages = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await compactConversation(candidate.id, policy, { foldAll: candidate.foldAll });
      if (result.compacted > 0) {
        conversations += 1;
        messages += result.compacted;
      }
    } catch (err) {
      // One bad conversation shouldn't abort the whole nightly pass.
      errors.push(
        `conversation ${candidate.id}: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  return { conversations, messages, errors };
}

export async function runRetention({
  now = new Date(),
  policy = DEFAULT_RETENTION,
  dryRun = false,
}: {
  now?: Date;
  policy?: RetentionPolicy;
  dryRun?: boolean;
} = {}): Promise<RetentionReport> {
  const report: RetentionReport = {
    dryRun,
    payloadsStripped: 0,
    metricsRolledUp: 0,
    metricsDeleted: 0,
    conversationsCompacted: 0,
    messagesDeleted: 0,
    factsEvicted: 0,
    errors: [],
  };

  report.payloadsStripped = await stripRawPayloads(now, policy, dryRun);

  const wearables = await rollUpWearables(now, policy, dryRun);
  report.metricsRolledUp = wearables.rolledUp;
  report.metricsDeleted = wearables.deleted;

  const chats = await compactConversations(policy, dryRun);
  report.conversationsCompacted = chats.conversations;
  report.messagesDeleted = chats.messages;
  report.errors.push(...chats.errors);

  if (!dryRun) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      report.factsEvicted += await pruneFacts(user.id, now, policy);
    }
  }

  return report;
}
