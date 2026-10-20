/**
 * Reading a user's recommendation history back as preferences.
 *
 * The maths lives in @kinextion/shared (utils/preferences.ts) where it's pure
 * and unit-tested; this file does the two things that need a database and a
 * user: fetching the history, and working out what time of day each
 * recommendation was actually shown.
 */

import { prisma } from "@kinextion/database";
import {
  buildPreferenceProfile,
  describePreferences,
  WELLNESS_LABELS,
  type PreferenceProfile,
  type RecommendationOutcome,
} from "@kinextion/shared";

/** How far back the profile looks. Older taps say little about today. */
const HISTORY_LIMIT = 60;

/** Past recommendations quoted back to the model, per outcome. */
const EXAMPLE_LIMIT = 6;

/**
 * The user's local hour when a recommendation was shown.
 *
 * `createdAt` is stored in UTC and the schema has nowhere to put a local hour,
 * so it's reconstructed from the time zone the client sends with the request.
 * That's correct for anyone who hasn't changed time zone since — and for
 * anyone who has, the sample thresholds in the shared module absorb the few
 * mislabelled rows rather than reporting a pattern off them.
 */
function localHour(date: Date, timeZone: string | null): number {
  if (!timeZone) return date.getUTCHours();
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(date);
    const hour = Number(formatted);
    // Some ICU builds render midnight as 24.
    return Number.isFinite(hour) ? hour % 24 : date.getUTCHours();
  } catch {
    // An invalid zone from a client is not worth failing a request over.
    return date.getUTCHours();
  }
}

export interface RecommendationHistory {
  profile: PreferenceProfile;
  /** Plain sentences — the same text shown to the user and given to the model. */
  lines: string[];
  /** Recent recommendations the user acted on, most recent first. */
  landed: string[];
  /** Recent ones they dismissed. */
  ignored: string[];
}

export async function loadRecommendationHistory(
  userId: string,
  timeZone: string | null
): Promise<RecommendationHistory> {
  const rows = await prisma.recommendation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      content: true,
      category: true,
      acted: true,
      dismissed: true,
      createdAt: true,
    },
  });

  const outcomes: RecommendationOutcome[] = rows.map((r) => ({
    category: r.category,
    hour: localHour(r.createdAt, timeZone),
    acted: r.acted,
    dismissed: r.dismissed,
  }));

  const profile = buildPreferenceProfile(outcomes);

  return {
    profile,
    lines: describePreferences(profile, (key) => WELLNESS_LABELS[key] ?? key),
    landed: rows.filter((r) => r.acted).slice(0, EXAMPLE_LIMIT).map((r) => r.content),
    ignored: rows.filter((r) => r.dismissed).slice(0, EXAMPLE_LIMIT).map((r) => r.content),
  };
}
