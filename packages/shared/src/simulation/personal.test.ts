import { describe, expect, it } from "vitest";
import { addDays } from "../habits/dates.js";
import { DEMO_HABITS, stepAutomaticity } from "./engine.js";
import { EXAMPLE_LIVES } from "./life.js";
import {
  DEFAULT_LEARN,
  fitLearnRate,
  historyFromLogs,
  recentPace,
  simulatePersonal,
  type RealDay,
} from "./personal.js";

const START = "2026-09-01";
const habit = DEMO_HABITS[1];
const life = EXAMPLE_LIVES[2];

/** 40 days: mostly done, the odd tiny day and miss. */
const history: RealDay[] = historyFromLogs(START, addDays(START, 39), (d) => {
  const n = Number(d.slice(8, 10));
  return n % 9 === 0 ? "missed" : n % 5 === 0 ? "tiny" : "full";
});

describe("fitting their own curve", () => {
  it("recovers the rate that produced their answers", () => {
    let a = 1;
    const truth = history.map((d) => (a = stepAutomaticity(a, d.outcome, 0.07, 6.4)));
    const checks = [13, 20, 27, 34].map((i) => ({ date: history[i].date, score: Math.round(truth[i] * 10) / 10 }));
    const k = fitLearnRate(history, checks, START)!;
    expect(k).toBeGreaterThan(0.06);
    expect(k).toBeLessThan(0.08);
  });

  it("has nothing to fit without answers", () => {
    expect(fitLearnRate(history, [], START)).toBeNull();
  });
});

describe("their pace", () => {
  it("is the share of due days kept lately, ignoring rest days", () => {
    const h: RealDay[] = [
      ...Array.from({ length: 20 }, () => ({ date: START, outcome: "full" as const })),
      ...Array.from({ length: 5 }, () => ({ date: START, outcome: "missed" as const })),
      ...Array.from({ length: 3 }, () => ({ date: START, outcome: "rest" as const })),
    ];
    expect(recentPace(h).pace).toBeCloseTo(0.8);
  });
});

describe("the personal simulation", () => {
  const sim = simulatePersonal({ habit, life, start: START, history, checks: [], ahead: 120 });

  it("keeps what really happened as the start of every future", () => {
    expect(sim.past).toHaveLength(40);
    for (const f of sim.futures) {
      expect(f.days.slice(0, 40)).toEqual(sim.past);
      expect(f.days).toHaveLength(160);
      expect(f.days[40].milestone).toBe("Today");
    }
  });

  it("says when it used the study's middle rather than their answers", () => {
    expect(sim.fitted).toBe(false);
    expect(sim.learn).toBeCloseTo(DEFAULT_LEARN * habit.ease);
  });

  it("offers futures that actually differ", () => {
    const [pace, most, tiny, rough] = sim.futures;
    expect(tiny.days.slice(40, 70).every((d) => d.outcome !== "full")).toBe(true);
    expect(rough.days.slice(54, 68).every((d) => d.outcome === "missed")).toBe(true);
    // Showing up more never gets there later than a rough patch.
    expect((most.automaticDay ?? Infinity) <= (rough.automaticDay ?? Infinity)).toBe(true);
    expect(pace.path.blurb).toMatch(/% of days/);
  });
});
