/**
 * The question at the top of the check-in.
 *
 * A blank journal box is the reason most reflection features go unused. This
 * generates one specific question from what actually happened today — the
 * habit that slipped, the streak that held, the stress average that's been
 * climbing — so the user starts with something to answer rather than a cursor.
 *
 * If there's nothing real to ask about, it says so and asks something plain.
 * The fallback is deliberately unremarkable: a generic question is honest,
 * an invented observation is not.
 */

import { SAFETY_BLOCK } from "@kinextion/ai-core";
import { generateStructured } from "../ai/services/ai-service.js";
import type { HabitContext } from "../../lib/habit-context.js";

export interface CheckInPrompt {
  /** One question, under about 25 words. */
  prompt: string;
  /** Optional single line of context shown above it, when there's a real
   *  observation to make. Null when there isn't — never filled with filler. */
  observation: string | null;
}

const FALLBACK: CheckInPrompt = {
  prompt: "What's one thing that stood out about today?",
  observation: null,
};

export async function generateCheckInPrompt(context: HabitContext): Promise<CheckInPrompt> {
  const hasContext = context.contextBlock.trim().length > 0;

  const system = [
    "You write the opening question for someone's daily check-in in Kinextion.",
    "",
    "## What makes a good question here",
    "- One question. Answerable in two or three sentences by a tired person.",
    "- Specific to today where the data supports it, open where it doesn't.",
    "- Curious, never evaluative. You are not grading their day.",
    "- Never ask about weight, calories, or restriction.",
    "- Plain sentences. No markdown, no emoji, no greeting.",
    "",
    "## Honesty",
    "- The observation may only restate something present in the context below, and may quote its numbers.",
    "- Never invent an event, a number, or a trend. If the context is empty, return no observation at all and ask something plain and open.",
    "",
    SAFETY_BLOCK,
    "",
    hasContext
      ? `## Today's context\n\n${context.contextBlock}`
      : "## Today's context\n\nNothing tracked yet.",
  ].join("\n");

  try {
    const result = await generateStructured<{ prompt?: string; observation?: string }>({
      task: "checkinPrompt",
      system,
      messages: [
        {
          role: "user",
          content: "Give me the question for my check-in right now.",
        },
      ],
      toolName: "write_prompt",
      toolDescription: "Return the check-in question, and an observation only if one is supported.",
      inputSchema: {
        type: "object",
        properties: {
          observation: {
            type: "string",
            maxLength: 160,
            description:
              "One sentence naming something real from the context, with its number. Omit entirely if the context supports nothing.",
          },
          prompt: {
            type: "string",
            maxLength: 200,
            description: "The question itself. Under 25 words.",
          },
        },
        required: ["prompt"],
      },
    });

    const prompt = result.prompt?.trim();
    if (!prompt) return FALLBACK;

    return {
      prompt,
      observation: hasContext ? (result.observation?.trim() || null) : null,
    };
  } catch {
    // A missing question must never block the check-in itself.
    return FALLBACK;
  }
}
