import { describe, expect, it } from "vitest";
import {
  bucketByWeek,
  cutoffDate,
  DEFAULT_RETENTION,
  factScore,
  planCompaction,
  recencyWeight,
  selectFactsToKeep,
  weekStart,
  type ScorableFact,
} from "./index.js";

const NOW = new Date("2026-06-15T12:00:00Z");

function fact(over: Partial<ScorableFact> = {}): ScorableFact {
  return { tier: "pattern", confidence: 0.8, hits: 1, lastSeenAt: NOW, ...over };
}

describe("recencyWeight", () => {
  it("is 1 for a fact seen right now", () => {
    expect(recencyWeight(NOW, NOW, 90)).toBe(1);
  });

  it("halves after exactly one half-life", () => {
    const seen = new Date(NOW.getTime() - 90 * 86_400_000);
    expect(recencyWeight(seen, NOW, 90)).toBeCloseTo(0.5, 10);
  });

  it("quarters after two half-lives", () => {
    const seen = new Date(NOW.getTime() - 180 * 86_400_000);
    expect(recencyWeight(seen, NOW, 90)).toBeCloseTo(0.25, 10);
  });

  it("treats a future timestamp as current rather than amplifying it", () => {
    const future = new Date(NOW.getTime() + 30 * 86_400_000);
    expect(recencyWeight(future, NOW, 90)).toBe(1);
  });
});

describe("factScore", () => {
  it("puts core facts beyond any ranking", () => {
    const stale = fact({ tier: "core", confidence: 0.1, hits: 1, lastSeenAt: new Date("2020-01-01") });
    expect(factScore(stale, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("rewards repetition, but with diminishing returns", () => {
    const once = factScore(fact({ hits: 1 }), NOW);
    const twice = factScore(fact({ hits: 3 }), NOW);
    const many = factScore(fact({ hits: 7 }), NOW);

    expect(twice).toBeGreaterThan(once);
    expect(many).toBeGreaterThan(twice);
    // log2 damping: 1→3 and 3→7 both double the log term, so the gain per
    // extra mention shrinks as hits grow.
    expect(many - twice).toBeCloseTo(twice - once, 10);
  });

  it("ranks a recent uncertain fact above a stale confident one", () => {
    const recentWeak = fact({ confidence: 0.5, lastSeenAt: NOW });
    const staleStrong = fact({
      confidence: 1,
      lastSeenAt: new Date(NOW.getTime() - 365 * 86_400_000),
    });
    expect(factScore(recentWeak, NOW)).toBeGreaterThan(factScore(staleStrong, NOW));
  });

  it("clamps out-of-range confidence instead of trusting it", () => {
    expect(factScore(fact({ confidence: 5 }), NOW)).toBe(factScore(fact({ confidence: 1 }), NOW));
    expect(factScore(fact({ confidence: -2 }), NOW)).toBe(0);
  });
});

describe("selectFactsToKeep", () => {
  const policy = { ...DEFAULT_RETENTION, maxFactsPerUser: 3, factFloorScore: 0 };

  it("keeps everything when under budget", () => {
    const facts = [fact(), fact(), fact()];
    const { keep, evict } = selectFactsToKeep(facts, NOW, policy);
    expect(keep).toHaveLength(3);
    expect(evict).toHaveLength(0);
  });

  it("evicts the lowest-scoring facts once over budget", () => {
    const strong = fact({ hits: 20, confidence: 1 });
    const weak = fact({ hits: 1, confidence: 0.2, lastSeenAt: new Date("2021-01-01") });
    const { keep, evict } = selectFactsToKeep([weak, strong, fact(), fact()], NOW, policy);

    expect(keep).toContain(strong);
    expect(evict).toContain(weak);
    expect(keep).toHaveLength(3);
  });

  it("never evicts core facts, even past the cap", () => {
    const core = [
      fact({ tier: "core" }),
      fact({ tier: "core" }),
      fact({ tier: "core" }),
      fact({ tier: "core" }),
      fact({ tier: "core" }),
    ];
    const { keep, evict } = selectFactsToKeep(core, NOW, policy);

    // The cap yields rather than dropping a constraint that keeps advice safe.
    expect(keep).toHaveLength(5);
    expect(evict).toHaveLength(0);
  });

  it("gives core facts priority over the budget shared with pattern facts", () => {
    const core = fact({ tier: "core" });
    const patterns = [fact(), fact(), fact(), fact()];
    const { keep } = selectFactsToKeep([...patterns, core], NOW, policy);

    expect(keep).toContain(core);
    expect(keep).toHaveLength(3);
  });

  it("evicts facts below the floor even when there is room", () => {
    const ancient = fact({ lastSeenAt: new Date("2015-01-01"), confidence: 0.1 });
    const { keep, evict } = selectFactsToKeep([ancient], NOW, {
      ...policy,
      factFloorScore: 0.05,
    });
    expect(keep).toHaveLength(0);
    expect(evict).toContain(ancient);
  });
});

describe("planCompaction", () => {
  const policy = { ...DEFAULT_RETENTION, chatWindowTurns: 10, chatSummaryTrigger: 8 };

  it("does nothing for a short conversation", () => {
    expect(planCompaction(5, policy).shouldCompact).toBe(false);
  });

  it("waits for enough overflow to be worth a summarisation call", () => {
    // 17 messages = 7 over the window, still below the trigger.
    expect(planCompaction(17, policy).shouldCompact).toBe(false);
    expect(planCompaction(18, policy).shouldCompact).toBe(true);
  });

  it("compacts the overflow and retains exactly the window", () => {
    const plan = planCompaction(25, policy);
    expect(plan.compactCount).toBe(15);
    expect(plan.retainCount).toBe(10);
    expect(plan.compactCount + plan.retainCount).toBe(25);
  });
});

describe("weekStart", () => {
  it("returns Monday for every day of the same ISO week", () => {
    // 2026-06-15 is a Monday.
    for (const day of ["15", "16", "17", "18", "19", "20", "21"]) {
      expect(weekStart(`2026-06-${day}`)).toBe("2026-06-15");
    }
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(weekStart("2026-06-21")).toBe("2026-06-15");
    expect(weekStart("2026-06-22")).toBe("2026-06-22");
  });
});

describe("bucketByWeek", () => {
  it("aggregates points into weekly buckets", () => {
    const buckets = bucketByWeek([
      { date: "2026-06-15", value: 10 },
      { date: "2026-06-17", value: 20 },
      { date: "2026-06-22", value: 30 },
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      periodStart: "2026-06-15",
      periodEnd: "2026-06-21",
      count: 2,
      sum: 30,
      min: 10,
      max: 20,
      avg: 15,
    });
    expect(buckets[1]).toMatchObject({ periodStart: "2026-06-22", count: 1, avg: 30 });
  });

  it("returns buckets in chronological order regardless of input order", () => {
    const buckets = bucketByWeek([
      { date: "2026-06-29", value: 3 },
      { date: "2026-06-15", value: 1 },
      { date: "2026-06-22", value: 2 },
    ]);
    expect(buckets.map((b) => b.periodStart)).toEqual([
      "2026-06-15",
      "2026-06-22",
      "2026-06-29",
    ]);
  });

  it("keeps sum and count so buckets stay re-aggregatable", () => {
    const [bucket] = bucketByWeek([
      { date: "2026-06-15", value: 5 },
      { date: "2026-06-16", value: 7 },
    ]);
    // Averages alone can't be merged later; sum/count can.
    expect(bucket.sum / bucket.count).toBe(bucket.avg);
  });

  it("skips non-finite values rather than poisoning the average", () => {
    const [bucket] = bucketByWeek([
      { date: "2026-06-15", value: 10 },
      { date: "2026-06-16", value: Number.NaN },
      { date: "2026-06-17", value: Number.POSITIVE_INFINITY },
    ]);
    expect(bucket.count).toBe(1);
    expect(bucket.avg).toBe(10);
  });

  it("returns nothing for no input", () => {
    expect(bucketByWeek([])).toEqual([]);
  });
});

describe("cutoffDate", () => {
  it("walks back the requested number of days", () => {
    expect(cutoffDate(NOW, 30)).toBe("2026-05-16");
  });

  it("crosses month and year boundaries correctly", () => {
    expect(cutoffDate(new Date("2026-01-05T00:00:00Z"), 10)).toBe("2025-12-26");
  });
});
