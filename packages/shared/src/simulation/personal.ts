/**
 * Your own habit, simulated from where you actually are.
 *
 * The demo shows six made-up people. This uses one real person: their
 * habit's days so far (done, tiny, missed, rest) become the solid part of
 * the curve, and a few possible futures fan out from today — keep the pace
 * you've had, show up most days, ride out a tiny-version month, lose two
 * weeks and come back. Each says roughly when it would start to feel
 * automatic.
 *
 * Their weekly automaticity check (SRBAI) is the anchor. When they've
 * answered it, the learning rate is fitted to their own answers, so the
 * curve passes near the dots they gave. Without answers it uses the study's
 * middle, and says so. Either way it's an illustration, not a forecast.
 */

import { addDays, daysBetween, type DateKey } from "../habits/dates.js";
import type { AutomaticityPoint } from "../habits/automaticity.js";
import { SRBAI_MIN } from "../habits/automaticity.js";
import {
  SIM_AUTOMATIC_AT,
  simulatePath,
  stepAutomaticity,
  type SimDay,
  type SimHabit,
  type SimOutcome,
  type SimPath,
  type SimRun,
} from "./engine.js";
import { lifeCalendar, type SimLife } from "./life.js";

export interface RealDay {
  date: DateKey;
  outcome: SimOutcome;
}

export interface PersonalInput {
  habit: SimHabit;
  life: SimLife;
  /** The habit's first day. */
  start: DateKey;
  /** Every day from `start` up to the last day to count as history. */
  history: readonly RealDay[];
  /** Their weekly automaticity answers, oldest first. */
  checks: readonly AutomaticityPoint[];
  /** How far ahead to look from today. */
  ahead: number;
}

export interface PersonalSim {
  /** Days so far, rebuilt from what really happened. */
  past: SimDay[];
  /** Possible futures, each continuing from the last real day. */
  futures: SimRun[];
  /** Fitted to their own check-ins, or the study's middle. */
  learn: number;
  fitted: boolean;
  /** Share of due days kept over the last four weeks, 0–1. */
  pace: number;
}

/** Their curve levels off about here unless their answers say higher. */
const DEFAULT_PLATEAU = 6.4;
/** The study's middle: a steady person's rate for an average habit. */
export const DEFAULT_LEARN = 0.05;

function curve(history: readonly RealDay[], learn: number, plateau: number): number[] {
  let a: number = SRBAI_MIN;
  return history.map((d) => (a = stepAutomaticity(a, d.outcome, learn, plateau)));
}

/**
 * The learning rate whose curve comes closest to the answers they gave.
 * A plain grid search: the space is one number, and it has to be robust
 * with two or three noisy points.
 */
export function fitLearnRate(
  history: readonly RealDay[],
  checks: readonly AutomaticityPoint[],
  start: DateKey,
  plateau = DEFAULT_PLATEAU
): number | null {
  const usable = checks
    .map((c) => ({ i: daysBetween(start, c.date), score: c.score }))
    .filter((c) => c.i >= 0 && c.i < history.length);
  if (!usable.length) return null;
  let best = DEFAULT_LEARN;
  let bestErr = Infinity;
  for (let k = 0.005; k <= 0.2; k += 0.0025) {
    const a = curve(history, k, plateau);
    const err = usable.reduce((sum, c) => sum + (a[c.i] - c.score) ** 2, 0);
    if (err < bestErr) {
      bestErr = err;
      best = k;
    }
  }
  return Math.round(best * 10000) / 10000;
}

/** Kept ÷ due over the last 28 days of history; rest days don't count either way. */
export function recentPace(history: readonly RealDay[]): { pace: number; tinyShare: number } {
  const recent = history.slice(-28).filter((d) => d.outcome !== "rest");
  if (recent.length < 7) return { pace: 0.85, tinyShare: 0.1 };
  const kept = recent.filter((d) => d.outcome === "full" || d.outcome === "tiny");
  const tiny = kept.filter((d) => d.outcome === "tiny").length;
  return {
    pace: kept.length / recent.length,
    tinyShare: kept.length ? tiny / kept.length : 0.1,
  };
}

const NIGHT: Record<SimOutcome, (h: SimHabit) => string> = {
  full: (h) => `You did ${h.full}.`,
  tiny: (h) => `You did the tiny version: ${h.tiny}. It counted.`,
  missed: () => "Missed. It happens, and it didn't reset anything.",
  rest: () => "Rest day. Nothing owed.",
};

/** The futures offered from today. Arcs are counted from today. */
function futuresFrom(today: number, pace: number, tinyShare: number): SimPath[] {
  const base = { plateau: DEFAULT_PLATEAU, learn: DEFAULT_LEARN, sensitivity: 0.6 };
  return [
    {
      ...base,
      id: "pace",
      name: "At your current pace",
      blurb: `Keeping about ${Math.round(pace * 100)}% of days, like the last four weeks.`,
      adherence: Math.min(0.97, Math.max(0.3, pace)),
      tinyBias: tinyShare,
      arcs: [],
    },
    {
      ...base,
      id: "most",
      name: "Most days from here",
      blurb: "Showing up nine days in ten, tiny version on the hard ones.",
      adherence: 0.92,
      tinyBias: 0.1,
      arcs: [],
    },
    {
      ...base,
      id: "tiny",
      name: "A tiny-version month",
      blurb: "Only the tiny version for the next month, then back to normal.",
      adherence: Math.max(0.8, pace),
      tinyBias: tinyShare,
      arcs: [{ from: today, to: today + 29, kind: "tiny", label: "A tiny-version month" }],
    },
    {
      ...base,
      id: "rough",
      name: "A rough patch, then back",
      blurb: "Two weeks off in a few weeks' time, then picking it back up.",
      adherence: Math.max(0.8, pace),
      tinyBias: tinyShare,
      arcs: [{ from: today + 14, to: today + 27, kind: "gap", label: "Two weeks off" }],
    },
  ];
}

export function simulatePersonal({ habit, life, start, history, checks, ahead }: PersonalInput): PersonalSim {
  const top = Math.max(0, ...checks.map((c) => c.score));
  const plateau = Math.min(7, Math.max(DEFAULT_PLATEAU, top + 0.2));
  const fitted = fitLearnRate(history, checks, start, plateau);
  const learn = fitted ?? DEFAULT_LEARN * habit.ease;
  const days = history.length + ahead;
  const calendar = lifeCalendar(life, start, days);

  const a = curve(history, learn, plateau);
  let automatic = false;
  const past: SimDay[] = history.map((d, i) => {
    const reached = !automatic && a[i] >= SIM_AUTOMATIC_AT;
    if (reached) automatic = true;
    return {
      day: i + 1,
      date: d.date,
      automaticity: Math.round(a[i] * 100) / 100,
      outcome: d.outcome,
      events: calendar[i] ?? [],
      morning: d.outcome === "rest" ? "Not due today." : `${habit.anchor}: ${habit.full}.`,
      night: NIGHT[d.outcome](habit),
      milestone: i === 0 ? "Day one" : reached ? "Feels automatic" : undefined,
    };
  });

  const { pace, tinyShare } = recentPace(history);
  const futures = futuresFrom(history.length, pace, tinyShare).map((path) =>
    simulatePath(
      { habit, life, path, start, days, resume: { past, learn, plateau } },
      calendar
    )
  );
  return { past, futures, learn, fitted: fitted !== null, pace };
}

/** Days from today until a run first feels automatic, or null. */
export function daysUntilAutomatic(run: SimRun, today: number): number | null {
  if (run.automaticDay === null) return null;
  return Math.max(0, run.automaticDay - today);
}

/** History from a habit's logs: every day from its start up to `until`. */
export function historyFromLogs(
  start: DateKey,
  until: DateKey,
  day: (date: DateKey) => SimOutcome
): RealDay[] {
  const out: RealDay[] = [];
  for (let d = start; d <= until; d = addDays(d, 1)) out.push({ date: d, outcome: day(d) });
  return out;
}
