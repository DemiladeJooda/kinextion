/**
 * The life a simulated habit has to fit into.
 *
 * A habit isn't formed in a lab. It meets Thanksgiving, a week of night
 * shifts, a kid home sick, the clocks going back, a Texas August. The
 * calendar here is built once per life and start date, then shared by every
 * path — same life, same habit, different routes — so the differences
 * between paths are the person's, not the dice's.
 *
 * Calendar facts are real (US holidays and daylight-saving dates, rough
 * seasonal climate by region). Everything else is an illustration.
 */

import { addDays, dateFromKey, type DateKey } from "../habits/dates.js";
import type { UserBackground } from "../profile/index.js";

// ─── Seeded randomness ────────────────────────────────────────────────────────

/** A repeatable random stream from a string, so a demo plays the same every time. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Lives ────────────────────────────────────────────────────────────────────

export type WorkPattern = "office" | "shifts" | "student" | "home" | "flexible";
export type Household = "alone" | "partner" | "kids";
export type Climate = "hot_summer" | "cold_winter" | "mild";

export interface SimLife {
  id: string;
  /** "Night-shift nurse in Houston". */
  label: string;
  location: string | null;
  climate: Climate;
  work: WorkPattern;
  household: Household;
  /** Short lines for the life card. */
  summary: string[];
  /** True when built from the viewer's own profile. */
  own?: boolean;
}

/** Example lives for the demo. Fictional, and labelled as such on screen. */
export const EXAMPLE_LIVES: readonly SimLife[] = [
  {
    id: "houston-nurse",
    label: "Nurse on night shifts, Houston",
    location: "Houston, Texas",
    climate: "hot_summer",
    work: "shifts",
    household: "kids",
    summary: ["Three night shifts most weeks", "Two kids in school", "Long, hot summers"],
  },
  {
    id: "atlanta-student",
    label: "College student, Atlanta",
    location: "Atlanta, Georgia",
    climate: "hot_summer",
    work: "student",
    household: "alone",
    summary: ["Classes and a part-time job", "Exam weeks in December and May", "Lives with roommates"],
  },
  {
    id: "chicago-office",
    label: "Office job and a partner, Chicago",
    location: "Chicago, Illinois",
    climate: "cold_winter",
    work: "office",
    household: "partner",
    summary: ["9-to-5 with deadline weeks", "Lives with a partner", "Cold, dark winters"],
  },
];

const HOT = [
  "texas", "tx", "houston", "dallas", "austin", "san antonio", "fort worth", "el paso",
  "arizona", "az", "phoenix", "tucson", "florida", "fl", "miami", "orlando", "tampa",
  "louisiana", "new orleans", "nevada", "las vegas", "oklahoma", "georgia", "atlanta",
  "alabama", "mississippi", "south carolina", "lagos", "accra", "dubai",
];
const COLD = [
  "minnesota", "minneapolis", "wisconsin", "milwaukee", "michigan", "detroit", "illinois",
  "chicago", "new york", "boston", "massachusetts", "ohio", "cleveland", "pennsylvania",
  "pittsburgh", "colorado", "denver", "maine", "vermont", "north dakota", "montana",
  "toronto", "canada", "london", "manchester",
];

const mentions = (text: string, words: readonly string[]) =>
  words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(text));

/** Rough climate from a free-text place. Unknown places get mild weather. */
export function climateOf(location: string | null | undefined): Climate {
  const text = (location ?? "").toLowerCase();
  if (mentions(text, HOT)) return "hot_summer";
  if (mentions(text, COLD)) return "cold_winter";
  return "mild";
}

/** The viewer's own life, read from what they wrote in "About you". */
export function lifeFromBackground(bg: UserBackground): SimLife {
  const work = (bg.work ?? "").toLowerCase();
  const home = (bg.household ?? "").toLowerCase();
  const pattern: WorkPattern = /shift|night|nurse|rotation|on call/.test(work)
    ? "shifts"
    : /student|college|university|school|class/.test(work)
      ? "student"
      : /stay[- ]at[- ]home|homemaker|retired|unemployed/.test(work)
        ? "home"
        : /freelance|self[- ]employed|own business|remote/.test(work)
          ? "flexible"
          : "office";
  const household: Household = /kid|child|son|daughter|baby|toddler/.test(home)
    ? "kids"
    : /partner|wife|husband|girlfriend|boyfriend|spouse|fianc/.test(home)
      ? "partner"
      : "alone";
  const location = bg.location?.trim() || null;
  return {
    id: "own",
    label: location ? `Your life, ${location}` : "Your life",
    location,
    climate: climateOf(location),
    work: pattern,
    household,
    summary: [bg.work, bg.household, location].filter((s): s is string => Boolean(s?.trim())),
    own: true,
  };
}

// ─── The calendar ─────────────────────────────────────────────────────────────

export type LifeEventKind = "weather" | "holiday" | "work" | "family" | "health" | "travel" | "season";

export interface LifeEvent {
  kind: LifeEventKind;
  label: string;
  /** How much harder it makes the day, 0–1. */
  load: number;
}

const month = (d: DateKey) => Number(d.slice(5, 7));
const dom = (d: DateKey) => Number(d.slice(8, 10));
const weekday = (d: DateKey) => dateFromKey(d).getUTCDay(); // 0 = Sunday

/** The nth weekday (0 = Sunday) of a month, e.g. Thanksgiving = 4th Thursday of November. */
function nthWeekday(year: number, m: number, wd: number, n: number): DateKey {
  const first = `${year}-${String(m).padStart(2, "0")}-01`;
  const offset = (wd - weekday(first) + 7) % 7;
  return addDays(first, offset + (n - 1) * 7);
}

function fixedEvents(d: DateKey): LifeEvent[] {
  const y = Number(d.slice(0, 4));
  const m = month(d);
  const day = dom(d);
  const out: LifeEvent[] = [];
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  if (d === thanksgiving) out.push({ kind: "holiday", label: "Thanksgiving — family all day", load: 0.55 });
  if (d === addDays(thanksgiving, 1)) out.push({ kind: "holiday", label: "Leftovers and a lazy day", load: 0.3 });
  if (m === 12 && day >= 24 && day <= 26) out.push({ kind: "holiday", label: "Christmas break", load: 0.5 });
  if ((m === 12 && day === 31) || (m === 1 && day === 1)) out.push({ kind: "holiday", label: "New Year's", load: 0.45 });
  if (m === 7 && day === 4) out.push({ kind: "holiday", label: "Fourth of July cookout", load: 0.4 });
  // US daylight saving: back on the first Sunday of November, forward on the second Sunday of March.
  if (d === nthWeekday(y, 11, 0, 1)) out.push({ kind: "season", label: "Clocks went back — dark by early evening", load: 0.25 });
  if (d === nthWeekday(y, 3, 0, 2)) out.push({ kind: "season", label: "Clocks went forward — an hour less sleep", load: 0.25 });
  return out;
}

function weather(life: SimLife, d: DateKey, rand: () => number): LifeEvent | null {
  const m = month(d);
  if (life.climate === "hot_summer" && m >= 6 && m <= 9 && rand() < 0.3) {
    return { kind: "weather", label: "Brutal heat by the afternoon", load: 0.2 };
  }
  if (life.climate === "cold_winter" && (m === 12 || m <= 2) && rand() < 0.3) {
    return { kind: "weather", label: "Freezing and dark this morning", load: 0.2 };
  }
  if (life.climate === "hot_summer" && (m === 4 || m === 5) && rand() < 0.08) {
    return { kind: "weather", label: "Thunderstorms all day", load: 0.15 };
  }
  return null;
}

/**
 * Every day's events for one life, from `start`, as an array indexed by day.
 * Deterministic for a given life and start date.
 */
export function lifeCalendar(life: SimLife, start: DateKey, days: number): LifeEvent[][] {
  const rand = seededRandom(`${life.id}:${start}`);
  const cal: LifeEvent[][] = Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    const events = fixedEvents(d);
    const w = weather(life, d, rand);
    if (w) events.push(w);
    return events;
  });

  const block = (from: number, length: number, event: LifeEvent) => {
    for (let i = from; i < Math.min(days, from + length); i++) cal[i].push(event);
  };

  // Work rhythm.
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    if (life.work === "shifts" && i % 7 >= 2 && i % 7 <= 4) {
      cal[i].push({ kind: "work", label: "Night shift", load: 0.3 });
    }
    if (life.work === "student") {
      const m = month(d);
      if ((m === 12 && dom(d) <= 14) || (m === 5 && dom(d) <= 10)) {
        cal[i].push({ kind: "work", label: "Exam week", load: 0.4 });
      }
      if (m === 8 && dom(d) >= 20 && dom(d) <= 26) {
        cal[i].push({ kind: "work", label: "First week of classes", load: 0.3 });
      }
    }
  }
  if (life.work === "office") {
    for (let i = 20 + Math.floor(rand() * 15); i < days; i += 35 + Math.floor(rand() * 20)) {
      block(i, 5, { kind: "work", label: "Deadline week", load: 0.3 });
    }
  }

  // Family.
  if (life.household === "kids") {
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (month(d) === 8 && dom(d) >= 12 && dom(d) <= 16) {
        cal[i].push({ kind: "family", label: "Back-to-school week", load: 0.35 });
      }
    }
    for (let i = 15 + Math.floor(rand() * 20); i < days; i += 40 + Math.floor(rand() * 25)) {
      block(i, 2, { kind: "family", label: "Kid home sick", load: 0.5 });
    }
  }
  if (life.household === "partner") {
    for (let i = 10 + Math.floor(rand() * 10); i < days; i += 30 + Math.floor(rand() * 20)) {
      cal[i].push({ kind: "family", label: "Date night", load: 0.15 });
    }
  }

  // A cold, and a trip, somewhere in the stretch.
  for (let i = 30 + Math.floor(rand() * 40); i < days; i += 110 + Math.floor(rand() * 60)) {
    block(i, 4, { kind: "health", label: "Under the weather", load: 0.65 });
  }
  if (days > 45) {
    const trip = 45 + Math.floor(rand() * Math.max(1, days - 60));
    block(trip, 3, { kind: "travel", label: "Weekend away", load: 0.45 });
  }

  return cal;
}

/** Combined difficulty of a day's events, 0–1. */
export function dayLoad(events: readonly LifeEvent[]): number {
  return Math.min(1, events.reduce((sum, e) => sum + e.load, 0));
}
