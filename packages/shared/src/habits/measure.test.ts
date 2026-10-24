import { describe, expect, it } from "vitest";
import { autoLogDecision, describeAmount, stateForAmount } from "./measure.js";

const water = { measureTarget: 8, measureTiny: 2, measureUnit: "glasses" };

describe("measured habits", () => {
  it("counts the target as done and the tiny amount as the tiny version", () => {
    expect(stateForAmount(water, 8)).toBe("done");
    expect(stateForAmount(water, 10)).toBe("done");
    expect(stateForAmount(water, 3)).toBe("minimum");
    expect(stateForAmount(water, 1)).toBeNull();
    expect(stateForAmount(water, 0)).toBeNull();
  });

  it("counts any amount as the tiny version when no tiny amount is set", () => {
    expect(stateForAmount({ measureTarget: 20 }, 1)).toBe("minimum");
  });

  it("isn't a measured habit without a target", () => {
    expect(stateForAmount({}, 5)).toBeNull();
  });

  it("reads like a person would say it", () => {
    expect(describeAmount(water, 6)).toBe("6 of 8 glasses");
    expect(describeAmount(water)).toBe("8 glasses");
    expect(describeAmount({ measureTarget: 2.5, measureUnit: "km" }, 1.2)).toBe("1.2 of 2.5 km");
  });
});

describe("auto-logging", () => {
  const run = { autoLog: { provider: "strava" as const, metric: "workout" as const } };

  it("logs a Strava activity long enough to count", () => {
    expect(autoLogDecision(run, { provider: "strava", metric: "workout", value: 32 })).toEqual({ state: "done", value: 32 });
    expect(autoLogDecision(run, { provider: "strava", metric: "workout", value: 4 })).toBeNull();
  });

  it("ignores other services and other kinds of reading", () => {
    expect(autoLogDecision(run, { provider: "whoop", metric: "workout", value: 60 })).toBeNull();
    expect(autoLogDecision(run, { provider: "strava", metric: "steps", value: 9000 })).toBeNull();
  });

  it("uses a measured habit's own amounts", () => {
    const steps = { measureTarget: 8000, measureTiny: 3000, autoLog: { provider: "oura" as const, metric: "steps" as const } };
    expect(autoLogDecision(steps, { provider: "oura", metric: "steps", value: 4200 })).toEqual({ state: "minimum", value: 4200 });
    expect(autoLogDecision(steps, { provider: "oura", metric: "steps", value: 1200 })).toBeNull();
  });
});
