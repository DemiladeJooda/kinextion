import "server-only";

/**
 * Reading the data API from the web app.
 *
 * Server-side only, and deliberately so: the Clerk session token is minted in
 * a React Server Component and used to call apps/api directly, so it never
 * reaches the browser bundle and the dashboard renders as HTML rather than as
 * a loading spinner that then fetches.
 *
 * Everything here is a read. The web surface is a view onto what the phone
 * records; logging happens in the app, and pretending otherwise would mean
 * duplicating write paths that already exist and can already fail properly.
 */

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { isValidTimeZone, localDateKey, weekStartKey } from "@kinextion/shared";

/** Set by components/dashboard/TimeZoneSync from the browser. */
const TZ_COOKIE = "kx_tz";

/** The reader's IANA zone, or null on the very first render before the
 *  browser has had a chance to say. */
export async function readerTimeZone(): Promise<string | null> {
  try {
    const raw = (await cookies()).get(TZ_COOKIE)?.value;
    const tz = raw ? decodeURIComponent(raw) : null;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

/**
 * One GET against the data API as the signed-in user.
 *
 * Returns null rather than throwing on any failure. A dashboard tile with
 * nothing in it is a survivable degradation; a 500 on the whole page because
 * one endpoint was slow is not — and these are independent reads, so one
 * being unavailable says nothing about the others.
 */
async function get<T>(path: string, timeZone: string | null): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;

  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) return null;

    const res = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(timeZone ? { "X-Time-Zone": timeZone } : {}),
      },
      // Personal, always-changing data — never serve it from a cache.
      cache: "no-store",
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as { success?: boolean; data?: T };
    return payload?.success ? (payload.data ?? null) : null;
  } catch {
    return null;
  }
}

// ─── Shapes, narrowed to what the dashboard renders ─────────────────────────

export interface DashboardScore {
  overallScore: number;
  breakdown: {
    habitsCompleted: number;
    habitsTotal: number;
    workoutLogged: boolean;
    moodCheckedIn: boolean;
    reflectionDone: boolean;
    streakDays: number;
  } | null;
}

export interface DashboardHabit {
  id: string;
  name: string;
  category: string;
  cue: string | null;
  frequency: string;
  targetDays: number[] | null;
  createdAt: string;
}

export interface DashboardHabitLog {
  habitId: string;
  date: string;
  completed: boolean;
}

export interface DashboardCheckIn {
  entry: {
    mood: number;
    energy: number | null;
    stress: number | null;
    tags: string[] | null;
    journal: string | null;
    gratitude: string | null;
  } | null;
  reflectionDone: boolean;
}

export interface DashboardRecommendation {
  id: string;
  content: string;
  context: string | null;
  category: string;
  acted: boolean;
  dismissed: boolean;
}

export interface DashboardProfile {
  profile: { displayName: string | null } | null;
}

export interface DashboardData {
  profile: DashboardProfile | null;
  score: DashboardScore | null;
  habits: DashboardHabit[] | null;
  logs: DashboardHabitLog[] | null;
  checkIn: DashboardCheckIn | null;
  recommendation: DashboardRecommendation | null;
  /** The reader's today, in their own zone, and the zone it came from. */
  today: string;
  timeZone: string | null;
  /** True when the API couldn't be reached at all, so the page can say so. */
  unreachable: boolean;
}

export async function loadDashboard(): Promise<DashboardData> {
  const timeZone = await readerTimeZone();
  const today = localDateKey(new Date(), timeZone ?? "UTC");

  // Fetched together — six sequential round trips would be visible as a
  // slow first byte, and none of these depends on another.
  const [profile, score, habits, logs, checkIn, recommendation] = await Promise.all([
    get<DashboardProfile>("/api/users/me/profile", timeZone),
    get<DashboardScore>("/api/score/today", timeZone),
    get<DashboardHabit[]>("/api/habits", timeZone),
    // From Monday: a weekly habit done on Tuesday isn't due again this week.
    get<DashboardHabitLog[]>(`/api/habits/logs?from=${weekStartKey(today)}`, timeZone),
    get<DashboardCheckIn>("/api/checkin/today", timeZone),
    // GET, not POST: the read-only endpoint returns today's recommendation if
    // one exists and never spends a model call generating one. Opening the
    // dashboard should not cost anything.
    get<DashboardRecommendation>("/api/recommendations/today", timeZone),
  ]);

  return {
    profile,
    score,
    habits,
    logs,
    checkIn,
    recommendation,
    today,
    timeZone,
    unreachable: !apiBase() || (profile === null && score === null && habits === null),
  };
}
