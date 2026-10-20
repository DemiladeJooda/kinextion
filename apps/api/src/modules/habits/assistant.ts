/**
 * The habit assistant.
 *
 * Two ways into a habit that aren't "type a name into a box":
 *
 *   suggestHabits — reads what Kinextion already tracks and proposes a few
 *     habits, each carrying the reason it was proposed.
 *   discoverHabits — a short spoken/typed conversation that asks about the
 *     user's actual days and turns the answers into drafts.
 *
 * Both return *drafts*. Nothing here writes to the database; a draft becomes a
 * habit only when the user accepts it and the app POSTs it like any other.
 * That separation is what makes it safe to let a model propose freely.
 */

import { SAFETY_BLOCK } from "@kinextion/ai-core";
import { habitDraftSchema, type HabitDraft, type SuggestHabitsInput } from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";
import type { HabitContext } from "../../lib/habit-context.js";

/** JSON Schema mirroring habitDraftSchema — the tool's output contract. */
const HABIT_DRAFT_PROPERTIES = {
  name: {
    type: "string",
    maxLength: 100,
    description: "The habit, phrased as something you do. Under 8 words.",
  },
  category: {
    type: "string",
    enum: ["physical", "mental", "emotional", "spiritual"],
  },
  cue: {
    type: "string",
    maxLength: 200,
    description:
      "The existing moment this attaches to, e.g. 'After I put the kettle on'. Use a real anchor from the context — a calendar time, an existing habit, a part of their day they actually described.",
  },
  craving: {
    type: "string",
    maxLength: 200,
    description: "Why they'd want it, in their own terms rather than health-speak.",
  },
  response: {
    type: "string",
    maxLength: 200,
    description: "The two-minute version. Small enough to be embarrassing to skip.",
  },
  reward: {
    type: "string",
    maxLength: 200,
    description: "The immediate payoff, felt the same day.",
  },
  frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
  targetDays: {
    type: "array",
    items: { type: "integer", minimum: 0, maximum: 6 },
    description: "Only for 'custom'. 0 = Sunday.",
  },
  rationale: {
    type: "string",
    maxLength: 300,
    description:
      "One sentence naming the specific signal this came from, quoting the number where there is one. If no signal supports it, say it's a starting point rather than inventing evidence.",
  },
} as const;

const DRAFT_REQUIRED = ["name", "category", "frequency", "rationale"];

/**
 * Shared rules for both entry points.
 *
 * The honesty clause is the load-bearing one: the whole feature is worth
 * nothing if the reason attached to a suggestion is invented. A user who
 * catches one fabricated "because your sleep dropped" stops believing all of
 * them, including the true ones.
 */
function assistantSystemPrompt(context: HabitContext, extra: string): string {
  const hasContext = context.contextBlock.trim().length > 0;

  return [
    "You help someone design habits inside Kinextion, using the Atomic Habits loop: cue, craving, response, reward.",
    "",
    "## How to think about a habit",
    "- The response is the two-minute version. If it can't be done on the worst day of the month, it's too big.",
    "- The cue must be an anchor that already exists in their day. Never invent a routine they haven't mentioned.",
    "- Prefer fixing or shrinking a habit that's slipping over adding a new one.",
    "- Four or five active habits is plenty. If they already have that many, say so.",
    "",
    "## Honesty (this matters more than being helpful)",
    "- Only cite a signal that appears in the context below. Never invent a number, a trend, a step count, or a calendar event.",
    "- If the context is thin, say the suggestion is a starting point rather than dressing it up as personalised.",
    "- Never claim to know something you were not told.",
    "",
    SAFETY_BLOCK,
    "",
    extra,
    "",
    hasContext
      ? `## What Kinextion knows about this user\n\n${context.contextBlock}`
      : "## What Kinextion knows about this user\n\nNothing yet — this is a new account with no habits, check-ins or connected data. Say so plainly and propose gentle, broadly-useful starting points.",
  ].join("\n");
}

/** Drop anything the model returned that doesn't satisfy the real schema. */
function validateDrafts(raw: unknown[]): HabitDraft[] {
  const out: HabitDraft[] = [];
  for (const candidate of raw) {
    const parsed = habitDraftSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function suggestHabits(
  context: HabitContext,
  input: SuggestHabitsInput
): Promise<HabitDraft[]> {
  const focusLine = input.focus
    ? `Every suggestion must be in the "${input.focus}" category.`
    : "Spread the suggestions across different categories unless the context points hard at one.";

  const system = assistantSystemPrompt(
    context,
    [
      "## This request",
      `Propose ${input.count} habit${input.count === 1 ? "" : "s"}.`,
      focusLine,
      "Order them by how likely this person is to actually keep them.",
    ].join("\n")
  );

  const result = await generateStructured<{ drafts: unknown[] }>({
    system,
    messages: [
      {
        role: "user",
        content:
          "Suggest habits for me based on what you know. Ground each one in something real from my data.",
      },
    ],
    toolName: "propose_habits",
    toolDescription: "Return the proposed habits, each with the reason it was chosen.",
    inputSchema: {
      type: "object",
      properties: {
        drafts: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            properties: HABIT_DRAFT_PROPERTIES,
            required: DRAFT_REQUIRED,
          },
        },
      },
      required: ["drafts"],
    },
  });

  return validateDrafts(result.drafts ?? []).slice(0, input.count);
}

export interface DiscoveryResult {
  /** What to say back — one short question, or a wrap-up once there are drafts. */
  reply: string;
  /** Habits ready for the user to accept. Empty while still asking. */
  drafts: HabitDraft[];
  /** True once the assistant has nothing left to ask. */
  complete: boolean;
}

/**
 * Drop any assistant turns before the first user turn.
 *
 * The app opens the conversation with a locally-rendered question so the
 * screen isn't blank while nothing has been said yet, and it sends the whole
 * visible transcript back. That makes the first payload start with an
 * assistant message, which the Messages API rejects outright — the first
 * message must be from the user, and roles must alternate after that. Trimming
 * here rather than in the client means any future caller gets it right too.
 */
function toApiTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  const firstUser = turns.findIndex((t) => t.role === "user");
  return firstUser === -1 ? [] : turns.slice(firstUser);
}

export async function discoverHabits(
  context: HabitContext,
  turns: Array<{ role: "user" | "assistant"; content: string }>
): Promise<DiscoveryResult> {
  const messages = toApiTurns(turns);

  // Nothing from the user yet — answer locally rather than paying for a call
  // that would only be rejected.
  if (messages.length === 0) {
    return {
      reply: "Tell me how a normal day goes for you — when you're up, and where it falls apart.",
      drafts: [],
      complete: false,
    };
  }

  const system = assistantSystemPrompt(
    context,
    [
      "## This request",
      "You are mid-conversation with the user about building a habit. They may be speaking rather than typing, so expect rambling, false starts and filler — read through it for the actual routine underneath.",
      "",
      "Rules for the conversation:",
      "- Ask ONE question at a time, in two sentences at most. Never a list of questions.",
      "- Ask about the shape of their real day — when they wake, what's already fixed, where the dead time is — not about goals in the abstract.",
      "- After two or three exchanges you should have enough. Don't interrogate.",
      "- When you have enough, return the drafts, set complete to true, and let the reply be a short handover like 'Here's what I'd start with.'",
      "- While you're still asking, return an empty drafts array.",
      "- Plain sentences. No markdown, no bullet points, no bold.",
    ].join("\n")
  );

  const result = await generateStructured<{
    reply: string;
    drafts?: unknown[];
    complete?: boolean;
  }>({
    system,
    messages,
    toolName: "respond",
    toolDescription:
      "Reply to the user, and include habit drafts once the conversation has produced enough to propose them.",
    inputSchema: {
      type: "object",
      properties: {
        reply: {
          type: "string",
          maxLength: 600,
          description: "What to say next. One question, or a short handover once drafts are ready.",
        },
        complete: {
          type: "boolean",
          description: "True when you have proposed drafts and have nothing left to ask.",
        },
        drafts: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: HABIT_DRAFT_PROPERTIES,
            required: DRAFT_REQUIRED,
          },
        },
      },
      required: ["reply"],
    },
  });

  const drafts = validateDrafts(result.drafts ?? []);

  return {
    reply: result.reply?.trim() || "Tell me a bit more about how your day usually goes.",
    drafts,
    // A "complete" with nothing to show would leave the user at a dead end.
    complete: Boolean(result.complete) && drafts.length > 0,
  };
}
