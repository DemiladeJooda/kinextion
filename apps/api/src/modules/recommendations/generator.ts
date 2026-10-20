/**
 * Generating one micro-recommendation.
 *
 * This used to be a stateless chat call from the phone: a good action, then
 * nothing. It's now the read half of a loop — every past recommendation and
 * what the user did with it feeds back in, so the system converges on what
 * actually gets done by *this* person rather than what reads well in general.
 *
 * Three tiers of tailoring, strongest last:
 *   1. Today's state — habits left, streaks, mood, wearables, calendar gaps.
 *   2. Measured preferences — categories and times that land, with sample
 *      sizes, gated so nothing is claimed on thin evidence.
 *   3. Verbatim history — the actual wording of recommendations they took and
 *      ignored, which carries the things statistics miss: too long, too gym,
 *      too chirpy, wrong kind of ask.
 */

import { SAFETY_BLOCK } from "@kinextion/ai-core";
import { WELLNESS_CATEGORIES } from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";
import type { HabitContext } from "../../lib/habit-context.js";
import type { RecommendationHistory } from "./preferences.js";

export interface GeneratedRecommendation {
  /** The action. Under 15 words, starts with a verb. */
  action: string;
  /** Why this one, referring to real signals. Stored as the row's context. */
  why: string;
  category: string;
}

/** Used when the model is unreachable — see the note at the call site. */
const FALLBACK: GeneratedRecommendation = {
  action: "Pick the easiest thing on your list and start it now.",
  why: "Couldn't reach the model just now, so this is the general answer rather than one built from your day.",
  category: "mental",
};

function historySection(history: RecommendationHistory): string {
  const parts: string[] = [];

  if (history.lines.length) {
    parts.push(
      `### What this person actually acts on\n${history.lines.map((l) => `- ${l}`).join("\n")}`,
      history.profile.provisional
        ? "This is an early read — lean on it, but don't announce it as settled fact."
        : "This pattern is well established. Weight it heavily."
    );
  }

  if (history.landed.length) {
    parts.push(
      `### Recommendations they took\n${history.landed.map((c) => `- "${c}"`).join("\n")}\n` +
        "Match the shape of these — the length, the size of the ask, the tone."
    );
  }

  if (history.ignored.length) {
    parts.push(
      `### Recommendations they skipped\n${history.ignored.map((c) => `- "${c}"`).join("\n")}\n` +
        "Don't repeat these or anything close to them. Work out what they have in common and avoid it."
    );
  }

  if (parts.length === 0) {
    return (
      "### What this person actually acts on\n" +
      "Nothing yet — no recommendation has been answered. Offer something broadly easy, " +
      "and don't imply this was tailored to their history."
    );
  }

  return parts.join("\n\n");
}

export async function generateRecommendation(
  context: HabitContext,
  history: RecommendationHistory
): Promise<GeneratedRecommendation> {
  const system = [
    "You give one micro-action for right now inside Kinextion. One action, doable in two minutes or less.",
    "",
    "## What makes a good one",
    "- It starts with a verb and takes under two minutes.",
    "- It fits what is actually left in their day, not an idealised day.",
    "- It is specific. 'Go for a walk' is weak; 'Walk to the end of the road and back' is not.",
    "- Never repeat a recommendation they've already been given this week.",
    "",
    "## Honesty",
    "- The reason may only cite signals present below, and may quote their numbers.",
    "- Never invent a step count, a sleep figure, a calendar event or a trend.",
    "- If there's little to go on, give a good general action and say plainly that it's a general one.",
    "",
    SAFETY_BLOCK,
    "",
    "## Today",
    context.contextBlock.trim() || "Nothing tracked yet today.",
    "",
    "## What has worked for this person before",
    historySection(history),
  ].join("\n");

  try {
    const result = await generateStructured<{
      action?: string;
      why?: string;
      category?: string;
    }>({
      system,
      messages: [
        {
          role: "user",
          content: "What's the one thing I should do right now?",
        },
      ],
      toolName: "recommend",
      toolDescription: "Return one micro-action, the reason for it, and its category.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            maxLength: 120,
            description: "The action. Under 15 words, starting with a verb. No preamble.",
          },
          why: {
            type: "string",
            maxLength: 240,
            description:
              "One sentence on why this one and not something else, referring to the specifics above.",
          },
          category: { type: "string", enum: [...WELLNESS_CATEGORIES] },
        },
        required: ["action", "why", "category"],
      },
      maxTokens: 2048,
    });

    const action = result.action?.trim();
    const why = result.why?.trim();
    if (!action || !why) return FALLBACK;

    return {
      action,
      why,
      category: WELLNESS_CATEGORIES.includes(result.category as never)
        ? (result.category as string)
        : "mental",
    };
  } catch {
    // A failed model call shouldn't leave the home screen with a hole in it,
    // and the fallback says what it is rather than passing itself off as
    // personalised. The caller stores it like any other, so a dismissal of a
    // fallback is still honest feedback about a generic suggestion.
    return FALLBACK;
  }
}
