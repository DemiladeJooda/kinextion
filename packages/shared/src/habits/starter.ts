/**
 * The starter menu: a short list of ready-made habits for each onboarding
 * goal, so a new user chooses instead of inventing.
 *
 * Possibilities, in Zoe Chance's 4Ps: what's offered shapes what gets done,
 * and too many options is friction too, so each goal gets 3–5. Every entry
 * is already built the way the research says habits hold: an anchor to an
 * existing moment ("After I…"; implementation intentions), a tiny version
 * small enough for the worst day, and a same-day reason in plain words.
 *
 * DRAFT CONTENT. This is a first pass to review with Zoe Chance before
 * launch (open decision in the habits plan). It contains no claims about
 * outcomes, only suggestions.
 */

import type { CreateHabitInput, HabitDraft } from "../schemas/index.js";

export interface StarterHabit {
  /** Stable id, so analytics can tell which starters people pick. */
  id: string;
  name: string;
  category: CreateHabitInput["category"];
  /** The anchor. Stored in `cue`. */
  anchor: string;
  /** The tiny version. Stored in `response`. */
  tiny: string;
  fullVersion?: string;
  /** Why it's worth it today, in plain words. Stored in `craving`. */
  why: string;
  timeWindow: NonNullable<CreateHabitInput["timeWindow"]>;
  frequency: CreateHabitInput["frequency"];
  perWeekTarget?: number;
  /** Needs this equipment to make sense; hidden if the user doesn't have it. */
  needs?: string;
}

const MOVE: StarterHabit = {
  id: "walk-after-lunch",
  name: "Walk after lunch",
  category: "physical",
  anchor: "After I finish lunch",
  tiny: "Walk to the end of the street and back",
  fullVersion: "A 15-minute walk",
  why: "You'll beat the afternoon slump",
  timeWindow: "midday",
  frequency: "daily",
};

const PUSHUPS: StarterHabit = {
  id: "coffee-pushups",
  name: "Push-ups",
  category: "physical",
  anchor: "After I pour my morning coffee",
  tiny: "2 push-ups",
  fullVersion: "3 sets of 10",
  why: "You'll start the day already ahead",
  timeWindow: "morning",
  frequency: "daily",
};

const TRAIN: StarterHabit = {
  id: "gym-sessions",
  name: "Strength session",
  category: "physical",
  anchor: "After work, before I sit down at home",
  tiny: "Put on my training gear and do one warm-up set",
  fullVersion: "A full 45-minute session",
  why: "You'll feel stronger walking out than walking in",
  timeWindow: "evening",
  frequency: "weekly",
  perWeekTarget: 4,
};

const WATER: StarterHabit = {
  id: "morning-water",
  name: "Glass of water first",
  category: "physical",
  anchor: "After I get out of bed",
  tiny: "A few sips of water",
  fullVersion: "A full glass",
  why: "You'll feel awake faster",
  timeWindow: "morning",
  frequency: "daily",
};

const SCREENS_OFF: StarterHabit = {
  id: "phone-down",
  name: "Phone down before bed",
  category: "mental",
  anchor: "After I brush my teeth at night",
  tiny: "Put my phone on the charger across the room",
  why: "You'll fall asleep sooner tonight",
  timeWindow: "evening",
  frequency: "daily",
};

const WIND_DOWN: StarterHabit = {
  id: "lights-down",
  name: "Wind down",
  category: "physical",
  anchor: "When my 10pm alarm goes off",
  tiny: "Dim the lights and stop scrolling",
  fullVersion: "20 minutes of reading in bed",
  why: "You'll wake up less groggy tomorrow",
  timeWindow: "evening",
  frequency: "daily",
};

const BREATHE: StarterHabit = {
  id: "three-breaths",
  name: "Three slow breaths",
  category: "emotional",
  anchor: "After I sit down at my desk",
  tiny: "Three slow breaths, longer out than in",
  fullVersion: "5 minutes of guided breathing",
  why: "You'll start work calmer",
  timeWindow: "morning",
  frequency: "daily",
};

const ONE_LINE: StarterHabit = {
  id: "one-line-journal",
  name: "One line in my journal",
  category: "emotional",
  anchor: "After I get into bed",
  tiny: "Write one line about today",
  fullVersion: "A full page",
  why: "You'll put the day down before you sleep",
  timeWindow: "evening",
  frequency: "daily",
};

const FOCUS: StarterHabit = {
  id: "first-focus-block",
  name: "First focus block",
  category: "mental",
  anchor: "After I open my laptop",
  tiny: "Work on one task for 5 minutes before checking messages",
  fullVersion: "A 45-minute focus block",
  why: "You'll get the hard thing moving before the day takes over",
  timeWindow: "morning",
  frequency: "custom",
};

const READ: StarterHabit = {
  id: "read-a-page",
  name: "Read a page",
  category: "mental",
  anchor: "After I get into bed",
  tiny: "Read one page",
  fullVersion: "20 minutes of reading",
  why: "You'll end the day on something you chose",
  timeWindow: "evening",
  frequency: "daily",
};

const GRATITUDE: StarterHabit = {
  id: "one-good-thing",
  name: "One good thing",
  category: "spiritual",
  anchor: "After dinner",
  tiny: "Name one good thing from today",
  why: "You'll notice the day wasn't all noise",
  timeWindow: "evening",
  frequency: "daily",
};

const STRETCH: StarterHabit = {
  id: "morning-stretch",
  name: "Morning stretch",
  category: "physical",
  anchor: "After I get out of bed",
  tiny: "One minute of stretching",
  fullVersion: "10 minutes of mobility",
  why: "You'll move easier all morning",
  timeWindow: "morning",
  frequency: "daily",
};

const PROTEIN: StarterHabit = {
  id: "protein-breakfast",
  name: "Protein at breakfast",
  category: "physical",
  anchor: "When I make breakfast",
  tiny: "Add one protein to my plate",
  why: "You'll stay full until lunch",
  timeWindow: "morning",
  frequency: "daily",
};

const BRAVE: StarterHabit = {
  id: "one-brave-thing",
  name: "One brave thing",
  category: "emotional",
  anchor: "After my first coffee",
  tiny: "Pick one small thing I've been avoiding",
  fullVersion: "Do it before lunch",
  why: "You'll end the day having done the thing",
  timeWindow: "morning",
  frequency: "custom",
};

/** Keyed by GOAL_OPTIONS. Order is the order shown. */
const MENU: Record<string, StarterHabit[]> = {
  "Build consistency": [WATER, PUSHUPS, ONE_LINE, MOVE],
  "Get stronger": [PUSHUPS, TRAIN, PROTEIN, STRETCH],
  "Lose weight": [MOVE, WATER, PROTEIN, WIND_DOWN],
  "Improve mental clarity": [FOCUS, SCREENS_OFF, READ, BREATHE],
  "Reduce stress": [BREATHE, ONE_LINE, MOVE, SCREENS_OFF],
  "Better sleep": [WIND_DOWN, SCREENS_OFF, MOVE, ONE_LINE],
  "Build confidence": [BRAVE, PUSHUPS, GRATITUDE, ONE_LINE],
  "Stay active": [MOVE, STRETCH, TRAIN, WATER],
};

/** For a goal typed in as "Something else". */
const DEFAULT_MENU = [WATER, MOVE, ONE_LINE, BREATHE];

/** The menu for a goal: 3–5 habits, skipping any that need equipment the
 *  user said they don't have. */
export function starterHabitsFor(goal: string | null | undefined, equipment: readonly string[] = []) {
  const menu = (goal && MENU[goal]) || DEFAULT_MENU;
  return menu.filter((h) => !h.needs || equipment.includes(h.needs)).slice(0, 5);
}

/** Every starter habit, once each — for tests and analytics lookups. */
export function allStarterHabits(): StarterHabit[] {
  return [...new Map([...Object.values(MENU).flat(), ...DEFAULT_MENU].map((h) => [h.id, h])).values()];
}

/** Weekdays used when a starter is "certain days": Monday to Friday. */
const WEEKDAYS = [1, 2, 3, 4, 5];

/** A starter, as the body POST /api/habits expects. */
export function starterToCreateInput(h: StarterHabit, startsOn?: string): CreateHabitInput {
  return {
    name: h.name,
    category: h.category,
    cue: h.anchor,
    response: h.tiny,
    craving: h.why,
    fullVersion: h.fullVersion,
    timeWindow: h.timeWindow,
    frequency: h.frequency,
    targetDays: h.frequency === "custom" ? WEEKDAYS : undefined,
    perWeekTarget: h.frequency === "weekly" ? h.perWeekTarget : undefined,
    startsOn,
  };
}

/**
 * Identity phrasings for a goal, offered as one-tap answers to "Who are you
 * becoming?". Habits stick better when they say something about who someone
 * is; the user's own words always win over these.
 */
const IDENTITIES: Record<string, string[]> = {
  "Build consistency": ["someone who shows up every day", "someone who keeps promises to myself"],
  "Get stronger": ["someone who trains", "someone who gets stronger every month"],
  "Lose weight": ["someone who moves every day", "someone who takes care of my body"],
  "Improve mental clarity": ["someone who protects my focus", "someone with a clear head"],
  "Reduce stress": ["someone who stays calm under pressure", "someone who makes time to breathe"],
  "Better sleep": ["someone who sleeps well", "someone who winds down on purpose"],
  "Build confidence": ["someone who does the hard thing", "someone who backs myself"],
  "Stay active": ["someone who moves every day", "someone who's always up for it"],
};

export function identitySuggestions(goal: string | null | undefined): string[] {
  return (goal && IDENTITIES[goal]) || ["someone who shows up for myself", "someone who keeps going"];
}

/**
 * How many habits can be in progress before the app suggests waiting.
 * A design judgement, not a study: each habit needs weeks of repetition,
 * and attention is finite. It's a nudge, never a block.
 */
export const BUILDING_SOFT_LIMIT = 3;

export function buildingCount(habits: readonly { status?: string | null; isActive?: boolean }[]) {
  return habits.filter((h) => h.isActive !== false && (h.status ?? "building") === "building").length;
}

/** Next Monday as a date key, or today if it's Monday — a fresh start
 *  (Dai, Milkman & Riis 2014). */
export function nextMondayKey(today: string): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const add = day === 1 ? 0 : (8 - day) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

/** Lower-case the first letter unless the word looks like an acronym ("TV"). */
function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s;
}

function sentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * A habit as one plain sentence, the way the builder previews it:
 * "After I pour my coffee, I'll do 2 push-ups." plus the extras that make it
 * stick. Writing the plan out in full is the implementation intention.
 */
export function describeHabitPlan(h: {
  name: string;
  cue?: string | null;
  response?: string | null;
  fullVersion?: string | null;
  backupPlan?: string | null;
}): { plan: string; extras: string[] } {
  const anchor = h.cue?.trim().replace(/[,.]$/, "");
  const raw = lowerFirst((h.response?.trim() || h.name.trim()).replace(/[.]$/, ""));
  // "2 push-ups" and "a few sips" aren't verbs: "I'll do 2 push-ups".
  const action = /^(\d|a |an |one |two |three |some |a few )/i.test(raw) ? `do ${raw}` : raw;
  const plan = anchor
    ? `${anchor[0].toUpperCase()}${anchor.slice(1)}, I'll ${action}.`
    : sentence(`I'll ${action}`);

  const extras: string[] = [];
  if (h.fullVersion?.trim()) extras.push(sentence(`On a good day: ${lowerFirst(h.fullVersion.trim())}`));
  if (h.backupPlan?.trim()) extras.push(sentence(h.backupPlan.trim()));
  return { plan, extras };
}

/** An AI draft, as the body POST /api/habits expects — every v2 field kept,
 *  the rationale (which explains the suggestion, not the habit) dropped. */
export function draftToCreateInput(d: HabitDraft): CreateHabitInput {
  return {
    name: d.name,
    category: d.category,
    cue: d.cue,
    craving: d.craving,
    response: d.response,
    reward: d.reward,
    frequency: d.frequency,
    targetDays: d.targetDays,
    fullVersion: d.fullVersion,
    backupPlan: d.backupPlan,
    timeWindow: d.timeWindow,
    perWeekTarget: d.frequency === "weekly" ? d.perWeekTarget : undefined,
  };
}
