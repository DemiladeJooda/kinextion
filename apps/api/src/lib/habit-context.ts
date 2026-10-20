/**
 * What Kinextion actually knows about a user, assembled for the habit
 * assistant and the check-in prompt.
 *
 * The rule this file exists to enforce: a suggestion may only be built from
 * signals that are really there. Every source below is queried, and a source
 * that returns nothing contributes nothing — no placeholder, no assumed
 * average, no "most people". `basis` is the list of sources that survived
 * that filter, and the app shows it verbatim so a proposal can be checked
 * rather than trusted.
 */

import { prisma } from "@kinextion/database";
import { toDateString } from "@kinextion/shared";
import { computePatterns } from "./patterns.js";
import { loadFactsForPrompt } from "./memory/store.js";

/** How far back the assistant looks. Long enough for a habit to prove itself,
 *  short enough that a month-old slump doesn't define someone. */
const LOOKBACK_DAYS = 30;
const MOOD_LOOKBACK_DAYS = 14;

export interface HabitContext {
  /** Prompt text handed to the model. Empty when the account is brand new. */
  contextBlock: string;
  /** Short labels naming each signal that was genuinely available. */
  basis: string[];
  /** Local hour + IANA zone, when the client sent them. */
  localHour: number | null;
  timeZone: string | null;
}

export interface ContextOptions {
  /** Device-local hour (0–23), so "after work" means the user's evening. */
  localHour?: number | null;
  /** IANA zone from the device, e.g. "America/Chicago". */
  timeZone?: string | null;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(toDateString(d));
}

/** Average of a list, rounded to one decimal. Null on an empty list rather
 *  than 0 — "no data" and "zero" are different claims. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

/** Minutes-from-midnight rendered as a clock time the model can quote back. */
function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function buildHabitContext(
  userId: string,
  options: ContextOptions = {}
): Promise<HabitContext> {
  const since = daysAgo(LOOKBACK_DAYS);
  const moodSince = daysAgo(MOOD_LOOKBACK_DAYS);

  const [profile, habits, logs, moods, metrics, memoryFacts, patterns] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.habit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.habitLog.findMany({
      where: { userId, date: { gte: since } },
      select: { habitId: true, completed: true, date: true },
    }),
    prisma.moodEntry.findMany({
      where: { userId, createdAt: { gte: moodSince } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.wearableMetric.findMany({
      where: { userId, date: { gte: since } },
      select: { metricType: true, value: true, unit: true, provider: true },
    }),
    loadFactsForPrompt(userId, 15).catch(() => [] as string[]),
    computePatterns(userId).catch(() => []),
  ]);

  const sections: string[] = [];
  const basis: string[] = [];

  // ── Who they said they are ────────────────────────────────────────────
  if (profile) {
    const goals = (profile.primaryGoals as string[] | null) ?? [];
    const equipment = (profile.equipment as string[] | null) ?? [];
    const lines: string[] = [];
    if (profile.displayName) lines.push(`- Name: ${profile.displayName}`);
    if (profile.fitnessLevel) lines.push(`- Fitness level: ${profile.fitnessLevel}`);
    if (goals.length) lines.push(`- Stated goals: ${goals.join(", ")}`);
    if (profile.weeklyAvailability) {
      lines.push(`- Available: ${profile.weeklyAvailability} days a week`);
    }
    if (equipment.length) lines.push(`- Equipment: ${equipment.join(", ")}`);

    if (lines.length) {
      sections.push(`## Profile\n${lines.join("\n")}`);
      if (goals.length) basis.push(`${goals.length} stated goal${goals.length === 1 ? "" : "s"}`);
      if (profile.weeklyAvailability) basis.push(`${profile.weeklyAvailability} days/week available`);
    }
  }

  // ── What they're already running, and how it's actually going ─────────
  // The most useful signal in the file: a habit at 20% completion is a habit
  // that needs shrinking, not a fifth sibling.
  const active = habits.filter((h) => h.isActive);
  const archived = habits.filter((h) => !h.isActive);

  if (active.length) {
    /**
     * Completion is measured against the days a habit has actually existed,
     * not a flat 30. A habit created on Tuesday is not "13% completed" on
     * Thursday, and scoring it that way would make the assistant tell someone
     * to shrink a habit they started two days ago.
     */
    const stats = active.map((h) => {
      const age = Math.max(
        1,
        Math.min(
          LOOKBACK_DAYS,
          Math.ceil((Date.now() - new Date(h.createdAt).getTime()) / 86_400_000)
        )
      );
      const done = logs.filter((l) => l.habitId === h.id && l.completed).length;
      return { habit: h, age, done, rate: done / age };
    });

    const rows = stats.map(({ habit: h, age, done, rate }) => {
      const cue = h.cue ? ` — cue: "${h.cue}"` : "";
      return `- ${h.name} (${h.category})${cue}: completed ${done}/${age} days (${Math.round(rate * 100)}%)`;
    });
    sections.push(`## Current habits, last ${LOOKBACK_DAYS} days\n${rows.join("\n")}`);
    basis.push(`${active.length} current habit${active.length === 1 ? "" : "s"}`);

    // A week is the earliest a habit can fairly be called struggling — before
    // that there simply isn't enough evidence either way.
    const struggling = stats.filter((s) => s.age >= 7 && s.rate < 0.3);
    if (struggling.length) {
      sections.push(
        `Struggling (under 30% completion over at least a week): ` +
          `${struggling.map((s) => s.habit.name).join(", ")}. ` +
          `Prefer shrinking or re-cueing one of these over adding something new.`
      );
      basis.push(`${struggling.length} habit${struggling.length === 1 ? "" : "s"} slipping`);
    }
  }

  if (archived.length) {
    sections.push(
      `## Already tried and archived\n${archived.map((h) => `- ${h.name}`).join("\n")}\n` +
        `Don't propose these again unless the user asks — they've been dropped once.`
    );
    basis.push(`${archived.length} archived`);
  }

  // ── How the days have felt ────────────────────────────────────────────
  if (moods.length) {
    const avgMood = mean(moods.map((m) => m.mood));
    const avgEnergy = mean(moods.filter((m) => m.energy != null).map((m) => m.energy as number));
    const avgStress = mean(moods.filter((m) => m.stress != null).map((m) => m.stress as number));

    const tagCounts = new Map<string, number>();
    for (const m of moods) {
      for (const t of ((m.tags as string[] | null) ?? [])) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag, n]) => `${tag} (${n}×)`);

    const lines = [`- Check-ins in the last ${MOOD_LOOKBACK_DAYS} days: ${moods.length}`];
    if (avgMood !== null) lines.push(`- Average mood: ${avgMood}/10`);
    if (avgEnergy !== null) lines.push(`- Average energy: ${avgEnergy}/10`);
    if (avgStress !== null) lines.push(`- Average stress: ${avgStress}/10`);
    if (topTags.length) lines.push(`- Most common tags: ${topTags.join(", ")}`);

    sections.push(`## Recent check-ins\n${lines.join("\n")}`);
    basis.push(`${moods.length} check-in${moods.length === 1 ? "" : "s"}`);
  }

  // ── Connected devices ─────────────────────────────────────────────────
  // Averaged per metric type. Calendar signals are split out below because
  // they say something different: *when* the day has room in it.
  const byType = new Map<string, number[]>();
  for (const m of metrics) {
    const list = byType.get(m.metricType) ?? [];
    list.push(m.value);
    byType.set(m.metricType, list);
  }

  const bodyLines: string[] = [];
  const BODY_METRICS: Array<[string, string, string]> = [
    ["steps", "Average daily steps", ""],
    ["sleep_duration", "Average sleep", " min"],
    ["sleep_score", "Average sleep score", ""],
    ["hrv", "Average HRV", ""],
    ["resting_heart_rate", "Average resting heart rate", " bpm"],
    ["active_calories", "Average active calories", ""],
  ];
  for (const [type, label, unit] of BODY_METRICS) {
    const avg = mean(byType.get(type) ?? []);
    if (avg !== null) bodyLines.push(`- ${label}: ${avg}${unit}`);
  }
  const workoutDays = (byType.get("workout") ?? []).length;
  if (workoutDays) bodyLines.push(`- Logged workouts on ${workoutDays} of the last ${LOOKBACK_DAYS} days`);

  if (bodyLines.length) {
    const providers = [...new Set(metrics.map((m) => m.provider))].filter(
      (p) => !p.endsWith("_calendar")
    );
    sections.push(`## Connected device data\n${bodyLines.join("\n")}`);
    if (providers.length) basis.push(providers.join(" + "));
  }

  // ── Calendar rhythm ───────────────────────────────────────────────────
  // Derived numbers only: when the day starts, how booked it is, where the
  // longest gap sits. No titles, no attendees — see the calendar adapters.
  const firstBusy = mean(byType.get("calendar_first_busy_minute") ?? []);
  const lastBusy = mean(byType.get("calendar_last_busy_minute") ?? []);
  const busyMinutes = mean(byType.get("calendar_busy_minutes") ?? []);
  const freeBlock = mean(byType.get("calendar_longest_free_minutes") ?? []);
  const freeStart = mean(byType.get("calendar_free_block_start_minute") ?? []);

  const calLines: string[] = [];
  if (firstBusy !== null) calLines.push(`- First commitment typically at ${clock(firstBusy)}`);
  if (lastBusy !== null) calLines.push(`- Last commitment typically ends around ${clock(lastBusy)}`);
  if (busyMinutes !== null) {
    calLines.push(`- Typically ${Math.round(busyMinutes)} minutes booked per day`);
  }
  if (freeBlock !== null && freeStart !== null) {
    calLines.push(
      `- Longest reliably free block: about ${Math.round(freeBlock)} minutes, starting near ${clock(freeStart)}`
    );
  }

  if (calLines.length) {
    sections.push(
      `## Calendar rhythm\n${calLines.join("\n")}\n` +
        `Anchor cues to these real times rather than inventing a schedule.`
    );
    basis.push("calendar rhythm");
  }

  // ── Constraints the guides already learned ────────────────────────────
  // Highest-stakes section: an injury or a night shift outranks every
  // preference above it, which is why it sits last and loudest.
  if (memoryFacts.length) {
    sections.push(
      `## What Kinextion already knows\n${memoryFacts.map((f) => `- ${f}`).join("\n")}\n` +
        `Treat constraints here as hard limits.`
    );
    basis.push(`${memoryFacts.length} remembered fact${memoryFacts.length === 1 ? "" : "s"}`);
  }

  if (patterns.length) {
    sections.push(
      `## Measured patterns\n${patterns.map((p) => `- ${p.summary} (n=${p.n})`).join("\n")}`
    );
    basis.push(`${patterns.length} measured pattern${patterns.length === 1 ? "" : "s"}`);
  }

  // ── Local time ────────────────────────────────────────────────────────
  const localHour = options.localHour ?? null;
  const timeZone = options.timeZone ?? null;
  if (localHour !== null) {
    sections.push(
      `## Right now\n- The user's local time is about ${clock(localHour * 60)}${
        timeZone ? ` (${timeZone})` : ""
      }.`
    );
    basis.push("local time");
  }

  return {
    contextBlock: sections.join("\n\n"),
    basis,
    localHour,
    timeZone,
  };
}
