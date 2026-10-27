import { describe, expect, it } from "vitest";
import { addDays } from "../habits/dates.js";
import { formatMinutes, summarizeWeeks, weekInsights, type DailyReading } from "./week-numbers.js";

const TODAY = "2026-10-27"; // a Tuesday

/** Readings for `metricType` on the last `values.length` days ending `endOffset` days from today. */
function run(metricType: string, values: number[], endOffset = 0): DailyReading[] {
  return values.map((value, i) => ({ metricType, date: addDays(TODAY, endOffset - (values.length - 1 - i)), value }));
}

describe("summarizeWeeks", () => {
  it("splits the last fourteen days into this week and last, with gaps as null", () => {
    const stats = summarizeWeeks([...run("steps", [8000, 9000], 0), ...run("steps", [5000, 6000, 7000], -7)], TODAY);
    expect(stats.steps.days).toEqual([null, null, null, null, null, 8000, 9000]);
    expect(stats.steps.value).toBe(8500);
    expect(stats.steps.previous).toBe(6000);
    expect(stats.steps.readings).toBe(2);
    expect(stats.steps.previousReadings).toBe(3);
  });

  it("averages two sources on the same day instead of adding them", () => {
    const stats = summarizeWeeks(
      [
        { metricType: "steps", date: TODAY, value: 8000 },
        { metricType: "steps", date: TODAY, value: 10000 },
      ],
      TODAY
    );
    expect(stats.steps.value).toBe(9000);
  });

  it("ignores anything older than two weeks", () => {
    expect(summarizeWeeks(run("hrv", [50], -20), TODAY)).toEqual({});
  });
});

describe("weekInsights", () => {
  it("says what moved, biggest first", () => {
    const stats = summarizeWeeks(
      [
        ...run("sleep_duration", [480, 480, 480, 480], 0),
        ...run("sleep_duration", [400, 400, 400, 400], -7),
        ...run("steps", [10000, 10000, 10000], 0),
        ...run("steps", [9000, 9000, 9000], -7),
      ],
      TODAY
    );
    const insights = weekInsights(stats, null, TODAY);
    expect(insights[0].text).toBe("You slept about 1h 20m more a night than last week, 8h on average.");
    // An 11% rise in steps is ordinary wobble, not news.
    expect(insights.some((i) => i.text.startsWith("Steps were"))).toBe(false);
  });

  it("stays quiet when a week has too few readings to compare", () => {
    const stats = summarizeWeeks([...run("sleep_duration", [480, 480], 0), ...run("sleep_duration", [300, 300, 300], -7)], TODAY);
    expect(weekInsights(stats, null, TODAY)).toEqual([]);
  });

  it("names the most active day", () => {
    const stats = summarizeWeeks(run("steps", [4000, 5000, 12000, 6000, 5000], 0), TODAY);
    const best = weekInsights(stats, null, TODAY).find((i) => i.text.startsWith("Your most active day"));
    // Two days before Tuesday the 27th is Sunday the 25th.
    expect(best?.text).toBe("Your most active day was Sunday, with 12,000 steps.");
  });

  it("calls a steady resting heart rate steady, and never good or bad", () => {
    const stats = summarizeWeeks([...run("resting_heart_rate", [58, 59, 58], 0), ...run("resting_heart_rate", [59, 58, 59], -7)], TODAY);
    expect(weekInsights(stats, null, TODAY)[0].text).toBe("Your resting heart rate held steady around 58 bpm.");
  });

  it("describes blood pressure, and only suggests a doctor at 140/90 or above", () => {
    const calm = summarizeWeeks(
      [...run("blood_pressure_systolic", [120, 122, 118], 0), ...run("blood_pressure_diastolic", [78, 80, 76], 0)],
      TODAY
    );
    expect(weekInsights(calm, null, TODAY)[0].text).toBe("Blood pressure averaged 120/78 over 3 readings.");
    const high = summarizeWeeks(
      [...run("blood_pressure_systolic", [145, 150, 142], 0), ...run("blood_pressure_diastolic", [92, 94, 90], 0)],
      TODAY
    );
    expect(weekInsights(high, null, TODAY)[0].text).toMatch(/worth checking with a doctor/);
  });

  it("counts workouts against last week", () => {
    expect(weekInsights({}, { count: 3, previousCount: 1 }, TODAY)[0].text).toBe("3 workouts this week, 2 more than last week.");
    expect(weekInsights({}, { count: 1, previousCount: 1 }, TODAY)[0].text).toBe("1 workout this week, matching last week.");
    expect(weekInsights({}, { count: 0, previousCount: 0 }, TODAY)).toEqual([]);
  });
});

describe("formatMinutes", () => {
  it("reads like a person would say it", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(420)).toBe("7h");
    expect(formatMinutes(430)).toBe("7h 10m");
  });
});
