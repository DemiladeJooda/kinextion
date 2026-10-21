/**
 * Calendar dates in the user's own day.
 *
 * A habit is done "today" in the place the user is standing, not in UTC. The
 * old helpers sliced `toISOString()`, which put every log after ~7pm in Dallas
 * on tomorrow's row. Everything here works on plain `YYYY-MM-DD` strings —
 * they compare correctly as strings, survive JSON, and match how Postgres
 * returns a `@db.Date` column once it's sliced.
 */

export type DateKey = string; // YYYY-MM-DD

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** True when `tz` is an IANA zone this runtime can format in. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `at` as seen in `timeZone`. */
function zonedParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Some engines still report midnight as 24 even with h23.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * The calendar date of `at` for someone in `timeZone`. With no zone, the
 * runtime's own — which on a phone is exactly the user's.
 */
export function localDateKey(at: Date = new Date(), timeZone?: string | null): DateKey {
  if (!timeZone) {
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  }
  const p = zonedParts(at, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** A `@db.Date` value (UTC midnight) back to its key. */
export function dateKeyOf(date: Date | string): DateKey {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

/** The key as the Date Prisma expects for a `@db.Date` column. */
export function dateFromKey(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(key: DateKey, days: number): DateKey {
  return dateKeyOf(new Date(dateFromKey(key).getTime() + days * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday, matching `Habit.targetDays`. */
export function dayOfWeek(key: DateKey): number {
  return dateFromKey(key).getUTCDay();
}

/** Monday of the week containing `key`. */
export function weekStartKey(key: DateKey): DateKey {
  const isoDay = (dayOfWeek(key) + 6) % 7; // 0 = Monday
  return addDays(key, -isoDay);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / DAY_MS);
}

/** Offset of `timeZone` from UTC at instant `at`, in ms. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant local midnight begins on `key` in `timeZone` — the lower bound
 * for "created today" queries on timestamp columns. Two passes so a DST
 * change between UTC midnight and local midnight still lands exactly.
 */
export function dayStartInstant(key: DateKey, timeZone: string): Date {
  const guess = dateFromKey(key).getTime();
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  const second = guess - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}
