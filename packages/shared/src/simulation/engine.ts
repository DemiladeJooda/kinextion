/**
 * How a habit forms, day by day — simulated.
 *
 * Not a prediction. An illustration built on what the research found:
 * automaticity rises steeply at first and then levels off; the time it takes
 * varies enormously from person to person (Lally et al. 2010: median 66
 * days, range 18–254; Singh et al. 2024: individuals 4–335); simpler habits
 * tend to get there faster; and missing a single day doesn't set the
 * process back in any meaningful way.
 *
 * The model: automaticity runs 1–7 on the same scale as the app's weekly
 * SRBAI check. Each repetition closes a fraction of the gap to that person's
 * plateau (the asymptotic curve Lally fitted); a tiny-version day closes
 * less; a missed day lets a little slip. It never resets to zero, which is
 * the point several paths exist to make.
 *
 * Paths share one life and one habit, so what differs between them is the
 * person, which is the honest version of "there's more than one way there".
 */

import { addDays, type DateKey } from "../habits/dates.js";
import { GRADUATE_AT, SRBAI_MIN } from "../habits/automaticity.js";
import { dayLoad, lifeCalendar, seededRandom, type LifeEvent, type SimLife } from "./life.js";

export const SIM_RESEARCH = {
  medianDays: 66,
  minDays: 18,
  maxDays: 254,
  source: "Lally, van Jaarsveld, Potts & Wardle (2010), European Journal of Social Psychology",
  note: "Times past day 84 were estimated from each person's curve, not watched happen.",
} as const;

export const SIM_LENGTHS = { "90d": 90, "9m": 274 } as const;
export type SimLength = keyof typeof SIM_LENGTHS;

/** Where the guide calls a day "feels automatic" — the app's graduation line. */
export const SIM_AUTOMATIC_AT = GRADUATE_AT;
/** Halfway up the scale: the point it starts to feel easier. */
const EASIER_AT = 3.5;

// ─── Habits ───────────────────────────────────────────────────────────────────

export interface SimHabit {
  id: string;
  name: string;
  /** "After I pour my coffee". */
  anchor: string;
  /** The usual version: "10 push-ups". */
  full: string;
  /** The bad-day version: "5 push-ups on my knees". */
  tiny: string;
  /** How quickly it tends to become automatic, relative to an average habit. */
  ease: number;
}

export const DEMO_HABITS: readonly SimHabit[] = [
  {
    id: "water",
    name: "Morning water",
    anchor: "After I turn off my alarm",
    full: "a full glass of water",
    tiny: "a few sips of water",
    ease: 1.25,
  },
  {
    id: "pushups",
    name: "Push-ups",
    anchor: "After I pour my coffee",
    full: "10 push-ups",
    tiny: "5 push-ups on my knees",
    ease: 1,
  },
  {
    id: "walk",
    name: "Evening walk",
    anchor: "When I get home",
    full: "a 20-minute walk",
    tiny: "a walk to the end of the street",
    ease: 0.85,
  },
];

// ─── Paths ────────────────────────────────────────────────────────────────────

export interface SimArc {
  from: number;
  to: number;
  kind: "gap" | "tiny";
  /** Shown on the day the arc starts, and as a life event inside it. */
  label: string;
}

export interface SimPath {
  id: string;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** Share of the remaining gap each repetition closes. */
  learn: number;
  /** Where this person's curve levels off, on the 1–7 scale. */
  plateau: number;
  /** Chance of doing it on an ordinary day. */
  adherence: number;
  /** Chance of choosing the tiny version on an ordinary day. */
  tinyBias: number;
  /** How much a hard day knocks them, 0 (not at all) to 1. */
  sensitivity: number;
  arcs: readonly SimArc[];
}

export const SIM_PATHS: readonly SimPath[] = [
  {
    id: "quick",
    name: "The quick click",
    blurb: "It fit their morning from the start.",
    learn: 0.07,
    plateau: 6.6,
    adherence: 0.93,
    tinyBias: 0.05,
    sensitivity: 0.4,
    arcs: [],
  },
  {
    id: "steady",
    name: "The steady one",
    blurb: "Most days, nothing dramatic.",
    learn: 0.05,
    plateau: 6.4,
    adherence: 0.88,
    tinyBias: 0.08,
    sensitivity: 0.6,
    arcs: [],
  },
  {
    id: "rough",
    name: "The rough patch",
    blurb: "Lost two weeks in month two, and came back.",
    learn: 0.05,
    plateau: 6.4,
    adherence: 0.87,
    tinyBias: 0.08,
    sensitivity: 0.6,
    arcs: [{ from: 34, to: 47, kind: "gap", label: "Life got loud — two weeks off" }],
  },
  {
    id: "tiny",
    name: "The tiny-version month",
    blurb: "A hard month where only the tiny version happened.",
    learn: 0.045,
    plateau: 6.3,
    adherence: 0.86,
    tinyBias: 0.1,
    sensitivity: 0.7,
    arcs: [{ from: 28, to: 58, kind: "tiny", label: "A stressful month — tiny version only" }],
  },
  {
    id: "restart",
    name: "The restart",
    blurb: "Stopped for three weeks, then started again.",
    learn: 0.035,
    plateau: 6.3,
    adherence: 0.82,
    tinyBias: 0.12,
    sensitivity: 0.7,
    arcs: [{ from: 60, to: 81, kind: "gap", label: "Stopped completely for three weeks" }],
  },
  {
    id: "slow",
    name: "The slow builder",
    blurb: "Slow and uneven — most of a year, and still going.",
    learn: 0.02,
    plateau: 6.6,
    adherence: 0.8,
    tinyBias: 0.15,
    sensitivity: 0.8,
    arcs: [],
  },
];

// ─── Running it ───────────────────────────────────────────────────────────────

/** "rest" is a planned rest day, or a day the habit wasn't due: neutral. */
export type SimOutcome = "full" | "tiny" | "missed" | "rest";

export interface SimDay {
  /** 1-based. */
  day: number;
  date: DateKey;
  /** 1–7, two decimals, after today. */
  automaticity: number;
  outcome: SimOutcome;
  events: LifeEvent[];
  morning: string;
  night: string;
  milestone?: string;
}

export interface SimRun {
  path: SimPath;
  days: SimDay[];
  /** First day it felt automatic, or null if it hadn't yet. */
  automaticDay: number | null;
  totals: { full: number; tiny: number; missed: number; rest: number; longestGap: number };
}

export interface SimulateInput {
  habit: SimHabit;
  life: SimLife;
  path: SimPath;
  start: DateKey;
  days: number;
  /**
   * Carry on from a real history instead of day one: these days are kept
   * as they are, and the simulation runs from the day after the last one.
   * `learn` replaces the path's rate with the person's own.
   */
  resume?: { past: SimDay[]; learn?: number; plateau?: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pick = <T>(rand: () => number, options: readonly T[]): T => options[Math.floor(rand() * options.length)];
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function simulatePath(
  { habit, life, path, start, days, resume }: SimulateInput,
  calendar = lifeCalendar(life, start, days)
): SimRun {
  const rand = seededRandom(`${path.id}:${habit.id}:${life.id}:${start}`);
  const learn = resume?.learn ?? path.learn * habit.ease;
  const plateau = resume?.plateau ?? path.plateau;
  const past = resume?.past ?? [];
  const out: SimDay[] = [...past];
  const totals = { full: 0, tiny: 0, missed: 0, rest: 0, longestGap: 0 };
  let a: number = past.at(-1)?.automaticity ?? SRBAI_MIN;
  let missedRun = 0;
  let longestGap = 0;
  let automaticDay: number | null = null;
  for (const d of past) {
    totals[d.outcome]++;
    if (d.outcome === "missed") longestGap = Math.max(longestGap, ++missedRun);
    else if (d.outcome !== "rest") missedRun = 0;
    if (automaticDay === null && d.automaticity >= SIM_AUTOMATIC_AT) automaticDay = d.day;
  }
  let easier = past.some((d) => d.automaticity >= EASIER_AT);
  let firstTiny = past.some((d) => d.outcome === "tiny");
  let firstMiss = past.some((d) => d.outcome === "missed");

  for (let i = past.length; i < days; i++) {
    const date = addDays(start, i);
    const arc = path.arcs.find((r) => i >= r.from && i <= r.to);
    const events = [...(calendar[i] ?? [])];
    if (arc && i === arc.from) events.unshift({ kind: "season", label: arc.label, load: 0.5 });
    const load = dayLoad(events);

    // Do they do it today?
    let p = path.adherence - load * path.sensitivity * 0.55;
    if (missedRun === 1) p += 0.2; // never miss twice: the app nudges hardest here
    let outcome: SimOutcome;
    if (arc?.kind === "gap") outcome = "missed";
    else if (arc?.kind === "tiny") outcome = rand() < 0.93 ? "tiny" : "missed";
    else if (rand() >= Math.min(0.98, p)) outcome = "missed";
    else outcome = rand() < path.tinyBias + (load > 0.35 ? 0.45 : 0) ? "tiny" : "full";

    // What it does to the curve.
    const before = a;
    a = round2(stepAutomaticity(a, outcome, learn, plateau));

    const comebackAfter = outcome !== "missed" && missedRun >= 3 ? missedRun : 0;
    if (outcome === "missed") {
      missedRun++;
      longestGap = Math.max(longestGap, missedRun);
    } else {
      missedRun = 0;
    }
    totals[outcome]++;

    // Milestones, at most one a day, most meaningful first.
    let milestone: string | undefined;
    if (automaticDay === null && a >= SIM_AUTOMATIC_AT) {
      automaticDay = i + 1;
      milestone = "Feels automatic";
    } else if (comebackAfter) {
      milestone = `Back after ${comebackAfter} days — picking up from where it dipped, not from zero`;
    } else if (!easier && a >= EASIER_AT) {
      easier = true;
      milestone = "Getting easier";
    } else if (!firstMiss && outcome === "missed") {
      firstMiss = true;
      milestone = "First miss. The rule from here: never miss twice";
    } else if (!firstTiny && outcome === "tiny") {
      firstTiny = true;
      milestone = "First tiny-version day — it still counts";
    } else if (i === 0) {
      milestone = "Day one";
    } else if (i === past.length && past.length) {
      milestone = "Today";
    }

    out.push({
      day: i + 1,
      date,
      automaticity: a,
      outcome,
      events,
      morning: morningLine(habit, before, events, arc, i, rand),
      night: nightLine(habit, outcome, a, missedRun, comebackAfter, arc, rand),
      milestone,
    });
  }

  totals.longestGap = longestGap;
  return { path, days: out, automaticDay, totals };
}

/**
 * One day's effect on automaticity. A repetition closes a share of the gap
 * to the plateau (the tiny version, a bit less); a miss lets a little slip;
 * a rest day changes nothing.
 */
export function stepAutomaticity(a: number, outcome: SimOutcome, learn: number, plateau: number): number {
  if (outcome === "full") return a + learn * (plateau - a);
  if (outcome === "tiny") return a + learn * 0.7 * (plateau - a);
  if (outcome === "missed") return a - 0.012 * (a - SRBAI_MIN);
  return a;
}

/** Every path through the same life and habit. */
export function simulateAll(input: Omit<SimulateInput, "path">, paths: readonly SimPath[] = SIM_PATHS): SimRun[] {
  const calendar = lifeCalendar(input.life, input.start, input.days);
  return paths.map((path) => simulatePath({ ...input, path }, calendar));
}

// ─── The diary ────────────────────────────────────────────────────────────────

function morningLine(
  habit: SimHabit,
  a: number,
  events: readonly LifeEvent[],
  arc: SimArc | undefined,
  i: number,
  rand: () => number
): string {
  if (arc?.kind === "gap") {
    return i === arc.from
      ? `${arc.label}.`
      : pick(rand, ["Thought about it. Didn't start.", "It's been a while.", "Not today either."]);
  }
  const hard = events.find((e) => e.load >= 0.3) ?? events[0];
  const plan =
    a < 2.5
      ? pick(rand, [`Reminder set: ${lower(habit.anchor)}, ${habit.full}.`, `Note on the fridge: ${habit.full}.`])
      : a < SIM_AUTOMATIC_AT
        ? pick(rand, [`Plan: ${lower(habit.anchor)}, ${habit.full}.`, `${habit.anchor} — that's the cue.`])
        : pick(rand, ["No reminder needed anymore.", "Not even on the list. It just happens."]);
  if (!hard) return plan;
  return hard.load >= 0.4 ? `${hard.label}. Tiny version if that's all there is.` : `${hard.label}. ${plan}`;
}

function nightLine(
  habit: SimHabit,
  outcome: SimOutcome,
  a: number,
  missedRun: number,
  comebackAfter: number,
  arc: SimArc | undefined,
  rand: () => number
): string {
  if (comebackAfter) {
    const what = outcome === "tiny" ? habit.tiny : habit.full;
    return pick(rand, [`Back at it: ${what}. Felt good to start again.`, `Did ${what} to restart. Easier than I expected.`]);
  }
  if (outcome === "rest") return "Rest day. Nothing owed.";
  if (outcome === "tiny") {
    return arc?.kind === "tiny"
      ? pick(rand, [`Only ${habit.tiny} again. Still showing up.`, `${capital(habit.tiny)}. That's what today had room for.`])
      : pick(rand, [`Only had it in me for ${habit.tiny}. Still counts.`, `Tiny version: ${habit.tiny}. Kept it alive.`]);
  }
  if (outcome === "missed") {
    if (arc?.kind === "gap") {
      return missedRun <= 1 ? "Didn't happen. Not today." : pick(rand, ["Still off.", "Not this week.", "Haven't been back yet."]);
    }
    return missedRun === 1
      ? pick(rand, ["Missed it today. Tomorrow, tiny version at least.", "Skipped it. Not twice in a row, though."])
      : "Missed again. Tomorrow I'll do the tiny version first thing.";
  }
  const did = `Did ${habit.full}.`;
  if (a < 2.5) return `${did} ${pick(rand, ["Had to talk myself into it.", "Felt like a chore.", "Almost forgot."])}`;
  if (a < 4) return `${did} ${pick(rand, ["A bit easier than last week.", "Didn't need the reminder.", "Less of a fight today."])}`;
  if (a < SIM_AUTOMATIC_AT) return `${did} ${pick(rand, ["Mostly on autopilot.", "Barely thought about it.", "Just part of the routine now."])}`;
  return `${did} ${pick(rand, ["Did it before I'd even thought about it.", "Would feel weird not to.", "Done without noticing."])}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
