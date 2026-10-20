import { describe, expect, it } from "vitest";
import { correlateByDate, MIN_CORRELATION_SAMPLE, type DailyPoint } from "./insights.js";

/** Six consecutive days from 2026-06-01, paired with the given values. */
function series(values: number[]): DailyPoint[] {
  return values.map((value, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    value,
  }));
}

describe("correlateByDate", () => {
  it("returns +1 for a perfectly increasing relationship", () => {
    const result = correlateByDate(series([1, 2, 3, 4, 5]), series([2, 4, 6, 8, 10]));
    expect(result?.r).toBeCloseTo(1, 10);
    expect(result?.n).toBe(5);
  });

  it("returns -1 for a perfectly inverse relationship", () => {
    const result = correlateByDate(series([1, 2, 3, 4, 5]), series([10, 8, 6, 4, 2]));
    expect(result?.r).toBeCloseTo(-1, 10);
  });

  it("returns near zero for unrelated series", () => {
    const result = correlateByDate(series([1, 2, 3, 4, 5]), series([3, 1, 4, 1, 5]));
    expect(Math.abs(result!.r)).toBeLessThan(0.5);
  });

  it("refuses to report below the minimum sample", () => {
    const short = series([1, 2, 3, 4]);
    expect(short).toHaveLength(MIN_CORRELATION_SAMPLE - 1);
    expect(correlateByDate(short, short)).toBeNull();
  });

  it("counts only overlapping dates, not the longer series", () => {
    const a = series([1, 2, 3, 4, 5, 6]);
    // Same values but shifted a week, so no date matches.
    const b = a.map((p, i) => ({ date: `2026-07-0${i + 1}`, value: p.value }));
    expect(correlateByDate(a, b)).toBeNull();
  });

  it("pairs by date rather than by position", () => {
    const a: DailyPoint[] = [
      { date: "2026-06-01", value: 1 },
      { date: "2026-06-02", value: 2 },
      { date: "2026-06-03", value: 3 },
      { date: "2026-06-04", value: 4 },
      { date: "2026-06-05", value: 5 },
    ];
    // Same pairs, reversed order — a positional zip would give -1 instead.
    const b = [...a].reverse().map((p) => ({ date: p.date, value: p.value * 2 }));
    expect(correlateByDate(a, b)?.r).toBeCloseTo(1, 10);
  });

  it("returns null when one side is flat (no variance to correlate)", () => {
    // A constant series has zero variance; r would be a division by zero.
    expect(correlateByDate(series([1, 2, 3, 4, 5]), series([7, 7, 7, 7, 7]))).toBeNull();
  });

  it("handles both sides flat without dividing by zero", () => {
    expect(correlateByDate(series([2, 2, 2, 2, 2]), series([9, 9, 9, 9, 9]))).toBeNull();
  });

  it("is symmetric in its arguments", () => {
    const a = series([1, 5, 2, 8, 3]);
    const b = series([2, 3, 9, 1, 4]);
    expect(correlateByDate(a, b)?.r).toBeCloseTo(correlateByDate(b, a)!.r, 10);
  });

  it("returns null for empty input rather than throwing", () => {
    expect(correlateByDate([], [])).toBeNull();
    expect(correlateByDate(series([1, 2, 3, 4, 5]), [])).toBeNull();
  });
});
