import { describe, expect, it } from "vitest";
import { addDays } from "./dates.js";
import { habitMetrics, type MetricHabit, type MetricLog } from "./metrics.js";

const START = "2026-09-01";
const habit = (over: Partial<MetricHabit> = {}): MetricHabit => ({
  id: "h1",
  userId: "u1",
  frequency: "daily",
  startDate: START,
  hasAnchor: true,
  hasTiny: true,
  isActive: true,
  ...over,
});
const log = (habitId: string, day: number, over: Partial<MetricLog> = {}): MetricLog => ({
  habitId,
  userId: "u1",
  date: addDays(START, day),
  completed: true,
  state: "done",
  source: "tap",
  ...over,
});

describe("habit metrics", () => {
  it("counts logging days per user per week", () => {
    const logs = [0, 1, 2, 3, 7, 8, 9].map((d) => log("h1", d));
    const m = habitMetrics([habit()], logs, [], START, addDays(START, 13));
    expect(m.loggingDaysPerUserPerWeek).toBe(3.5);
  });

  it("measures recovery after a single miss", () => {
    // Kept 0-2, missed 3, kept 4 (recovered); kept 5, missed 6, missed 7 (not recovered), kept 8.
    const logs = [0, 1, 2, 4, 5, 8, 9].map((d) => log("h1", d));
    const m = habitMetrics([habit()], logs, [], START, addDays(START, 10));
    expect(m.recoveryAfterMiss).toEqual({ rate: 0.5, misses: 2 });
  });

  it("doesn't count a planned rest day as a miss", () => {
    const logs = [0, 1, 3, 4].map((d) => log("h1", d)).concat(log("h1", 2, { completed: false, state: "rest" }));
    expect(habitMetrics([habit()], logs, [], START, addDays(START, 5)).recoveryAfterMiss.misses).toBe(0);
  });

  it("finds habits still going at day 30", () => {
    const habits = [habit(), habit({ id: "h2" })];
    const logs = [log("h1", 25), log("h2", 5)];
    const m = habitMetrics(habits, logs, [], START, addDays(START, 40));
    expect(m.survival30).toEqual({ rate: 0.5, habits: 2 });
  });

  it("averages automaticity around weeks 4 and 8", () => {
    const checks = [
      { habitId: "h1", date: addDays(START, 27), score: 4 },
      { habitId: "h1", date: addDays(START, 30), score: 5 },
      { habitId: "h1", date: addDays(START, 56), score: 6 },
    ];
    const m = habitMetrics([habit()], [], checks, START, addDays(START, 70));
    expect(m.automaticity).toEqual({ week4: 4.5, week8: 6, checks4: 2, checks8: 1 });
  });

  it("shares of anchors and tiny versions, and where logs come from", () => {
    const m = habitMetrics(
      [habit(), habit({ id: "h2", hasTiny: false })],
      [log("h1", 0, { source: "chat" }), log("h1", 1, { source: "integration" }), log("h2", 1)],
      [],
      START,
      addDays(START, 6)
    );
    expect(m.anchorAndTiny).toEqual({ rate: 0.5, habits: 2 });
    expect(m.sources).toEqual({ chat: 1, integration: 1, tap: 1 });
  });
});
