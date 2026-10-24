/**
 * Habits with an amount, and habits that log themselves.
 *
 * Measured: "8 glasses of water", "20 pages", "30 minutes". The usual amount
 * is the target; the tiny version is a smaller amount that still counts on a
 * bad day ("2 glasses"). Logging an amount decides the day's state, so a
 * number never needs a second tap to say whether it counted.
 *
 * Auto-logged: a connected service ticks the habit when it sees the thing
 * happen — a Strava run, a Whoop workout, Oura steps. Self-monitoring only
 * helps when people see what was recorded (Harkin et al. 2016), so every
 * automatic log is shown as one and can be undone.
 */

import { z } from "zod";

/** Units offered when setting up an amount. Free text is allowed too. */
export const MEASURE_UNITS = ["glasses", "minutes", "pages", "km", "miles", "steps", "reps", "times"] as const;

/** Health data read on the phone itself, no partner API: Apple Health and Health Connect. */
export const DEVICE_HEALTH_PROVIDERS = ["apple_health", "health_connect"] as const;
export type DeviceHealthProvider = (typeof DEVICE_HEALTH_PROVIDERS)[number];

export const AUTO_LOG_PROVIDERS = ["strava", "whoop", "oura", ...DEVICE_HEALTH_PROVIDERS] as const;
export const AUTO_LOG_METRICS = ["workout", "steps"] as const;

/** What each connected service can log, in words the setup screen shows. */
export const AUTO_LOG_OPTIONS: ReadonlyArray<{
  provider: (typeof AUTO_LOG_PROVIDERS)[number];
  metric: (typeof AUTO_LOG_METRICS)[number];
  label: string;
  /** What a value is counted in. */
  unit: string;
  /** The smallest amount that counts, unless the habit sets its own. */
  defaultMin: number;
}> = [
  { provider: "strava", metric: "workout", label: "Any Strava activity", unit: "min", defaultMin: 10 },
  { provider: "whoop", metric: "workout", label: "A Whoop workout", unit: "min", defaultMin: 10 },
  { provider: "oura", metric: "steps", label: "Steps from Oura", unit: "steps", defaultMin: 5000 },
  { provider: "apple_health", metric: "steps", label: "Steps from Apple Health", unit: "steps", defaultMin: 5000 },
  { provider: "apple_health", metric: "workout", label: "A workout in Apple Health", unit: "min", defaultMin: 10 },
  { provider: "health_connect", metric: "steps", label: "Steps from Health Connect", unit: "steps", defaultMin: 5000 },
  { provider: "health_connect", metric: "workout", label: "A workout in Health Connect", unit: "min", defaultMin: 10 },
];

export const PROVIDER_LABEL: Record<string, string> = {
  strava: "Strava",
  whoop: "Whoop",
  oura: "Oura",
  apple_health: "Apple Health",
  health_connect: "Health Connect",
};

export const autoLogSchema = z.object({
  provider: z.enum(AUTO_LOG_PROVIDERS),
  metric: z.enum(AUTO_LOG_METRICS),
  /** Smallest amount that counts; defaults per option. */
  min: z.number().min(0).max(100_000).optional(),
});
export type AutoLog = z.infer<typeof autoLogSchema>;

export interface Measured {
  measureTarget?: number | null;
  measureTiny?: number | null;
}

/**
 * What an amount counts as: the usual version at the target, the tiny
 * version at the tiny amount (any amount at all if no tiny amount is set),
 * otherwise not yet.
 */
export function stateForAmount(habit: Measured, value: number): "done" | "minimum" | null {
  const target = habit.measureTarget ?? null;
  if (target === null || !(value > 0)) return null;
  if (value >= target) return "done";
  const tiny = habit.measureTiny ?? null;
  if (tiny === null || value >= Math.min(tiny, target)) return "minimum";
  return null;
}

/**
 * Whether a reading from a connected service logs the habit, and how.
 * Measured habits use their own amounts; others count once the reading
 * reaches the habit's minimum.
 */
export function autoLogDecision(
  habit: Measured & { autoLog?: AutoLog | null },
  reading: { provider: string; metric: string; value: number }
): { state: "done" | "minimum"; value: number } | null {
  const rule = habit.autoLog;
  if (!rule || rule.provider !== reading.provider || rule.metric !== reading.metric) return null;
  if (habit.measureTarget) {
    const state = stateForAmount(habit, reading.value);
    return state ? { state, value: reading.value } : null;
  }
  const option = AUTO_LOG_OPTIONS.find((o) => o.provider === rule.provider && o.metric === rule.metric);
  const min = rule.min ?? option?.defaultMin ?? 1;
  return reading.value >= min ? { state: "done", value: reading.value } : null;
}

/** "6 of 8 glasses" for a row; "8 glasses" when there's no amount yet. */
export function describeAmount(habit: Measured & { measureUnit?: string | null }, value?: number | null): string | null {
  if (!habit.measureTarget) return null;
  const unit = habit.measureUnit ?? "";
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return value != null && value > 0
    ? `${fmt(value)} of ${fmt(habit.measureTarget)} ${unit}`.trim()
    : `${fmt(habit.measureTarget)} ${unit}`.trim();
}
