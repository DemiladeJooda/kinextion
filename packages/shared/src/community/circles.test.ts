import { describe, expect, it } from "vitest";
import { CIRCLE_MAX } from "./constants.js";
import { assignCircle, circleCountFor, type CircleState } from "./circles.js";

/** Seat `n` speakers one at a time, applying each placement, as the API does. */
function seat(expectedSpeakers: number, n: number, partnersFor: (i: number) => Map<string, number> = () => new Map()) {
  const circles: Array<CircleState & { members: string[] }> = [];
  for (let i = 0; i < n; i++) {
    const placement = assignCircle({ circles, expectedSpeakers, recentPartners: partnersFor(i) });
    const speaker = `s${i}`;
    if (placement.kind === "new") circles.push({ id: `c${placement.ordinal}`, ordinal: placement.ordinal, members: [speaker] });
    else circles.find((c) => c.id === placement.circleId)!.members.push(speaker);
  }
  return circles;
}

describe("circleCountFor", () => {
  it.each([
    [0, 1],
    [1, 1],
    [12, 1],
    [13, 2],
    [24, 2],
    [25, 3],
    [300, 25],
  ])("%i expected speakers → %i circles", (expected, count) => {
    expect(circleCountFor(expected)).toBe(count);
  });
});

describe("assignCircle", () => {
  it("keeps a typical community in one room", () => {
    const circles = seat(9, 9);
    expect(circles).toHaveLength(1);
    expect(circles[0].members).toHaveLength(9);
  });

  it("never lets a circle pass the cap", () => {
    const circles = seat(30, 30);
    expect(circles).toHaveLength(3);
    for (const c of circles) expect(c.members.length).toBeLessThanOrEqual(CIRCLE_MAX);
  });

  it("spreads early speakers so nobody is stranded alone in a second room", () => {
    // 24 expected: the first four speakers go two and two, not four and zero.
    const circles = seat(24, 4);
    expect(circles.map((c) => c.members.length).sort()).toEqual([2, 2]);
  });

  it("keeps circles within one member of each other", () => {
    for (const n of [13, 17, 25, 31]) {
      const sizes = seat(n, n).map((c) => c.members.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("opens another circle when more people speak than chose the community", () => {
    const circles = seat(10, 14);
    expect(circles).toHaveLength(2);
    expect(circles.every((c) => c.members.length <= CIRCLE_MAX)).toBe(true);
  });

  it("places a speaker away from the people they've sat with recently", () => {
    const circles: CircleState[] = [
      { id: "a", ordinal: 0, members: ["friend1", "friend2", "x"] },
      { id: "b", ordinal: 1, members: ["y", "z", "w"] },
    ];
    const recentPartners = new Map([
      ["friend1", 3],
      ["friend2", 2],
    ]);
    expect(assignCircle({ circles, expectedSpeakers: 20, recentPartners })).toEqual({ kind: "existing", circleId: "b" });
  });

  it("won't unbalance circles just to avoid familiar faces", () => {
    const circles: CircleState[] = [
      { id: "a", ordinal: 0, members: ["friend1"] },
      { id: "b", ordinal: 1, members: ["y", "z", "w"] },
    ];
    const placement = assignCircle({ circles, expectedSpeakers: 20, recentPartners: new Map([["friend1", 5]]) });
    expect(placement).toEqual({ kind: "existing", circleId: "a" });
  });

  it("is deterministic", () => {
    expect(seat(40, 40)).toEqual(seat(40, 40));
  });
});
