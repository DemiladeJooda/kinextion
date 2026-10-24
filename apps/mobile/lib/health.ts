/**
 * Apple Health (iOS) and Health Connect (Android): daily totals read on the
 * phone and sent to the API, which stores them and logs linked habits.
 *
 * Reading needs a native module per platform, added at build time (see
 * docs/integrations-checklist.md). That module registers a HealthSource
 * here with `registerHealthSource`. Until a build has one, `healthSource()`
 * is null and the app says "coming in the next update" instead of offering
 * a button that can't work.
 */

import { Platform } from "react-native";
import { addDays, today, type DateKey, type DeviceHealthProvider } from "@kinextion/shared";

export interface HealthDay {
  date: DateKey;
  steps?: number;
  workoutMinutes?: number;
  sleepMinutes?: number;
}

export interface HealthSource {
  provider: DeviceHealthProvider;
  /** Ask for read access to steps, workouts and sleep. True if granted. */
  requestAccess(): Promise<boolean>;
  /** Daily totals for each day from `from` to `to`, inclusive. */
  readDays(from: DateKey, to: DateKey): Promise<HealthDay[]>;
}

let source: HealthSource | null = null;

/** Called by the platform's native adapter when the build includes one. */
export function registerHealthSource(s: HealthSource) {
  source = s;
}

export function healthSource(): HealthSource | null {
  return source;
}

/** Which phone health store this platform would use. */
export const PHONE_HEALTH: { provider: DeviceHealthProvider; label: string } | null =
  Platform.OS === "ios"
    ? { provider: "apple_health", label: "Apple Health" }
    : Platform.OS === "android"
      ? { provider: "health_connect", label: "Health Connect" }
      : null;

/** The last three days, so yesterday's late walk still counts. */
export async function readRecentDays(): Promise<HealthDay[]> {
  if (!source) return [];
  const to = today();
  return source.readDays(addDays(to, -2), to);
}
