/**
 * "Your numbers": the last seven days of body data next to the seven before,
 * and what's worth saying about the difference.
 *
 * Everything here describes; nothing diagnoses. A change is only put into
 * words when both weeks have enough readings to mean something
 * (MIN_WEEK_READINGS), and the thresholds are set so ordinary day-to-day
 * wobble stays quiet. Metrics whose direction depends on the person (resting
 * heart rate, weight, blood pressure) are never called better or worse.
 */

import { addDays, dayOfWeek } from "../habits/dates.js";

export interface DailyReading {
  metricType: string;
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface WeekStat {
  metricType: string;
  /** The seven days ending today, oldest first; null where nothing came in. */
  days: (number | null)[];
  /** This week's figure: the average of the days with a reading. */
  value: number | null;
  /** The same figure for the week before. */
  previous: number | null;
  /** Days with a reading this week. */
  readings: number;
  previousReadings: number;
}

/** Fewer readings than this in either week and the change goes unsaid. */
export const MIN_WEEK_READINGS = 3;

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Per-metric weekly figures. Two sources reporting the same metric on the
 * same day (a ring and the phone both counting steps) are averaged, so a
 * second device never doubles a day.
 */
export function summarizeWeeks(readings: DailyReading[], today: string): Record<string, WeekStat> {
  const byMetric = new Map<string, Map<string, number[]>>();
  for (const r of readings) {
    const days = byMetric.get(r.metricType) ?? new Map<string, number[]>();
    days.set(r.date.slice(0, 10), [...(days.get(r.date.slice(0, 10)) ?? []), r.value]);
    byMetric.set(r.metricType, days);
  }

  const out: Record<string, WeekStat> = {};
  for (const [metricType, dayValues] of byMetric) {
    const at = (offset: number) => {
      const values = dayValues.get(addDays(today, offset));
      return values ? mean(values) : null;
    };
    const days = Array.from({ length: 7 }, (_, i) => at(i - 6));
    const before = Array.from({ length: 7 }, (_, i) => at(i - 13));
    const present = days.filter((v): v is number => v !== null);
    const past = before.filter((v): v is number => v !== null);
    if (present.length === 0 && past.length === 0) continue;
    out[metricType] = {
      metricType,
      days,
      value: mean(present),
      previous: mean(past),
      readings: present.length,
      previousReadings: past.length,
    };
  }
  return out;
}

export interface WorkoutWeek {
  /** Sessions logged in the last seven days, and the seven before. */
  count: number;
  previousCount: number;
}

export interface WeekInsight {
  /** The metric it's about, for an icon and colour. */
  metricType: string;
  text: string;
  /** Bigger matters more; used to order and trim. */
  weight: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minutes as "7h 10m" / "45 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)}h ${rest}m` : `${Math.floor(m / 60)}h`;
}

const thousands = (n: number) => Math.round(n).toLocaleString("en-US");
const both = (s: WeekStat | undefined): s is WeekStat & { value: number; previous: number } =>
  !!s &&
  s.value !== null &&
  s.previous !== null &&
  s.readings >= MIN_WEEK_READINGS &&
  s.previousReadings >= MIN_WEEK_READINGS;

/**
 * What changed this week, in plain words, most notable first. Steady weeks
 * say little on purpose: "nothing much moved" is only said about resting
 * heart rate, where steady is itself the useful news.
 */
export function weekInsights(
  stats: Record<string, WeekStat>,
  workouts: WorkoutWeek | null,
  today: string
): WeekInsight[] {
  const out: WeekInsight[] = [];

  const sleep = stats.sleep_duration;
  if (both(sleep)) {
    const diff = sleep.value - sleep.previous;
    if (Math.abs(diff) >= 20) {
      out.push({
        metricType: "sleep_duration",
        text: `You slept about ${formatMinutes(Math.abs(diff))} ${diff > 0 ? "more" : "less"} a night than last week, ${formatMinutes(sleep.value)} on average.`,
        weight: Math.abs(diff) / 20,
      });
    }
  }

  const steps = stats.steps;
  if (both(steps) && steps.previous > 0) {
    const pct = ((steps.value - steps.previous) / steps.previous) * 100;
    if (Math.abs(pct) >= 15) {
      out.push({
        metricType: "steps",
        text: `Steps were ${pct > 0 ? "up" : "down"} ${Math.round(Math.abs(pct))}% on last week, about ${thousands(steps.value)} a day.`,
        weight: Math.abs(pct) / 15,
      });
    }
  }
  if (steps && steps.readings >= 5) {
    const best = steps.days.reduce<number>((b, v, i) => (v !== null && v > (steps.days[b] ?? -1) ? i : b), 0);
    const value = steps.days[best];
    if (value !== null) {
      out.push({
        metricType: "steps",
        text: `Your most active day was ${WEEKDAYS[dayOfWeek(addDays(today, best - 6))]}, with ${thousands(value)} steps.`,
        weight: 0.6,
      });
    }
  }

  const rhr = stats.resting_heart_rate;
  if (both(rhr)) {
    const diff = rhr.value - rhr.previous;
    out.push(
      Math.abs(diff) >= 3
        ? {
            metricType: "resting_heart_rate",
            text: `Your resting heart rate averaged ${Math.round(rhr.value)} bpm, ${Math.round(Math.abs(diff))} ${diff > 0 ? "higher" : "lower"} than last week.${diff > 0 ? " It can rise with short sleep, stress or a cold coming on." : ""}`,
            weight: Math.abs(diff) / 3,
          }
        : {
            metricType: "resting_heart_rate",
            text: `Your resting heart rate held steady around ${Math.round(rhr.value)} bpm.`,
            weight: 0.4,
          }
    );
  }

  const hrv = stats.hrv;
  if (both(hrv) && hrv.previous > 0) {
    const pct = ((hrv.value - hrv.previous) / hrv.previous) * 100;
    if (Math.abs(pct) >= 10) {
      out.push({
        metricType: "hrv",
        text: `HRV averaged ${Math.round(hrv.value)} ms, ${Math.round(Math.abs(pct))}% ${pct > 0 ? "above" : "below"} last week.${pct < 0 ? " A lower run often means your body is still recovering." : ""}`,
        weight: Math.abs(pct) / 10,
      });
    }
  }

  const sys = stats.blood_pressure_systolic;
  const dia = stats.blood_pressure_diastolic;
  if (sys?.value != null && dia?.value != null && sys.readings >= MIN_WEEK_READINGS) {
    const high = sys.value >= 140 || dia.value >= 90;
    out.push({
      metricType: "blood_pressure_systolic",
      text: `Blood pressure averaged ${Math.round(sys.value)}/${Math.round(dia.value)} over ${sys.readings} readings.${high ? " If it keeps sitting at 140/90 or above, it's worth checking with a doctor." : ""}`,
      weight: high ? 3 : 0.5,
    });
  }

  const weight = stats.weight;
  if (both(weight)) {
    const diff = weight.value - weight.previous;
    if (Math.abs(diff) >= 0.5) {
      out.push({
        metricType: "weight",
        text: `Weight averaged ${weight.value.toFixed(1)} kg, ${Math.abs(diff).toFixed(1)} kg ${diff > 0 ? "more" : "less"} than last week.`,
        weight: 0.5,
      });
    }
  }

  const mood = stats.mood;
  if (both(mood)) {
    const diff = mood.value - mood.previous;
    if (Math.abs(diff) >= 0.7) {
      out.push({
        metricType: "mood",
        text: `Your mood averaged ${mood.value.toFixed(1)} out of 10, ${diff > 0 ? "up" : "down"} from ${mood.previous.toFixed(1)} last week.`,
        weight: Math.abs(diff),
      });
    }
  }

  if (workouts && (workouts.count > 0 || workouts.previousCount > 0)) {
    const diff = workouts.count - workouts.previousCount;
    const sessions = (n: number) => `${n} workout${n === 1 ? "" : "s"}`;
    out.push({
      metricType: "workout",
      text:
        diff === 0
          ? `${sessions(workouts.count)} this week, matching last week.`
          : `${sessions(workouts.count)} this week, ${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than last week.`,
      weight: Math.abs(diff) * 0.8 + 0.3,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
