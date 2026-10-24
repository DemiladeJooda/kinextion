import { describe, expect, it } from "vitest";
import {
  DEMO_HABITS,
  EXAMPLE_LIVES,
  SIM_LENGTHS,
  SIM_PATHS,
  SIM_RESEARCH,
  climateOf,
  lifeCalendar,
  lifeFromBackground,
  simulateAll,
  simulatePath,
} from "./index.js";
import { backgroundLines, formatBackground } from "../profile/index.js";

const NINE_MONTHS = SIM_LENGTHS["9m"];
const STARTS = ["2026-10-23", "2026-05-01", "2027-01-15"];
const all = (start: string, days: number = NINE_MONTHS) =>
  EXAMPLE_LIVES.flatMap((life) => DEMO_HABITS.map((habit) => ({ life, habit, runs: simulateAll({ habit, life, start, days }) })));

describe("the simulation", () => {
  it("plays the same way every time", () => {
    const input = { habit: DEMO_HABITS[1], life: EXAMPLE_LIVES[0], path: SIM_PATHS[2], start: "2026-10-23", days: 90 };
    expect(simulatePath(input)).toEqual(simulatePath(input));
  });

  it("stays inside what the research saw", () => {
    for (const start of STARTS) {
      for (const { runs } of all(start)) {
        for (const r of runs) {
          if (r.automaticDay !== null) {
            expect(r.automaticDay).toBeGreaterThanOrEqual(SIM_RESEARCH.minDays);
            expect(r.automaticDay).toBeLessThanOrEqual(NINE_MONTHS);
          } else {
            // Only the slow builder is allowed to still be building at nine months.
            expect(r.path.id).toBe("slow");
          }
        }
      }
    }
  });

  it("puts the middle of the paths near the research median", () => {
    const days = all("2026-10-23")
      .flatMap(({ runs }) => runs.map((r) => r.automaticDay ?? Infinity))
      .sort((a, b) => a - b);
    const median = days[Math.floor(days.length / 2)];
    expect(median).toBeGreaterThan(45);
    expect(median).toBeLessThan(110);
  });

  it("always has a path that is still building at day 90 — that's normal", () => {
    for (const { runs } of all("2026-10-23", 90)) {
      expect(runs.some((r) => r.automaticDay === null)).toBe(true);
      expect(runs.some((r) => r.automaticDay !== null)).toBe(true);
    }
  });

  it("never resets to zero after a gap", () => {
    const run = simulatePath({ habit: DEMO_HABITS[1], life: EXAMPLE_LIVES[2], path: SIM_PATHS[2], start: "2026-10-23", days: 120 });
    const before = run.days[33].automaticity;
    const lowest = Math.min(...run.days.slice(34, 48).map((d) => d.automaticity));
    expect(run.days.slice(34, 48).every((d) => d.outcome === "missed")).toBe(true);
    expect(lowest).toBeLessThan(before);
    expect(lowest).toBeGreaterThan(before * 0.75);
    expect(run.days.find((d) => d.milestone?.startsWith("Back after"))).toBeTruthy();
  });

  it("writes a morning and a night for every day, from the habit's own words", () => {
    const habit = DEMO_HABITS[1];
    const run = simulatePath({ habit, life: EXAMPLE_LIVES[0], path: SIM_PATHS[3], start: "2026-10-23", days: 90 });
    for (const d of run.days) {
      expect(d.morning.length).toBeGreaterThan(5);
      expect(d.night.length).toBeGreaterThan(5);
    }
    expect(run.days.filter((d) => d.outcome === "tiny").some((d) => d.night.includes(habit.tiny))).toBe(true);
    expect(run.days[0].milestone).toBe("Day one");
  });
});

describe("the life it happens in", () => {
  it("knows the real calendar", () => {
    const cal = lifeCalendar(EXAMPLE_LIVES[2], "2026-10-23", 80);
    const at = (date: string) => cal[Math.round((Date.parse(date) - Date.parse("2026-10-23")) / 86400000)];
    expect(at("2026-11-26").some((e) => e.label.startsWith("Thanksgiving"))).toBe(true);
    expect(at("2026-11-01").some((e) => e.label.startsWith("Clocks went back"))).toBe(true);
    expect(at("2026-12-25").some((e) => e.label === "Christmas break")).toBe(true);
  });

  it("shares one calendar across every path", () => {
    const runs = simulateAll({ habit: DEMO_HABITS[0], life: EXAMPLE_LIVES[0], start: "2026-10-23", days: 60 });
    // Paths add their own story ("Life got loud") on top of the shared life.
    const ownStory = new Set(SIM_PATHS.flatMap((p) => p.arcs.map((a) => a.label)));
    const thanksgiving = (r: (typeof runs)[number]) =>
      r.days[34].events.filter((e) => !ownStory.has(e.label)).map((e) => e.label);
    expect(new Set(runs.map((r) => thanksgiving(r).join("|"))).size).toBe(1);
  });

  it("reads climate from a free-text place", () => {
    expect(climateOf("Houston, TX")).toBe("hot_summer");
    expect(climateOf("Minneapolis")).toBe("cold_winter");
    expect(climateOf("Portland, Oregon")).toBe("mild");
    expect(climateOf(null)).toBe("mild");
  });

  it("builds the viewer's own life from what they wrote", () => {
    const life = lifeFromBackground({ location: "Dallas, Texas", work: "Nurse, rotating nights", household: "Wife and a toddler" });
    expect(life).toMatchObject({ own: true, climate: "hot_summer", work: "shifts", household: "kids" });
  });
});

describe("about them, in their own words", () => {
  it("lists only what they filled in", () => {
    expect(backgroundLines({ gender: "man", ethnicity: "Black", location: "Houston, Texas", work: " " })).toEqual([
      "- Gender: man",
      "- Background: Black",
      "- Lives in: Houston, Texas",
    ]);
    expect(formatBackground({})).toBeNull();
  });

  it("always carries the no-assumptions rules", () => {
    expect(formatBackground({ ethnicity: "Black" })).toMatch(/Never assume/);
  });
});
