import { describe, expect, it } from "vitest";
import { updateHabitSchema } from "../schemas/index.js";
import {
  changeToUpdate,
  coachFor,
  describeChange,
  habitChangeSchema,
  whatWouldItTake,
  type HabitChange,
} from "./index.js";

const changes: HabitChange[] = [
  { type: "shrink", response: "1 push-up" },
  { type: "move", cue: "After lunch", timeWindow: "midday" },
  { type: "schedule", frequency: "custom", targetDays: [1, 3, 5] },
  { type: "schedule", frequency: "weekly", perWeekTarget: 3 },
  { type: "pause" },
];

describe("changeToUpdate", () => {
  it("turns every change into an edit the API accepts", () => {
    for (const c of changes) {
      const update = changeToUpdate(c)!;
      expect(updateHabitSchema.safeParse(update).success, c.type).toBe(true);
    }
  });

  it("pauses rather than archives, and changes nothing for 'none'", () => {
    expect(changeToUpdate({ type: "pause" })).toEqual({ status: "paused" });
    expect(changeToUpdate({ type: "none" })).toBeNull();
    expect(changeToUpdate({ type: "move" })).toBeNull();
  });
});

describe("describeChange", () => {
  it("says exactly what will change", () => {
    expect(changes.map(describeChange)).toEqual([
      'Make the tiny version "1 push-up"',
      'Move it: do it "After lunch", in midday',
      "Make it Mon, Wed, Fri",
      "Make it 3 times a week",
      "Pause it for now (no misses while paused)",
    ]);
  });
});

describe("habitChangeSchema", () => {
  it("rejects anything the app doesn't know how to do", () => {
    expect(habitChangeSchema.safeParse({ type: "delete" }).success).toBe(false);
    expect(habitChangeSchema.safeParse({ type: "shrink", response: "" }).success).toBe(false);
  });
});

describe("who asks", () => {
  it("is Altheo for Body habits and Kairo otherwise", () => {
    expect(coachFor("physical")).toBe("altheo");
    expect(coachFor("emotional")).toBe("kairo");
    expect(whatWouldItTake("Morning Walk")).toBe("What would it take to make morning walk easier tomorrow?");
  });
});
