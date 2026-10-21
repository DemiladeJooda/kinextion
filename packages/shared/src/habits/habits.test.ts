import { describe, it, expect } from "vitest";
import {
  addDays,
  dayOfWeek,
  dayStartInstant,
  isValidTimeZone,
  localDateKey,
  weekStartKey,
  consistencyBetween,
  describeSchedule,
  habitProgress,
  habitTotalsForDay,
  isDueOn,
  showingUpStreak,
  type DateKey,
  type ScheduledHabit,
} from "./index.js";

const set = (...keys: DateKey[]) => new Set(keys);
const daily: ScheduledHabit = { frequency: "daily" };
// 2026-10-19 is a Monday.
const MON = "2026-10-19";
const mwf: ScheduledHabit = { frequency: "custom", targetDays: [1, 3, 5] };
const weekly: ScheduledHabit = { frequency: "weekly" };

describe("dates", () => {
  it("puts 11:30pm in Dallas on the Dallas date, not tomorrow's UTC date", () => {
    const at = new Date("2026-10-21T04:30:00Z"); // 23:30 CDT on the 20th
    expect(localDateKey(at, "America/Chicago")).toBe("2026-10-20");
    expect(at.toISOString().slice(0, 10)).toBe("2026-10-21"); // the old bug
  });

  it("puts 12:30am in London on the London date", () => {
    const at = new Date("2026-10-19T23:30:00Z"); // 00:30 BST on the 20th
    expect(localDateKey(at, "Europe/London")).toBe("2026-10-20");
  });

  it("finds local midnight across both DST changes", () => {
    // US clocks fall back 1 Nov 2026 and spring forward 8 Mar 2026.
    expect(dayStartInstant("2026-11-01", "America/Chicago").toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(dayStartInstant("2026-11-02", "America/Chicago").toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(dayStartInstant("2026-03-08", "America/Chicago").toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(dayStartInstant("2026-03-09", "America/Chicago").toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(dayStartInstant("2026-10-20", "UTC").toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("does week arithmetic on keys", () => {
    expect(dayOfWeek(MON)).toBe(1);
    expect(weekStartKey("2026-10-25")).toBe(MON); // Sunday belongs to the week that began Monday
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("isDueOn", () => {
  it("daily is always due", () => {
    expect(isDueOn(daily, "2026-10-20", set())).toBe(true);
  });

  it("custom days are due only on those weekdays", () => {
    expect(isDueOn(mwf, MON, set())).toBe(true);
    expect(isDueOn(mwf, "2026-10-20", set())).toBe(false); // Tuesday
    expect(isDueOn(mwf, "2026-10-21", set())).toBe(true);
  });

  it("custom with no days picked behaves like daily", () => {
    expect(isDueOn({ frequency: "custom", targetDays: [] }, "2026-10-20", set())).toBe(true);
    expect(isDueOn({ frequency: "custom", targetDays: null }, "2026-10-20", set())).toBe(true);
  });

  it("weekly is due until done that week, and stays visible on the day it was done", () => {
    const done = set("2026-10-20");
    expect(isDueOn(weekly, MON, done)).toBe(true);
    expect(isDueOn(weekly, "2026-10-20", done)).toBe(true);
    expect(isDueOn(weekly, "2026-10-21", done)).toBe(false);
    expect(isDueOn(weekly, "2026-10-26", done)).toBe(true); // new week
  });

  it("nothing is due before the habit existed", () => {
    expect(isDueOn({ ...daily, startDate: "2026-10-20" }, MON, set())).toBe(false);
  });
});

describe("X times a week", () => {
  const thrice: ScheduledHabit = { frequency: "weekly", perWeekTarget: 3, startDate: "2026-10-05" };

  it("stays due until the week's target is met", () => {
    const done = set(MON, "2026-10-20");
    expect(isDueOn(thrice, "2026-10-21", done)).toBe(true); // 2 of 3
    expect(isDueOn(thrice, "2026-10-22", set(...done, "2026-10-21"))).toBe(false); // 3 of 3
  });

  it("only keeps a week that reached the target", () => {
    // Week of 5 Oct: 3 done. Week of 12 Oct: only 2.
    const done = set("2026-10-05", "2026-10-07", "2026-10-09", "2026-10-13", "2026-10-15");
    const p = habitProgress(thrice, done, "2026-10-20");
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(1);
    expect(p.consistency).toBe(1 / 2);
  });

  it("describes itself", () => {
    expect(describeSchedule(thrice)).toBe("3 times a week");
  });
});

describe("habitProgress", () => {
  it("matches the old rule for a daily habit", () => {
    const done = set("2026-10-17", "2026-10-18", MON);
    expect(habitProgress(daily, done, MON).streak).toBe(3);
    // Today not done yet: counts back from yesterday, not zero.
    expect(habitProgress(daily, done, "2026-10-20").streak).toBe(3);
    // A missed day ends it.
    expect(habitProgress(daily, done, "2026-10-21").streak).toBe(0);
  });

  it("an off-day never breaks a custom-day streak", () => {
    const done = set("2026-10-12", "2026-10-14", "2026-10-16", MON); // M W F M
    const p = habitProgress({ ...mwf, startDate: "2026-10-12" }, done, "2026-10-20"); // Tuesday
    expect(p.streak).toBe(4);
    expect(p.consistency).toBe(1);
  });

  it("a missed scheduled day does break it", () => {
    const done = set("2026-10-12", "2026-10-16", MON); // Wednesday missed
    const p = habitProgress({ ...mwf, startDate: "2026-10-12" }, done, MON);
    expect(p.streak).toBe(2);
    expect(p.bestStreak).toBe(2);
    expect(p.consistency).toBe(3 / 4);
  });

  it("weekly habits streak in weeks and leave this week open", () => {
    const done = set("2026-10-07", "2026-10-15"); // two previous weeks
    const p = habitProgress({ ...weekly, startDate: "2026-10-05" }, done, "2026-10-20");
    expect(p.unit).toBe("week");
    expect(p.streak).toBe(2);
    const withThisWeek = habitProgress({ ...weekly, startDate: "2026-10-05" }, set(...done, MON), "2026-10-20");
    expect(withThisWeek.streak).toBe(3);
  });

  it("keeps the best streak after the current one ends", () => {
    const done = set("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-06");
    const p = habitProgress({ ...daily, startDate: "2026-10-01" }, done, "2026-10-07");
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(4);
  });

  it("has no consistency before anything was due", () => {
    expect(habitProgress({ ...daily, startDate: "2026-10-20" }, set(), "2026-10-20").consistency).toBeNull();
  });
});

describe("consistencyBetween", () => {
  it("only counts scheduled days in the window", () => {
    const done = set(MON, "2026-10-23");
    // Mon–Sun: due Mon, Wed, Fri → 2 of 3.
    expect(consistencyBetween(mwf, done, MON, "2026-10-25")).toBeCloseTo(2 / 3);
  });
});

describe("habitTotalsForDay", () => {
  it("leaves unscheduled habits out of the denominator", () => {
    const habits = [
      { id: "a", ...daily },
      { id: "b", ...mwf },
    ];
    const completed = new Map([["a", set("2026-10-20")]]);
    expect(habitTotalsForDay(habits, completed, "2026-10-20")).toEqual({ habitsTotal: 1, habitsCompleted: 1 });
    expect(habitTotalsForDay(habits, completed, "2026-10-21")).toEqual({ habitsTotal: 2, habitsCompleted: 0 });
  });

  it("does not let an off-day completion push past 100%", () => {
    const habits = [{ id: "b", ...mwf }];
    const completed = new Map([["b", set("2026-10-20")]]);
    expect(habitTotalsForDay(habits, completed, "2026-10-20")).toEqual({ habitsTotal: 0, habitsCompleted: 0 });
  });
});

describe("showingUpStreak", () => {
  it("counts back from yesterday", () => {
    expect(showingUpStreak([daily], set("2026-10-18", MON), "2026-10-20")).toBe(2);
  });

  it("skips days when nothing was scheduled", () => {
    // Only a Mon/Wed/Fri habit: Tuesday and the weekend are neutral.
    const active = set("2026-10-16", MON, "2026-10-21"); // Fri, Mon, Wed
    expect(showingUpStreak([mwf], active, "2026-10-22")).toBe(3);
  });

  it("is not broken daily by a weekly-only habit", () => {
    expect(showingUpStreak([weekly], set("2026-10-15"), "2026-10-20")).toBe(1);
  });
});

describe("describeSchedule", () => {
  it("reads like a person wrote it", () => {
    expect(describeSchedule(daily)).toBe("Every day");
    expect(describeSchedule(mwf)).toBe("Mon · Wed · Fri");
    expect(describeSchedule({ frequency: "custom", targetDays: [0, 6] })).toBe("Sat · Sun");
    expect(describeSchedule(weekly)).toBe("Once a week");
  });
});
