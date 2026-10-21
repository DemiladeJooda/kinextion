/**
 * "What would it take?" — the change a missed habit leads to.
 *
 * Zoe Chance calls it the magic question: asked after a miss, it turns a
 * failure into problem-solving. Kinextion asks it, the AI reads the answer
 * and proposes exactly one concrete change, and the user applies it in one
 * tap. This file defines what a change can be, how it maps onto a habit edit,
 * and how it reads on the button — so the AI can only propose things the app
 * knows how to do, and the user always sees exactly what will change.
 */

import { z } from "zod";
import { habitTimeWindowSchema, type UpdateHabitInput } from "../schemas/index.js";

export const habitChangeSchema = z.discriminatedUnion("type", [
  /** Make the tiny version smaller. */
  z.object({ type: z.literal("shrink"), response: z.string().trim().min(1).max(200) }),
  /** Attach it to a different moment, or a different part of the day. */
  z.object({
    type: z.literal("move"),
    cue: z.string().trim().min(1).max(200).optional(),
    timeWindow: habitTimeWindowSchema.optional(),
  }),
  /** Fewer or different days. */
  z.object({
    type: z.literal("schedule"),
    frequency: z.enum(["daily", "weekly", "custom"]),
    targetDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    perWeekTarget: z.number().int().min(1).max(7).optional(),
  }),
  /** Step back for now, with no misses counted. */
  z.object({ type: z.literal("pause") }),
  /** Nothing to change: the answer becomes the backup plan. */
  z.object({ type: z.literal("none") }),
]);

export type HabitChange = z.infer<typeof habitChangeSchema>;

export const reflectOnMissSchema = z.object({
  /** The occasion that was missed. */
  missedOn: z.string().date(),
  /** What they said would make it easier. Empty with `skipped`. */
  answer: z.string().max(500).default(""),
  /** "Not now": recorded so the question isn't asked again for this miss. */
  skipped: z.boolean().optional(),
});

export type ReflectOnMissInput = z.infer<typeof reflectOnMissSchema>;

export const precommitSchema = z.object({
  forDate: z.string().date(),
  text: z.string().trim().min(1).max(200),
});

export type PrecommitInput = z.infer<typeof precommitSchema>;

/** The habit edit a change makes. Pause never deletes or archives. */
export function changeToUpdate(change: HabitChange): UpdateHabitInput | null {
  switch (change.type) {
    case "shrink":
      return { response: change.response };
    case "move": {
      const u: UpdateHabitInput = {};
      if (change.cue) u.cue = change.cue;
      if (change.timeWindow) u.timeWindow = change.timeWindow;
      return Object.keys(u).length ? u : null;
    }
    case "schedule":
      return {
        frequency: change.frequency,
        ...(change.frequency === "custom" && change.targetDays ? { targetDays: change.targetDays } : {}),
        ...(change.frequency === "weekly" ? { perWeekTarget: change.perWeekTarget ?? 1 } : {}),
      };
    case "pause":
      return { status: "paused" };
    case "none":
      return null;
  }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WINDOW_NAMES = { morning: "the morning", midday: "midday", evening: "the evening", anytime: "any time" };

/** What the apply button says, so nothing changes that the user didn't read. */
export function describeChange(change: HabitChange): string {
  switch (change.type) {
    case "shrink":
      return `Make the tiny version "${change.response}"`;
    case "move": {
      const parts: string[] = [];
      if (change.cue) parts.push(`do it "${change.cue}"`);
      if (change.timeWindow) parts.push(`in ${WINDOW_NAMES[change.timeWindow]}`);
      return parts.length ? `Move it: ${parts.join(", ")}` : "Keep it as it is";
    }
    case "schedule":
      if (change.frequency === "daily") return "Make it every day";
      if (change.frequency === "weekly") {
        const n = change.perWeekTarget ?? 1;
        return n === 1 ? "Make it once a week" : `Make it ${n} times a week`;
      }
      return `Make it ${(change.targetDays ?? []).slice().sort().map((d) => DAY_NAMES[d]).join(", ")}`;
    case "pause":
      return "Pause it for now (no misses while paused)";
    case "none":
      return "Keep it as it is";
  }
}

/** Who asks: Altheo for Body habits, Kairo for everything else. */
export function coachFor(category: string): "altheo" | "kairo" {
  return category === "physical" ? "altheo" : "kairo";
}

/** The question, worded once so the card and the model agree. */
export function whatWouldItTake(habitName: string): string {
  return `What would it take to make ${habitName.toLowerCase()} easier tomorrow?`;
}

/** One-tap answers, so typing is optional. */
export const QUICK_ANSWERS = [
  "Make it smaller",
  "A different time of day",
  "Fewer days a week",
  "I was just busy",
  "I need a break from it",
] as const;
