/**
 * The attention budget, applied to storage.
 *
 * Kinextion's product idea is that no system has unlimited attention — what
 * separates one that knows you from one that merely logs you is which signals
 * it refuses to forget. This module is that idea as a retention policy.
 *
 * Storage is finite and paid-for, so data moves through four tiers:
 *
 *   core     — identity and constraints. Never expires.
 *   daily    — raw rows. Kept verbatim for a short window.
 *   pattern  — the shape of the daily data, once the points are gone.
 *   ambient  — fetched, used, released. Dropped on a short TTL.
 *
 * Everything here is pure: no I/O, no clock reads except what's passed in.
 * The scheduled job in apps/api supplies the data and applies the decisions.
 */

// ─── Tiers ───────────────────────────────────────────────────────

export const MEMORY_TIERS = ["core", "daily", "pattern", "ambient"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

/**
 * Retention windows, in days.
 *
 * These are the storage-cost dials. Lowering `rawMetricDays` is the single
 * biggest saving available — raw provider payloads dwarf everything else —
 * and costs nothing analytically, because rollups preserve the shape that
 * pattern detection actually reads.
 */
export interface RetentionPolicy {
  /** Verbatim chat turns kept per conversation before summarisation. */
  chatWindowTurns: number;
  /** Only summarise once there are this many turns above the window, so a
   *  quiet conversation isn't rewritten on every single message. */
  chatSummaryTrigger: number;
  /**
   * Days without a message before a conversation is folded down entirely:
   * every remaining turn goes into its summary and facts, and the raw
   * messages are deleted. Transcripts aren't kept; what matters is.
   */
  chatIdleDays: number;
  /** Days of raw wearable rows before they're rolled up and dropped. */
  rawMetricDays: number;
  /** Days before the untouched provider payload (`raw` JSON) is stripped.
   *  Shorter than `rawMetricDays`: the numbers stay useful long after the
   *  envelope they arrived in stops being. */
  rawPayloadDays: number;
  /** Days of raw mood/habit rows before weekly rollups take over. */
  rawBehaviourDays: number;
  /** Hard cap on stored facts per user. */
  maxFactsPerUser: number;
  /** Half-life for fact relevance decay. */
  factHalfLifeDays: number;
  /** Facts scoring below this are evicted even when under the cap. */
  factFloorScore: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  chatWindowTurns: 10,
  chatSummaryTrigger: 8,
  chatIdleDays: 3,
  rawMetricDays: 120,
  rawPayloadDays: 30,
  rawBehaviourDays: 180,
  maxFactsPerUser: 200,
  factHalfLifeDays: 90,
  factFloorScore: 0.05,
};

// ─── Fact relevance ──────────────────────────────────────────────

export interface ScorableFact {
  tier: MemoryTier;
  confidence: number;
  /** Times the fact has been re-observed. Repetition is evidence. */
  hits: number;
  lastSeenAt: Date;
}

/**
 * Exponential decay with a half-life: a fact last seen `halfLifeDays` ago is
 * worth half what it was. Same shape as any time-decayed relevance ranking,
 * chosen here because it needs no history — just the timestamp already stored.
 */
export function recencyWeight(lastSeenAt: Date, now: Date, halfLifeDays: number): number {
  const days = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 86_400_000);
  return Math.pow(0.5, days / halfLifeDays);
}

/**
 * How much of the budget a fact has earned.
 *
 * Repetition is dampened with log2 so a fact mentioned fifty times can't
 * crowd out everything else, and core facts are lifted clear of the ranking
 * entirely — an injury or a diagnosis stays loaded whether or not it came up
 * this month, which is the whole point of the tier.
 */
export function factScore(fact: ScorableFact, now: Date, policy = DEFAULT_RETENTION): number {
  if (fact.tier === "core") return Number.POSITIVE_INFINITY;

  const reinforcement = Math.log2(1 + Math.max(0, fact.hits));
  const recency = recencyWeight(fact.lastSeenAt, now, policy.factHalfLifeDays);
  return clamp01(fact.confidence) * reinforcement * recency;
}

export interface FactRetentionDecision<T> {
  keep: T[];
  evict: T[];
}

/**
 * Decide which facts stay inside the budget.
 *
 * Core facts are never evicted regardless of the cap — if someone has more
 * core facts than the cap allows, the cap yields, not the constraint that
 * makes advice safe.
 */
export function selectFactsToKeep<T extends ScorableFact>(
  facts: readonly T[],
  now: Date,
  policy = DEFAULT_RETENTION
): FactRetentionDecision<T> {
  const core = facts.filter((f) => f.tier === "core");
  const rest = facts.filter((f) => f.tier !== "core");

  const scored = rest
    .map((fact) => ({ fact, score: factScore(fact, now, policy) }))
    .sort((a, b) => b.score - a.score);

  const budget = Math.max(0, policy.maxFactsPerUser - core.length);
  const keep: T[] = [...core];
  const evict: T[] = [];

  scored.forEach(({ fact, score }, index) => {
    if (index < budget && score >= policy.factFloorScore) keep.push(fact);
    else evict.push(fact);
  });

  return { keep, evict };
}

// ─── Conversation compaction ─────────────────────────────────────

export interface CompactionPlan {
  /** Whether there's enough overflow to be worth a summarisation call. */
  shouldCompact: boolean;
  /** Count of oldest turns to fold into the running summary and delete. */
  compactCount: number;
  /** Count left verbatim. */
  retainCount: number;
}

/**
 * Sliding window plus progressive summarisation — the standard approach for
 * bounded conversational memory. Recent turns stay verbatim because tone and
 * detail matter in the moment; everything older becomes a paragraph.
 *
 * The trigger threshold exists so summarisation is amortised: it runs once
 * per batch of overflow, not once per message.
 */
export function planCompaction(messageCount: number, policy = DEFAULT_RETENTION): CompactionPlan {
  const overflow = messageCount - policy.chatWindowTurns;

  if (overflow < policy.chatSummaryTrigger) {
    return { shouldCompact: false, compactCount: 0, retainCount: messageCount };
  }

  return {
    shouldCompact: true,
    compactCount: overflow,
    retainCount: policy.chatWindowTurns,
  };
}

// ─── Time-series downsampling ────────────────────────────────────

export interface DatedValue {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface Bucket {
  periodStart: string;
  periodEnd: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

/** ISO week start (Monday), as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  // getUTCDay: Sunday = 0. Shift so Monday starts the week.
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Collapse daily points into weekly buckets.
 *
 * Keeping count/sum/min/max alongside the average means the rollup can be
 * merged with another rollup later without reading the raw rows again —
 * averages alone aren't re-aggregatable, which is the usual reason
 * downsampled history turns out to be a dead end.
 */
export function bucketByWeek(points: readonly DatedValue[]): Bucket[] {
  const buckets = new Map<string, { count: number; sum: number; min: number; max: number }>();

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const key = weekStart(point.date);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.sum += point.value;
      existing.min = Math.min(existing.min, point.value);
      existing.max = Math.max(existing.max, point.value);
    } else {
      buckets.set(key, { count: 1, sum: point.value, min: point.value, max: point.value });
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([periodStart, b]) => ({
      periodStart,
      periodEnd: addDays(periodStart, 6),
      count: b.count,
      sum: b.sum,
      min: b.min,
      max: b.max,
      avg: b.sum / b.count,
    }));
}

/** Cutoff date, N days before `now`, as YYYY-MM-DD. */
export function cutoffDate(now: Date, days: number): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
