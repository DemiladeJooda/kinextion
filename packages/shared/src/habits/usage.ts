/**
 * Healthy use: noticing when the app itself is becoming the habit.
 *
 * Zoe Chance's TEDx talk on making behaviours addictive comes from getting
 * hooked on a pedometer herself, and the hangover after. A habit app can do
 * the same thing, so Kinextion watches for three patterns and, when one
 * shows up, Kairo checks in gently — never a block, a lockout, or a shame:
 *
 *   - opening the app compulsively (dozens of times a day)
 *   - logging after midnight on several nights in a week
 *   - toggling the same habit back and forth
 *
 * Everything here is pure: the phone keeps a small rolling log on the device
 * (nothing is sent anywhere) and asks this file what, if anything, to say.
 * The thresholds are design judgements to tune with real data.
 */

import { addDays, type DateKey } from "./dates.js";

/** Opens in one day before the app checks in. */
export const COMPULSIVE_OPENS_PER_DAY = 30;
/** Nights with a log between midnight and LATE_UNTIL_HOUR, in the last 7. */
export const LATE_NIGHTS_PER_WEEK = 3;
export const LATE_UNTIL_HOUR = 4;
/** Ticks and unticks of one habit in one day. */
export const TOGGLES_PER_HABIT = 6;
/** Days of history kept on the device. */
const KEEP_DAYS = 14;

export interface UsageLog {
  /** App opens per day. */
  opens: Record<DateKey, number>;
  /** Days on which something was logged between midnight and 4am. */
  lateNights: DateKey[];
  /** Today's ticks per habit: { day, counts }. Older days are dropped. */
  toggles: { day: DateKey; counts: Record<string, number> };
  /** When each kind of check-in was last dismissed. */
  dismissed: Partial<Record<UsageConcern["kind"], DateKey>>;
}

export interface UsageConcern {
  kind: "opens" | "late" | "toggling";
  title: string;
  body: string;
  habitId?: string;
}

export function emptyUsage(today: DateKey): UsageLog {
  return { opens: {}, lateNights: [], toggles: { day: today, counts: {} }, dismissed: {} };
}

/** Drop anything older than the window, so the log stays tiny. */
function prune(log: UsageLog, today: DateKey): UsageLog {
  const floor = addDays(today, -KEEP_DAYS);
  return {
    opens: Object.fromEntries(Object.entries(log.opens).filter(([d]) => d >= floor)),
    lateNights: log.lateNights.filter((d) => d >= floor),
    toggles: log.toggles.day === today ? log.toggles : { day: today, counts: {} },
    dismissed: log.dismissed,
  };
}

export function recordOpen(log: UsageLog, today: DateKey): UsageLog {
  const next = prune(log, today);
  next.opens = { ...next.opens, [today]: (next.opens[today] ?? 0) + 1 };
  return next;
}

/** A tick or untick. `hour` is the local hour it happened. */
export function recordHabitLog(log: UsageLog, today: DateKey, hour: number, habitId: string): UsageLog {
  const next = prune(log, today);
  next.toggles = {
    day: today,
    counts: { ...next.toggles.counts, [habitId]: (next.toggles.counts[habitId] ?? 0) + 1 },
  };
  if (hour < LATE_UNTIL_HOUR && !next.lateNights.includes(today)) {
    next.lateNights = [...next.lateNights, today];
  }
  return next;
}

export function dismissConcern(log: UsageLog, kind: UsageConcern["kind"], today: DateKey): UsageLog {
  return { ...log, dismissed: { ...log.dismissed, [kind]: today } };
}

/**
 * What, if anything, Kairo should gently say. One thing at a time, most
 * important first. A dismissed check-in stays quiet for the rest of the day,
 * or the rest of the week for late nights.
 */
export function usageConcern(
  log: UsageLog,
  today: DateKey,
  habitName: (id: string) => string = () => "this one"
): UsageConcern | null {
  const quiet = (kind: UsageConcern["kind"], days: number) => {
    const at = log.dismissed[kind];
    return at !== undefined && at > addDays(today, -days);
  };

  const weekAgo = addDays(today, -7);
  const late = log.lateNights.filter((d) => d > weekAgo).length;
  if (late >= LATE_NIGHTS_PER_WEEK && !quiet("late", 7)) {
    return {
      kind: "late",
      title: "Late nights this week",
      body: "You've been logging after midnight a few nights. Sleep counts as a habit too, and everything here will still be waiting in the morning.",
    };
  }

  if (log.toggles.day === today) {
    const [id, n] = Object.entries(log.toggles.counts).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (id && n >= TOGGLES_PER_HABIT && !quiet("toggling", 1)) {
      return {
        kind: "toggling",
        habitId: id,
        title: `Going back and forth on ${habitName(id)}?`,
        body: "However today went, it's okay. Pick what's true and leave it. Nothing here is keeping score of that.",
      };
    }
  }

  if ((log.opens[today] ?? 0) >= COMPULSIVE_OPENS_PER_DAY && !quiet("opens", 1)) {
    return {
      kind: "opens",
      title: "You've checked in a lot today",
      body: "Your habits will keep. You don't need to look this often. Want to put the phone down for a bit? If something's on your mind, Kairo's around.",
    };
  }

  return null;
}
