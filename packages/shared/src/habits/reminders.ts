/**
 * Which habit reminders should exist, worked out from scratch every time.
 *
 * The phone throws away every habit reminder it has scheduled and replaces
 * them with this list whenever anything changes — a tick, a rest day, a new
 * habit, a new day. Because it's a pure function of habits, logs and the
 * clock, "no reminder for a habit that's already done" and "nothing on a rest
 * day" fall out of the rules instead of being cleanup code that can drift.
 *
 * What a reminder says follows the research and Zoe Chance's Persuasion P:
 * it arrives at the moment of decision (the start of the habit's part of the
 * day), it names the anchor rather than nagging ("After I pour my coffee: 2
 * push-ups"), and it quotes the user's own reason, tidied (see polish.ts).
 * Reminders support repetition but can get in the way of a habit becoming
 * automatic (Stawarz et al. 2015), so the app offers to turn one off once a
 * habit is holding — see `shouldOfferToFade`.
 */

import { addDays, type DateKey } from "./dates.js";
import { isDueOn, type ScheduledHabit, type TimeWindow } from "./schedule.js";

/** When each part of the day's reminder fires, local time. */
export const WINDOW_REMINDER_TIME: Record<Exclude<TimeWindow, "anytime">, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  midday: { hour: 12, minute: 30 },
  evening: { hour: 18, minute: 30 },
};

/** The one evening nudge for anything still open, including any-time habits. */
export const LAST_CALL_TIME = { hour: 20, minute: 30 };

/** Days ahead to schedule. Re-planned on every open, so a short horizon is
 *  enough, and it keeps well under iOS's 64 pending notifications. */
export const REMINDER_DAYS_AHEAD = 3;
const MAX_REMINDERS = 60;

export interface ReminderHabit extends ScheduledHabit {
  id: string;
  name: string;
  timeWindow: TimeWindow;
  reminderEnabled: boolean;
  /** Paused or graduated habits don't get reminders. */
  status?: string;
  /** Tidied text to quote (polish.ts). */
  display: { cue: string; response: string; craving: string };
  completed: ReadonlySet<DateKey>;
  rest: ReadonlySet<DateKey>;
  /** "Tomorrow, I'll …" promises by day — quoted back on that morning. */
  promises?: ReadonlyMap<DateKey, string>;
}

export interface PlannedReminder {
  /** Stable, so a re-plan replaces rather than duplicates. */
  id: string;
  kind: "habit" | "last-call";
  day: DateKey;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** For "habit": which habit the Done buttons log. */
  habitId?: string;
}

function minutes(t: { hour: number; minute: number }) {
  return t.hour * 60 + t.minute;
}

function sentence(s: string) {
  const t = s.trim();
  return !t ? "" : /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * "After I pour my coffee: 2 push-ups. To start the day ahead."
 * On a day they promised, their own promise leads instead — a commitment
 * someone made themselves carries further than one the app makes for them.
 */
export function reminderBody(
  h: Pick<ReminderHabit, "name" | "display" | "promises">,
  day?: DateKey
): string {
  const promise = day ? h.promises?.get(day) : undefined;
  if (promise) return [`You said: "${promise.trim()}"`, sentence(h.display.craving)].filter(Boolean).join(" ");
  const action = h.display.response || h.name;
  const lead = h.display.cue ? `${h.display.cue.replace(/[,.]$/, "")}: ${action}` : action;
  return [sentence(lead), sentence(h.display.craving)].filter(Boolean).join(" ");
}

function isOpen(h: ReminderHabit, day: DateKey) {
  return (
    h.status !== "paused" &&
    h.status !== "established" &&
    isDueOn(h, day, h.completed) &&
    !h.completed.has(day) &&
    !h.rest.has(day)
  );
}

export function plannedReminders(
  habits: readonly ReminderHabit[],
  today: DateKey,
  nowMinutes: number,
  options: { lastCall?: boolean; daysAhead?: number } = {}
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const days = options.daysAhead ?? REMINDER_DAYS_AHEAD;

  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const future = (t: { hour: number; minute: number }) => i > 0 || minutes(t) > nowMinutes;

    for (const h of habits) {
      if (!h.reminderEnabled || h.timeWindow === "anytime" || !isOpen(h, day)) continue;
      const at = WINDOW_REMINDER_TIME[h.timeWindow];
      if (!future(at)) continue;
      out.push({
        id: `habit-${h.id}-${day}`,
        kind: "habit",
        day,
        ...at,
        title: h.name,
        body: reminderBody(h, day),
        habitId: h.id,
      });
    }

    if (options.lastCall !== false && future(LAST_CALL_TIME)) {
      const open = habits.filter((h) => h.reminderEnabled && isOpen(h, day));
      if (open.length) {
        const names = open.map((h) => h.name);
        out.push({
          id: `lastcall-${day}`,
          kind: "last-call",
          day,
          ...LAST_CALL_TIME,
          title: open.length === 1 ? "One left today" : `${open.length} left today`,
          body:
            names.length <= 3
              ? `${names.join(", ")}. Even the tiny version counts.`
              : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more. Even the tiny version counts.`,
        });
      }
    }
  }

  return out
    .sort((a, b) => a.day.localeCompare(b.day) || minutes(a) - minutes(b))
    .slice(0, MAX_REMINDERS);
}

/** A run long enough that the reminder may now be in the way. A design
 *  judgement until the weekly automaticity check (Phase 8) can say. */
export const FADE_AFTER_STREAK = 14;

/** Offer to turn a reminder off once the habit is clearly holding. */
export function shouldOfferToFade(h: {
  reminderEnabled: boolean;
  timeWindow: TimeWindow;
  streak: number;
  streakUnit: "day" | "week";
}): boolean {
  return (
    h.reminderEnabled &&
    h.timeWindow !== "anytime" &&
    h.streakUnit === "day" &&
    h.streak >= FADE_AFTER_STREAK
  );
}
