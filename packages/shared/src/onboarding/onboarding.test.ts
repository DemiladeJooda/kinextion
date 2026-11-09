import { describe, expect, it } from "vitest";
import { GET_TO_KNOW, habitFromProposal, nextGetToKnow, type HabitProposal } from "./index.js";
import { AVATAR_ACTIVITIES, activityFor, avatarPrompt, avatarRequestSchema } from "../avatar/index.js";
import { createHabitSchema, onboardingSchema } from "../schemas/index.js";

const proposal: HabitProposal = {
  name: "Morning move",
  anchor: "After I get dressed",
  tiny: "Ten squats in the kitchen",
  full: "Twenty minutes at the gym",
  timeWindow: "morning",
  daysPerWeek: 2,
};

describe("habitFromProposal", () => {
  it("carries their why and produces a valid habit", () => {
    const habit = habitFromProposal(proposal, "For my kids", "physical");
    expect(habit.craving).toBe("For my kids");
    expect(habit.frequency).toBe("weekly");
    expect(habit.perWeekTarget).toBe(2);
    expect(createHabitSchema.safeParse(habit).success).toBe(true);
  });

  it("treats seven days a week as daily", () => {
    const habit = habitFromProposal({ ...proposal, daysPerWeek: 7 }, undefined, "physical");
    expect(habit.frequency).toBe("daily");
    expect(createHabitSchema.safeParse(habit).success).toBe(true);
  });
});

describe("getting to know you", () => {
  it("asks one question a day, in order, and stops when done", () => {
    expect(nextGetToKnow({ done: [], lastShown: "2026-11-08" }, "2026-11-08")).toBeNull();
    expect(nextGetToKnow({ done: [], lastShown: "2026-11-08" }, "2026-11-09")?.id).toBe(GET_TO_KNOW[0].id);
    expect(nextGetToKnow({ done: GET_TO_KNOW.map((q) => q.id), lastShown: null }, "2026-11-09")).toBeNull();
  });

  it("always says why it's asking", () => {
    for (const q of GET_TO_KNOW) expect(q.why.length).toBeGreaterThan(10);
  });

  it("lets someone finish onboarding without the questions now asked later", () => {
    expect(onboardingSchema.safeParse({ displayName: "Dee", primaryGoals: ["My sleep"] }).success).toBe(true);
  });
});

describe("avatar", () => {
  const photo = "a".repeat(2000);

  it("needs consent", () => {
    expect(avatarRequestSchema.safeParse({ kind: "base", images: [photo, photo] }).success).toBe(false);
    expect(avatarRequestSchema.safeParse({ kind: "base", consent: true, images: [photo, photo] }).success).toBe(true);
  });

  it("never lets a prompt change someone's body", () => {
    const requests = [
      { kind: "base", consent: true, images: [photo, photo] },
      { kind: "mood", consent: true, mood: "sad", avatar: photo, face: photo },
      ...AVATAR_ACTIVITIES.map((a) => ({ kind: "scene", consent: true, activity: a.id, frame: "start", avatar: photo })),
    ] as const;
    for (const r of requests) {
      const prompt = avatarPrompt(avatarRequestSchema.parse(r));
      expect(prompt).toMatch(/true body shape/);
      expect(prompt).toMatch(/Do not make them slimmer/);
      expect(prompt).toMatch(/fully and modestly clothed/);
    }
  });

  it("only draws activities it knows", () => {
    expect(avatarPrompt({ kind: "scene", consent: true, activity: "anything else", frame: "end", avatar: photo })).toBeNull();
  });

  it("matches habit names to activities", () => {
    expect(activityFor("Evening walk")?.id).toBe("walk");
    expect(activityFor("Read 10 pages")?.id).toBe("read");
    expect(activityFor("Call my mum")).toBeNull();
  });
});
