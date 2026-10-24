/**
 * Reading the user's own words, and tidying how they're shown back.
 *
 * This is the AI working as an assistant rather than a chat: nobody asks for
 * it, nothing waits on it. After a habit is saved, its free-text fields
 * (anchor, tiny version, why, backup plan) are read once and a clean version
 * is stored in `Habit.polished`. The app shows that version on Today, in
 * reminders and in the plan sentence; the raw text stays as typed for editing
 * and for the model's own context.
 *
 * The why gets the most care. People write their harshest self-talk into it
 * ("because I'm lazy and disgusting"), and a reminder that quotes that every
 * morning does harm. The polished why is the positive reason underneath, in
 * their voice. If it reads like distress, it's flagged instead of polished,
 * and the app never quotes it.
 */

import type { FastifyBaseLogger } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import {
  POLISHED_FIELDS,
  basicTidy,
  needsPolish,
  type HabitPolish,
  type PolishedField,
} from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";

type RawFields = Partial<Record<PolishedField, string | null>>;

const LABELS: Record<PolishedField, string> = {
  cue: "anchor (when it happens)",
  response: "tiny version",
  craving: "why it matters to them",
  backupPlan: "backup plan",
};

const MAX_LENGTH = 160;

const SYSTEM = [
  "You tidy how a person's own words about one habit are shown back to them inside a habit app. You are not chatting with them; nobody will see this prompt or your reasoning, only the cleaned text.",
  "",
  "For each field you're given, return a clean version:",
  "- Keep their meaning and their voice, in the first person. Never add goals, numbers, claims or advice they didn't give.",
  "- Fix spelling and grammar. Drop filler, rambling and swearing.",
  "- Keep it short: under 12 words for the anchor and the tiny version, under 15 for the why and the backup plan.",
  "- The anchor reads as 'After I …' or 'When I …'. The tiny version reads as the action itself ('2 push-ups'). The backup plan reads as 'If …, I'll …'.",
  "- The why becomes the positive reason underneath what they wrote, said kindly. Remove insults and self-criticism entirely. Never shame, never diagnose.",
  "- Only use what they actually wrote. Don't add a body, a feeling, a person or a goal they didn't mention.",
  "- If the why holds no real reason, only self-criticism, return exactly: 'To keep <habit, in lower case> going'.",
  "- Every example in these instructions is an illustration of the shape, never wording to reuse.",
  "- If the why suggests a crisis, self-harm, disordered eating, or abuse, set concern to true and return the why exactly as written. Do not soften it.",
  "- If a field is already clean, return it unchanged.",
].join("\n");

/** One model call for all of a habit's text. Fields the model drops or
 *  returns empty fall back to a basic tidy, so the result is always whole. */
export async function polishHabitText(name: string, raw: RawFields): Promise<HabitPolish> {
  const fields = POLISHED_FIELDS.filter((f) => raw[f]?.trim());
  const of: HabitPolish["of"] = {};
  for (const f of fields) of[f] = raw[f] as string;
  if (fields.length === 0) return { of, source: "ai" };

  const given = fields.map((f) => `${LABELS[f]} (${f}): ${JSON.stringify(raw[f])}`).join("\n");

  const result = await generateStructured<Partial<Record<PolishedField, string>> & { concern?: boolean }>({
    task: "polish",
    system: SYSTEM,
    messages: [{ role: "user", content: `Habit: ${JSON.stringify(name)}\n\n${given}` }],
    toolName: "polish_habit",
    toolDescription: "Return the cleaned text for each field that was given.",
    inputSchema: {
      type: "object",
      properties: {
        ...Object.fromEntries(
          fields.map((f) => [f, { type: "string", maxLength: MAX_LENGTH, description: LABELS[f] }])
        ),
        concern: {
          type: "boolean",
          description: "True only if the why suggests crisis, self-harm, disordered eating or abuse.",
        },
      },
      required: fields,
    },
  });

  const out: HabitPolish = { of, source: "ai", concern: result.concern === true };
  for (const f of fields) {
    const v = typeof result[f] === "string" ? result[f]!.trim().slice(0, MAX_LENGTH) : "";
    out[f] = v || basicTidy(raw[f]);
  }
  // A flagged why is kept exactly as written, never a cheerful rewrite.
  if (out.concern && raw.craving) out.craving = raw.craving;
  return out;
}

/** Habits being polished right now, so a burst of saves makes one call. */
const inFlight = new Set<string>();

/**
 * Polish a habit in the background. Never throws and never blocks a
 * response: a failed or slow model call just leaves the basic tidy showing.
 * The write only lands if the text hasn't changed while the model was
 * thinking — otherwise a newer edit would get an older reading.
 */
export function schedulePolish(log: FastifyBaseLogger, habitId: string, userId: string): void {
  if (inFlight.has(habitId)) return;
  inFlight.add(habitId);

  void (async () => {
    try {
      const habit = await prisma.habit.findUnique({ where: { id: habitId } });
      if (!habit || habit.userId !== userId || !needsPolish(habit)) return;

      const polished = await polishHabitText(habit.name, habit);

      await prisma.habit.updateMany({
        where: {
          id: habitId,
          userId,
          cue: habit.cue,
          response: habit.response,
          craving: habit.craving,
          backupPlan: habit.backupPlan,
        },
        data: { polished: polished as unknown as Prisma.InputJsonValue },
      });

      if (polished.concern) {
        log.warn({ event: "habit_why_concern", habitId }, "habit why flagged for care");
      }
    } catch (err) {
      log.warn({ err, habitId }, "habit polish failed; basic tidy stays");
    } finally {
      inFlight.delete(habitId);
    }
  })();
}
