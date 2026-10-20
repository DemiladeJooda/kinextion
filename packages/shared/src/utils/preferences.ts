/**
 * What a person actually acts on.
 *
 * Every micro-recommendation ends in one of three states: acted, dismissed, or
 * still open. This turns that history into a preference profile — which
 * categories land, which times of day land — so the next recommendation is
 * shaped by what worked for *this* person rather than what sounds sensible in
 * general.
 *
 * The honesty rules here mirror insights.ts, and for the same reason: a
 * confident claim built on three data points is worse than no claim, because
 * the user can tell it's guessing and stops believing the ones that aren't.
 * Nothing is asserted until there's enough evidence, an unanswered
 * recommendation is never counted as a rejection, and every statement carries
 * its sample size.
 */

/** One recommendation's fate. */
export interface RecommendationOutcome {
  /** Wellness category the recommendation belonged to. */
  category: string;
  /** The user's local hour when it was shown, 0–23. */
  hour: number;
  acted: boolean;
  dismissed: boolean;
}

/**
 * Answered recommendations before any preference is claimed.
 *
 * At roughly one a day this is a week and a bit of real engagement — early
 * enough to be useful, late enough that a couple of unusual days can't define
 * someone.
 */
export const MIN_PREFERENCE_SAMPLE = 8;

/** Answered recommendations within a single segment before it's comparable. */
export const MIN_SEGMENT_SAMPLE = 4;

/**
 * How far a segment must sit from the user's own baseline to be worth saying.
 * Expressed in percentage points: 20 means a segment at 65% against an overall
 * 45% qualifies, but 52% against 45% is noise.
 */
export const MIN_PREFERENCE_LIFT = 0.2;

export type PartOfDay = "morning" | "afternoon" | "evening";

export function partOfDay(hour: number): PartOfDay {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export interface SegmentPreference {
  /** Category name or part of day. */
  key: string;
  acted: number;
  /** Answered recommendations in this segment. */
  n: number;
  /** acted / n. */
  rate: number;
  /** Distance from the user's overall rate, as a signed fraction. */
  lift: number;
}

export interface PreferenceProfile {
  /** Recommendations the user actually responded to. */
  answered: number;
  acted: number;
  /** Null until there's enough history to state one. */
  overallRate: number | null;
  /** Segments clearing both the sample and lift bars, strongest first. */
  categories: SegmentPreference[];
  timesOfDay: SegmentPreference[];
  /** True when the profile is thin enough that callers should say so. */
  provisional: boolean;
}

/** An open recommendation is not evidence of anything — it's just unanswered. */
function isAnswered(o: RecommendationOutcome): boolean {
  return o.acted || o.dismissed;
}

function segment(
  outcomes: RecommendationOutcome[],
  keyOf: (o: RecommendationOutcome) => string,
  overallRate: number
): SegmentPreference[] {
  const groups = new Map<string, RecommendationOutcome[]>();
  for (const o of outcomes) {
    const key = keyOf(o);
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }

  const results: SegmentPreference[] = [];
  for (const [key, list] of groups) {
    if (list.length < MIN_SEGMENT_SAMPLE) continue;
    const acted = list.filter((o) => o.acted).length;
    const rate = acted / list.length;
    const lift = rate - overallRate;
    if (Math.abs(lift) < MIN_PREFERENCE_LIFT) continue;
    results.push({ key, acted, n: list.length, rate, lift });
  }

  // Strongest signal first, in either direction — a segment someone reliably
  // ignores is as useful to know as one they reliably take.
  return results.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

export function buildPreferenceProfile(
  outcomes: readonly RecommendationOutcome[]
): PreferenceProfile {
  const answered = outcomes.filter(isAnswered);
  const acted = answered.filter((o) => o.acted).length;

  if (answered.length < MIN_PREFERENCE_SAMPLE) {
    return {
      answered: answered.length,
      acted,
      overallRate: null,
      categories: [],
      timesOfDay: [],
      provisional: true,
    };
  }

  const overallRate = acted / answered.length;

  return {
    answered: answered.length,
    acted,
    overallRate,
    categories: segment(answered, (o) => o.category, overallRate),
    timesOfDay: segment(answered, (o) => partOfDay(o.hour), overallRate),
    // Under about three weeks of answers, treat conclusions as early rather
    // than settled — the wording downstream softens accordingly.
    provisional: answered.length < MIN_PREFERENCE_SAMPLE * 2,
  };
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * The profile as plain sentences.
 *
 * Deliberately one function feeding both the model prompt and the screen the
 * user sees, so what the system claims to have learned and what it actually
 * acts on cannot drift apart. Every line carries its own sample size.
 */
export function describePreferences(
  profile: PreferenceProfile,
  labelFor: (key: string) => string = (k) => k
): string[] {
  if (profile.overallRate === null) return [];

  const lines: string[] = [
    `Acts on ${profile.acted} of ${profile.answered} suggestions overall (${percent(profile.overallRate)}).`,
  ];

  for (const c of profile.categories) {
    lines.push(
      c.lift > 0
        ? `${labelFor(c.key)} suggestions land more often: ${c.acted} of ${c.n} (${percent(c.rate)}).`
        : `${labelFor(c.key)} suggestions land less often: ${c.acted} of ${c.n} (${percent(c.rate)}).`
    );
  }

  for (const t of profile.timesOfDay) {
    lines.push(
      t.lift > 0
        ? `Best in the ${t.key}: acts on ${t.acted} of ${t.n} (${percent(t.rate)}).`
        : `Least likely in the ${t.key}: acts on ${t.acted} of ${t.n} (${percent(t.rate)}).`
    );
  }

  return lines;
}
