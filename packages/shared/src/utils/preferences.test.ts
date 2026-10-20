/**
 * Preference profile tests.
 *
 * Most of these are about restraint rather than maths. The failure mode this
 * feature has to avoid is telling someone "you prefer Body suggestions" on the
 * strength of two taps — so the majority of what's pinned here is the set of
 * conditions under which the system says nothing at all.
 */

import { describe, expect, it } from "vitest";
import {
  buildPreferenceProfile,
  describePreferences,
  partOfDay,
  MIN_PREFERENCE_SAMPLE,
  MIN_SEGMENT_SAMPLE,
  type RecommendationOutcome,
} from "./preferences.js";

/** n outcomes in one category/hour, `actedCount` of them acted on. */
function outcomes(
  n: number,
  actedCount: number,
  category = "physical",
  hour = 9
): RecommendationOutcome[] {
  return Array.from({ length: n }, (_, i) => ({
    category,
    hour,
    acted: i < actedCount,
    dismissed: i >= actedCount,
  }));
}

describe("partOfDay", () => {
  it("splits the day the way a person would", () => {
    expect(partOfDay(7)).toBe("morning");
    expect(partOfDay(13)).toBe("afternoon");
    expect(partOfDay(21)).toBe("evening");
  });
});

describe("buildPreferenceProfile", () => {
  it("claims nothing before there is enough history", () => {
    const profile = buildPreferenceProfile(outcomes(MIN_PREFERENCE_SAMPLE - 1, 5));

    expect(profile.overallRate).toBeNull();
    expect(profile.categories).toEqual([]);
    expect(profile.provisional).toBe(true);
    expect(describePreferences(profile)).toEqual([]);
  });

  it("does not count an unanswered recommendation as a rejection", () => {
    const open: RecommendationOutcome[] = Array.from({ length: 20 }, () => ({
      category: "physical",
      hour: 9,
      acted: false,
      dismissed: false,
    }));

    const profile = buildPreferenceProfile([...outcomes(8, 8), ...open]);

    // 8 answered, all acted on — the 20 ignored ones are absence of evidence,
    // not evidence of dislike, and must not drag the rate to 8/28.
    expect(profile.answered).toBe(8);
    expect(profile.overallRate).toBe(1);
  });

  it("states an overall rate once there is enough to state one", () => {
    const profile = buildPreferenceProfile(outcomes(10, 6));

    expect(profile.answered).toBe(10);
    expect(profile.acted).toBe(6);
    expect(profile.overallRate).toBeCloseTo(0.6);
  });

  it("ignores a segment that is too small to compare", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 5, "physical", 9),
      // Three perfect hits, but three is not a pattern.
      ...outcomes(MIN_SEGMENT_SAMPLE - 1, MIN_SEGMENT_SAMPLE - 1, "spiritual", 9),
    ]);

    expect(profile.categories.map((c) => c.key)).not.toContain("spiritual");
  });

  it("ignores a segment that barely differs from the baseline", () => {
    // Both categories sit near the overall rate, so neither is worth saying.
    const profile = buildPreferenceProfile([
      ...outcomes(10, 5, "physical", 9),
      ...outcomes(10, 6, "mental", 9),
    ]);

    expect(profile.categories).toEqual([]);
  });

  it("surfaces a category that genuinely outperforms the baseline", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 8, "physical", 9),
      ...outcomes(10, 2, "spiritual", 9),
    ]);

    const physical = profile.categories.find((c) => c.key === "physical");
    expect(physical).toBeDefined();
    expect(physical?.rate).toBeCloseTo(0.8);
    expect(physical?.n).toBe(10);
    expect(physical?.lift).toBeGreaterThan(0);
  });

  it("surfaces what someone reliably ignores, not just what they take", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 9, "physical", 9),
      ...outcomes(10, 1, "spiritual", 9),
    ]);

    const spiritual = profile.categories.find((c) => c.key === "spiritual");
    expect(spiritual?.lift).toBeLessThan(0);
  });

  it("orders segments by strength of signal, in either direction", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 10, "physical", 9),
      ...outcomes(10, 6, "mental", 9),
      ...outcomes(10, 0, "spiritual", 9),
    ]);

    const strongest = Math.abs(profile.categories[0].lift);
    for (const c of profile.categories.slice(1)) {
      expect(Math.abs(c.lift)).toBeLessThanOrEqual(strongest);
    }
  });

  it("learns time of day separately from category", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(8, 8, "physical", 8), // mornings land
      ...outcomes(8, 0, "physical", 20), // evenings don't
    ]);

    const morning = profile.timesOfDay.find((t) => t.key === "morning");
    const evening = profile.timesOfDay.find((t) => t.key === "evening");
    expect(morning?.lift).toBeGreaterThan(0);
    expect(evening?.lift).toBeLessThan(0);
    // Category is uniform here, so there is nothing to say about it.
    expect(profile.categories).toEqual([]);
  });

  it("marks a young profile as provisional", () => {
    expect(buildPreferenceProfile(outcomes(10, 6)).provisional).toBe(true);
    expect(buildPreferenceProfile(outcomes(30, 18)).provisional).toBe(false);
  });
});

describe("describePreferences", () => {
  it("puts a sample size on every claim it makes", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 9, "physical", 9),
      ...outcomes(10, 1, "spiritual", 9),
    ]);

    const lines = describePreferences(profile);
    expect(lines.length).toBeGreaterThan(1);
    // "9 of 10", "1 of 10", "10 of 20" — a bare percentage with no denominator
    // is exactly the kind of claim this codebase doesn't make.
    for (const line of lines) expect(line).toMatch(/\d+ of \d+/);
  });

  it("uses the label the caller supplies", () => {
    const profile = buildPreferenceProfile([
      ...outcomes(10, 9, "physical", 9),
      ...outcomes(10, 1, "spiritual", 9),
    ]);

    const lines = describePreferences(profile, (k) => (k === "physical" ? "Body" : k));
    expect(lines.some((l) => l.startsWith("Body"))).toBe(true);
  });

  it("says nothing at all when the profile says nothing", () => {
    expect(describePreferences(buildPreferenceProfile(outcomes(3, 3)))).toEqual([]);
  });
});
