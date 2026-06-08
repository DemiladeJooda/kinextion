import { describe, it, expect } from "vitest";
import { calculateKinextionScore } from "./index.js";
import type { ScoreBreakdown } from "../types/index.js";

describe("calculateKinextionScore", () => {
  it("returns 0 for no activity", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 0,
      habitsTotal: 0,
      workoutLogged: false,
      moodCheckedIn: false,
      reflectionDone: false,
      streakDays: 0,
    };
    expect(calculateKinextionScore(breakdown)).toBe(0);
  });

  it("returns max score for perfect day", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 5,
      habitsTotal: 5,
      workoutLogged: true,
      moodCheckedIn: true,
      reflectionDone: true,
      streakDays: 10,
    };
    expect(calculateKinextionScore(breakdown)).toBe(100);
  });

  it("calculates partial habit completion correctly", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 2,
      habitsTotal: 4,
      workoutLogged: false,
      moodCheckedIn: false,
      reflectionDone: false,
      streakDays: 0,
    };
    // 2/4 * 40 = 20
    expect(calculateKinextionScore(breakdown)).toBe(20);
  });

  it("caps streak bonus at max", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 0,
      habitsTotal: 0,
      workoutLogged: false,
      moodCheckedIn: false,
      reflectionDone: false,
      streakDays: 100,
    };
    // streak bonus capped at 10
    expect(calculateKinextionScore(breakdown)).toBe(10);
  });

  it("never exceeds 100", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 10,
      habitsTotal: 10,
      workoutLogged: true,
      moodCheckedIn: true,
      reflectionDone: true,
      streakDays: 50,
    };
    expect(calculateKinextionScore(breakdown)).toBeLessThanOrEqual(100);
  });

  it("includes all score components", () => {
    const breakdown: ScoreBreakdown = {
      habitsCompleted: 3,
      habitsTotal: 3,
      workoutLogged: true,
      moodCheckedIn: true,
      reflectionDone: true,
      streakDays: 3,
    };
    // habits: 40, workout: 20, mood: 15, reflection: 15, streak: 6 = 96
    expect(calculateKinextionScore(breakdown)).toBe(96);
  });
});
