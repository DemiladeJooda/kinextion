/**
 * The guides can see the user's habits.
 *
 * What has to hold: the section uses the tidied text, says what happened
 * today, carries the user's why and backup plan, never quotes a why flagged
 * as distress, and includes what they promised and what they said after a
 * miss — and the system prompt the guide gets actually contains it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db: { habits: Record<string, unknown>[]; logs: Record<string, unknown>[]; reflections: Record<string, unknown>[]; promises: Record<string, unknown>[] } = {
  habits: [],
  logs: [],
  reflections: [],
  promises: [],
};

vi.mock("@kinextion/database", () => ({
  prisma: {
    habit: { findMany: async () => db.habits },
    habitLog: { findMany: async () => db.logs },
    habitReflection: { findMany: async () => db.reflections },
    precommitment: { findMany: async () => db.promises },
  },
}));

const { habitsForChat } = await import("../src/lib/habits-for-chat.js");
const { buildContext } = await import("@kinextion/ai-core");

const TZ = "America/Chicago";

function habit(over: Record<string, unknown> = {}) {
  return {
    id: "h1",
    userId: "u1",
    name: "Push-ups",
    category: "physical",
    cue: "after i get my coffe",
    response: "2 pushups",
    craving: "im lazy and i hate it",
    reward: null,
    backupPlan: "If I'm rushed, I'll do 1",
    frequency: "daily",
    targetDays: null,
    perWeekTarget: null,
    timeWindow: "morning",
    status: "building",
    startsOn: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    polished: {
      source: "ai",
      cue: "After I pour my coffee",
      response: "2 push-ups",
      craving: "To feel strong and good in my body",
      of: { cue: "after i get my coffe", response: "2 pushups", craving: "im lazy and i hate it" },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T15:00:00Z")); // Wednesday morning in Dallas
  db.habits = [habit()];
  db.logs = [
    { habitId: "h1", date: new Date("2026-10-20T00:00:00Z"), completed: true, state: "done" },
    { habitId: "h1", date: new Date("2026-10-19T00:00:00Z"), completed: true, state: "done" },
  ];
  db.reflections = [];
  db.promises = [];
});

describe("habitsForChat", () => {
  it("describes each habit with the tidied plan, today's state and recent consistency", async () => {
    const { lines } = await habitsForChat("u1", TZ, null);
    expect(lines[0]).toContain("Push-ups (Body, every day)");
    expect(lines[0]).toContain("After I pour my coffee, I'll do 2 push-ups.");
    expect(lines[0]).toContain("not done yet today");
    expect(lines[0]).toContain("2-day streak");
    expect(lines.join("\n")).toContain("why it matters to them: To feel strong and good in my body");
    expect(lines.join("\n")).toContain("their backup plan: If I'm rushed, I'll do 1");
    // The raw self-criticism is never handed over.
    expect(lines.join("\n")).not.toContain("im lazy");
  });

  it("never includes a why flagged as distress, only a note to check in", async () => {
    db.habits = [habit({ polished: { ...habit().polished as object, concern: true } })];
    const text = (await habitsForChat("u1", TZ, null)).lines.join("\n");
    expect(text).not.toContain("why it matters to them");
    expect(text).toContain("never quote it");
  });

  it("includes what they promised and what they said after a miss", async () => {
    db.promises = [{ habitId: "h1", forDate: new Date("2026-10-21T00:00:00Z"), text: "After I pour my coffee, I'll do 2 push-ups." }];
    db.reflections = [{ habitId: "h1", date: new Date("2026-10-18T00:00:00Z"), answer: "mornings are too rushed" }];
    const text = (await habitsForChat("u1", TZ, null)).lines.join("\n");
    expect(text).toContain("They promised for today: After I pour my coffee");
    expect(text).toContain('they said: "mornings are too rushed"');
  });

  it("says when a habit is paused or graduated", async () => {
    db.habits = [habit({ status: "paused" }), habit({ id: "h2", name: "Walk", status: "established" })];
    const lines = (await habitsForChat("u1", TZ, null)).lines;
    expect(lines.find((l) => l.startsWith("- Push-ups"))).toContain("paused");
    expect(lines.find((l) => l.startsWith("- Walk"))).toContain("graduated");
  });
});

describe("the guide's system prompt", () => {
  it("contains the habits section and the identity goal, with the rules for using them", async () => {
    const habits = await habitsForChat("u1", TZ, "someone who moves every day");
    const { systemPrompt } = buildContext("altheo", { habits }, []);
    expect(systemPrompt).toContain("## Their Habits");
    expect(systemPrompt).toContain("Who they're becoming, in their words: someone who moves every day");
    expect(systemPrompt).toContain("Push-ups");
    expect(systemPrompt).toMatch(/never guilt them about a miss/);
  });
});
