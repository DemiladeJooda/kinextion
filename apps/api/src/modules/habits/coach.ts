/**
 * Reading the answer to "What would it take to make this easier tomorrow?".
 *
 * One model call per answer. The model reflects back what the user said (in
 * their words, kindly) and proposes exactly one change from a fixed menu —
 * shrink the tiny version, move it, change the days, pause it, or nothing —
 * that the app can apply in one tap. A free-form "suggestion" is never
 * accepted: anything outside `habitChangeSchema` is dropped, so the button
 * can only ever do something the user can read in full first.
 *
 * Attention over pressure (Zoe Chance): reflect first, invite, one idea, no
 * lecture. The conversation is delivered as a card on Today, not a chat.
 */

import { SAFETY_BLOCK } from "@kinextion/ai-core";
import {
  coachFor,
  describeHabitPlan,
  describeSchedule,
  displayFields,
  habitChangeSchema,
  whatWouldItTake,
  type HabitChange,
} from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";

export interface CoachHabit {
  name: string;
  category: string;
  cue: string | null;
  response: string | null;
  craving: string | null;
  backupPlan: string | null;
  frequency: string;
  targetDays: unknown;
  perWeekTarget: number | null;
  timeWindow: string;
  polished?: unknown;
}

export interface CoachReply {
  /** One or two short sentences: reflect back, then the invitation. */
  reply: string;
  change: HabitChange;
  /** An if-then for the obstacle they named, when they named one. */
  backupPlan: string | null;
  /** The answer read like distress — the app routes to Kairo instead. */
  concern: boolean;
}

const FALLBACK: CoachReply = {
  reply: "Thanks for saying it. Want to keep it as it is and try the tiny version tomorrow?",
  change: { type: "none" },
  backupPlan: null,
  concern: false,
};

export async function reflectOnMiss(
  habit: CoachHabit,
  missedOn: string,
  answer: string
): Promise<CoachReply> {
  const guide = coachFor(habit.category) === "altheo" ? "Altheo" : "Kairo";
  const shown = displayFields(habit);
  const plan = describeHabitPlan({ name: habit.name, cue: shown.cue, response: shown.response }).plan;

  const system = [
    `You are ${guide}, a guide inside the Kinextion habit app. The user missed a habit and you asked them: "${whatWouldItTake(habit.name)}". Their answer is below.`,
    "",
    "## What to do",
    "- Reflect back what they said first, in a few of their own words, kindly. Then make one offer.",
    "- Propose exactly ONE change, the smallest that addresses what they actually said:",
    "  shrink — a smaller tiny version; move — a different anchor or part of the day; schedule — fewer or different days;",
    "  pause — step back for now; none — keep it, and turn their answer into a backup plan.",
    "- If they say they were just busy or it was a one-off, prefer 'none' with a backup plan for the next busy day.",
    "- The backup plan, if any, is an if-then in their voice: 'If I'm working late, I'll do 1 push-up before bed.'",
    "- Offer, don't instruct: 'Want to try…?'. Never guilt, never lecture, never mention streaks or scores.",
    habit.category === "physical"
      ? "- For gym or training habits, about four sessions a week tends to hold; only mention it if it fits what they said."
      : "",
    "- Under 35 words in total. Plain sentences. No markdown, no emoji.",
    "- If the answer suggests crisis, self-harm, disordered eating or abuse, set concern to true, choose 'none', and reply with warmth only.",
    "",
    SAFETY_BLOCK,
    "",
    "## The habit",
    `- Name: ${habit.name}`,
    `- Plan: ${plan}`,
    `- Schedule: ${describeSchedule(habit)}; part of the day: ${habit.timeWindow}`,
    shown.craving ? `- Why it matters to them: ${shown.craving}` : "",
    shown.backupPlan ? `- Current backup plan: ${shown.backupPlan}` : "",
    `- Missed on: ${missedOn}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await generateStructured<{
      reply?: string;
      change?: unknown;
      backupPlan?: string;
      concern?: boolean;
    }>({
      task: "coach",
      system,
      messages: [{ role: "user", content: answer.trim() || "(no answer)" }],
      toolName: "respond",
      toolDescription: "Reflect back, and propose one change to the habit.",
      inputSchema: {
        type: "object",
        properties: {
          reply: { type: "string", maxLength: 300 },
          change: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["shrink", "move", "schedule", "pause", "none"] },
              response: { type: "string", maxLength: 200, description: "For shrink: the new tiny version." },
              cue: { type: "string", maxLength: 200, description: "For move: the new anchor, 'After I …'." },
              timeWindow: { type: "string", enum: ["morning", "midday", "evening", "anytime"] },
              frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
              targetDays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
              perWeekTarget: { type: "integer", minimum: 1, maximum: 7 },
            },
            required: ["type"],
          },
          backupPlan: { type: "string", maxLength: 300 },
          concern: { type: "boolean" },
        },
        required: ["reply", "change"],
      },
    });

    // Length limits live in the schema's descriptions now; enforce them here.
    const reply = result.reply?.trim().slice(0, 400);
    if (!reply) return FALLBACK;
    const change = habitChangeSchema.safeParse(result.change);
    const concern = result.concern === true;

    return {
      reply,
      change: change.success && !concern ? change.data : { type: "none" },
      backupPlan:
        !concern && result.backupPlan?.trim() ? result.backupPlan.trim().slice(0, 300) : null,
      concern,
    };
  } catch {
    return FALLBACK;
  }
}
