import { describe, expect, it } from "vitest";
import {
  plannedReminders,
  reminderBody,
  shouldOfferToFade,
  type ReminderHabit,
} from "./index.js";

const TUE = "2026-10-20";
const at = (h: number, m = 0) => h * 60 + m;

function habit(over: Partial<ReminderHabit> = {}): ReminderHabit {
  return {
    id: "h1",
    name: "Push-ups",
    frequency: "daily",
    timeWindow: "morning",
    reminderEnabled: true,
    startDate: "2026-10-01",
    display: { cue: "After I pour my coffee", response: "2 push-ups", craving: "To start the day ahead" },
    completed: new Set(),
    rest: new Set(),
    ...over,
  };
}

describe("reminderBody", () => {
  it("names the anchor, the tiny version and the user's own reason", () => {
    expect(reminderBody(habit())).toBe("After I pour my coffee: 2 push-ups. To start the day ahead.");
  });

  it("copes with missing pieces", () => {
    expect(reminderBody(habit({ display: { cue: "", response: "", craving: "" } }))).toBe("Push-ups.");
  });
});

describe("plannedReminders", () => {
  it("schedules each open habit at the start of its part of the day", () => {
    const r = plannedReminders([habit()], TUE, at(6), { lastCall: false, daysAhead: 1 });
    expect(r).toEqual([
      expect.objectContaining({ id: "habit-h1-2026-10-20", hour: 8, minute: 0, title: "Push-ups" }),
    ]);
  });

  it("skips a time that has already passed today, but plans tomorrow", () => {
    const r = plannedReminders([habit()], TUE, at(9), { lastCall: false, daysAhead: 2 });
    expect(r.map((x) => x.day)).toEqual(["2026-10-21"]);
  });

  it("sends nothing for a habit that's done, rested, or not due", () => {
    const done = habit({ completed: new Set([TUE]) });
    const rested = habit({ id: "h2", rest: new Set([TUE]) });
    const offDay = habit({ id: "h3", frequency: "custom", targetDays: [1, 3, 5] }); // Tuesday off
    expect(plannedReminders([done, rested, offDay], TUE, at(6), { daysAhead: 1 })).toEqual([]);
  });

  it("respects the per-habit switch, any-time habits and paused or graduated ones", () => {
    const list = [
      habit({ reminderEnabled: false }),
      habit({ id: "h2", status: "paused" }),
      habit({ id: "h3", status: "established" }),
      habit({ id: "h4", timeWindow: "anytime" }),
    ];
    const r = plannedReminders(list, TUE, at(6), { daysAhead: 1 });
    // Only the any-time habit, and only in the evening last call.
    expect(r).toEqual([expect.objectContaining({ kind: "last-call", title: "One left today" })]);
  });

  it("lists what's still open in one evening last call", () => {
    const list = [habit(), habit({ id: "h2", name: "Read a page", timeWindow: "evening" })];
    const r = plannedReminders(list, TUE, at(19), { daysAhead: 1 });
    expect(r).toEqual([
      expect.objectContaining({
        id: "lastcall-2026-10-20",
        hour: 20,
        body: "Push-ups, Read a page. Even the tiny version counts.",
      }),
    ]);
  });

  it("stays under the iOS limit with many habits", () => {
    const many = Array.from({ length: 40 }, (_, i) => habit({ id: `h${i}` }));
    expect(plannedReminders(many, TUE, at(6)).length).toBeLessThanOrEqual(60);
  });

  it("is in time order", () => {
    const list = [habit({ timeWindow: "evening" }), habit({ id: "h2", timeWindow: "morning" })];
    const r = plannedReminders(list, TUE, at(6), { lastCall: false, daysAhead: 1 });
    expect(r.map((x) => x.hour)).toEqual([8, 18]);
  });
});

describe("shouldOfferToFade", () => {
  it("offers once a daily habit has held for two weeks", () => {
    const base = { reminderEnabled: true, timeWindow: "morning" as const, streakUnit: "day" as const };
    expect(shouldOfferToFade({ ...base, streak: 14 })).toBe(true);
    expect(shouldOfferToFade({ ...base, streak: 13 })).toBe(false);
    expect(shouldOfferToFade({ ...base, streak: 20, reminderEnabled: false })).toBe(false);
  });
});
