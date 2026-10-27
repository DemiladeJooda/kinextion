/**
 * Sample health data for testing before anything is connected.
 *
 * In development (where the dev-only test accounts live) a user with no
 * connected source sees the demo's realistic numbers on "Your numbers" and
 * "Your data", clearly labelled as samples, so the screens can be tried
 * without a ring or watch. The moment any real source is connected, only
 * real data shows. Release builds never use it.
 */

import type { RemoteIntegration } from "../services";
import { demoApi } from "./demo/api";
import { DEMO_MODE } from "./demo/session";

/** Whether to stand sample data in for a user with these integrations. */
export function showsSampleHealth(integrations: RemoteIntegration[]): boolean {
  if (!__DEV__ || DEMO_MODE) return false;
  return !integrations.some((i) => i.status === "connected");
}

export const sampleHealth = {
  metrics: (filter?: { type?: string; from?: string; to?: string }) => demoApi.listMetrics(filter),
  workouts: (limit?: number) => demoApi.listWorkouts(limit),
  moods: (limit?: number) => demoApi.listMoodEntries(limit),
  patterns: () => demoApi.listPatterns(),
};
