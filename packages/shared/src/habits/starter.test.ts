import { describe, expect, it } from "vitest";
import { GOAL_OPTIONS } from "../constants/index.js";
import { createHabitSchema, identityGoalSchema } from "../schemas/index.js";
import {
  BUILDING_SOFT_LIMIT,
  allStarterHabits,
  buildingCount,
  describeHabitPlan,
  identitySuggestions,
  nextMondayKey,
  starterHabitsFor,
  starterToCreateInput,
} from "./index.js";

describe("starter menu", () => {
  it("offers 3 to 5 habits for every onboarding goal", () => {
    for (const goal of GOAL_OPTIONS) {
      const menu = starterHabitsFor(goal);
      expect(menu.length, goal).toBeGreaterThanOrEqual(3);
      expect(menu.length, goal).toBeLessThanOrEqual(5);
    }
  });

  it("falls back to a general menu for a typed-in goal", () => {
    expect(starterHabitsFor("Train for a marathon").length).toBeGreaterThanOrEqual(3);
    expect(starterHabitsFor(null).length).toBeGreaterThanOrEqual(3);
  });

  it("builds every starter with an anchor, a tiny version and a reason", () => {
    for (const h of allStarterHabits()) {
      expect(h.anchor, h.id).toMatch(/^(After|When) /);
      expect(h.tiny.length, h.id).toBeGreaterThan(0);
      expect(h.why.length, h.id).toBeGreaterThan(0);
    }
  });

  it("turns every starter into a habit the API accepts", () => {
    for (const h of allStarterHabits()) {
      const parsed = createHabitSchema.safeParse(starterToCreateInput(h, "2026-10-26"));
      expect(parsed.success, h.id).toBe(true);
    }
  });

  it("gives certain-days starters weekdays and weekly starters a target", () => {
    const focus = allStarterHabits().find((h) => h.id === "first-focus-block")!;
    expect(starterToCreateInput(focus).targetDays).toEqual([1, 2, 3, 4, 5]);
    const gym = allStarterHabits().find((h) => h.id === "gym-sessions")!;
    expect(starterToCreateInput(gym).perWeekTarget).toBe(4);
  });

  it("has unique ids", () => {
    const ids = allStarterHabits().map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("identity suggestions", () => {
  it("are valid identity goals for every onboarding goal", () => {
    for (const goal of [...GOAL_OPTIONS, "Something typed in"]) {
      for (const phrase of identitySuggestions(goal)) {
        expect(identityGoalSchema.safeParse(phrase).success, phrase).toBe(true);
      }
    }
  });
});

describe("buildingCount", () => {
  it("counts only active habits still being built", () => {
    const habits = [
      { status: "building" },
      { status: "building", isActive: false },
      { status: "established" },
      { status: null },
    ];
    expect(buildingCount(habits)).toBe(2);
    expect(BUILDING_SOFT_LIMIT).toBe(3);
  });
});

describe("nextMondayKey", () => {
  it("is today on a Monday and the coming Monday otherwise", () => {
    expect(nextMondayKey("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(nextMondayKey("2026-10-20")).toBe("2026-10-26"); // Tuesday
    expect(nextMondayKey("2026-10-25")).toBe("2026-10-26"); // Sunday
  });
});

describe("describeHabitPlan", () => {
  it("writes the plan as one sentence", () => {
    expect(
      describeHabitPlan({ name: "Push-ups", cue: "After I pour my coffee", response: "2 push-ups" }).plan
    ).toBe("After I pour my coffee, I'll do 2 push-ups.");
  });

  it("uses the name when there's no tiny version, and copes with no anchor", () => {
    expect(describeHabitPlan({ name: "Read a page" }).plan).toBe("I'll read a page.");
    expect(describeHabitPlan({ name: "x", cue: "when I get home,", response: "Walk the dog" }).plan).toBe(
      "When I get home, I'll walk the dog."
    );
  });

  it("keeps acronyms and adds the extras", () => {
    const r = describeHabitPlan({
      name: "TV off",
      cue: "After dinner",
      response: "TV off by 10",
    });
    expect(r.plan).toBe("After dinner, I'll TV off by 10.");
    const full = describeHabitPlan({
      name: "TV off",
      cue: "After dinner",
      response: "Turn the TV off by 10",
      fullVersion: "No screens after 9",
      backupPlan: "If I'm out late, I'll put my phone on the charger",
    });
    expect(full.plan).toBe("After dinner, I'll turn the TV off by 10.");
    expect(full.extras).toEqual([
      "On a good day: no screens after 9.",
      "If I'm out late, I'll put my phone on the charger.",
    ]);
  });
});
