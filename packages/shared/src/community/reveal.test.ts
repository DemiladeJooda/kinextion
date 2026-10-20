import { describe, expect, it } from "vitest";
import { REVEAL_HEADLINE, revealPercentages } from "./reveal.js";

describe("revealPercentages", () => {
  it("matches the concept's own example", () => {
    expect(revealPercentages({ agree: 44, mixed: 31, disagree: 25 })).toEqual({ agreePct: 44, mixedPct: 31, disagreePct: 25 });
  });

  it("always sums to 100", () => {
    for (const counts of [
      { agree: 1, mixed: 1, disagree: 1 },
      { agree: 2, mixed: 1, disagree: 0 },
      { agree: 7, mixed: 5, disagree: 3 },
      { agree: 166, mixed: 83, disagree: 69 },
    ]) {
      const p = revealPercentages(counts);
      expect(p.agreePct + p.mixedPct + p.disagreePct).toBe(100);
    }
  });

  it("gives thirds as 34/33/33, not an impossible 33/33/33", () => {
    expect(revealPercentages({ agree: 1, mixed: 1, disagree: 1 })).toEqual({ agreePct: 34, mixedPct: 33, disagreePct: 33 });
  });

  it("is all zeros when nobody reacted", () => {
    expect(revealPercentages({ agree: 0, mixed: 0, disagree: 0 })).toEqual({ agreePct: 0, mixedPct: 0, disagreePct: 0 });
  });
});

describe("the reveal's words", () => {
  it("say where the room landed, never what the community believes", () => {
    expect(REVEAL_HEADLINE).toBe("Here's where the room landed this week.");
    expect(REVEAL_HEADLINE).not.toMatch(/believe|thinks|agrees|decided|verdict/i);
  });
});
