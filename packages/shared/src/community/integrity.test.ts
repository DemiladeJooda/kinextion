import { describe, expect, it } from "vitest";
import { RESTRICTION_DAYS } from "./constants.js";
import { restrictedUntil } from "./integrity.js";

const DAY = 86_400_000;
const now = new Date("2026-09-20T12:00:00Z");
const ago = (days: number) => ({ createdAt: new Date(now.getTime() - days * DAY) });

describe("restrictedUntil", () => {
  it("doesn't restrict for one or two strikes", () => {
    expect(restrictedUntil([ago(1)], now)).toBeNull();
    expect(restrictedUntil([ago(1), ago(2)], now)).toBeNull();
  });

  it("restricts for a week from the third strike in the window", () => {
    expect(restrictedUntil([ago(10), ago(5), ago(1)], now)).toEqual(
      new Date(now.getTime() - DAY + RESTRICTION_DAYS * DAY)
    );
  });

  it("ignores strikes older than the window", () => {
    expect(restrictedUntil([ago(40), ago(35), ago(1)], now)).toBeNull();
  });

  it("ends on its own — restrictions are always temporary", () => {
    expect(restrictedUntil([ago(12), ago(10), ago(8)], now)).toBeNull();
  });
});
