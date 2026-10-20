/**
 * Turning conversation into memory.
 *
 * A day of talking to a guide becomes a handful of one-line facts and a
 * paragraph of summary — not a stored transcript. This is where the storage
 * budget is actually spent, so both calls here are deliberately small:
 * structured output, low effort, tight token caps.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MEMORY_AI_CONFIG, type MemoryTier } from "@kinextion/shared";

const anthropic = new Anthropic();

export interface ExtractedFact {
  tier: Extract<MemoryTier, "core" | "pattern">;
  category: "constraint" | "identity" | "goal" | "preference" | "context";
  /** Normalised dedup key, e.g. "constraint:left_knee". */
  key: string;
  content: string;
  confidence: number;
}

/**
 * The schema is the contract — structured outputs guarantee the response
 * parses, so there's no salvage path for malformed JSON to maintain.
 */
const FACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tier: { type: "string", enum: ["core", "pattern"] },
          category: {
            type: "string",
            enum: ["constraint", "identity", "goal", "preference", "context"],
          },
          key: { type: "string" },
          content: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["tier", "category", "key", "content", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["facts"],
  additionalProperties: false,
} as const;

const EXTRACTION_PROMPT = `You maintain long-term memory for a wellness app. You are reading a conversation between a user and their guide, and writing down only what will still matter in six months.

Return facts under two tiers:

- "core" — constraints and identity that change what is safe or true for this person: injuries, diagnoses, medications, hard scheduling limits, things they've told you not to suggest. These are never forgotten, so the bar is high.
- "pattern" — durable goals, preferences, and life context: what they're working toward, how they like to be spoken to, recurring circumstances.

Rules:
- One fact per line, written to be read back into a prompt later. Third person, present tense: "Recovering from a left ACL tear; no jumping or pivoting."
- A "key" is a stable slug for deduplication, "category:subject" — "constraint:left_acl", "goal:half_marathon", "preference:no_calorie_talk". The same fact mentioned again next month must produce the same key.
- Set confidence honestly: 0.9+ when the user stated it plainly, 0.5-0.7 when you are reading between the lines.
- Extract nothing from small talk. An empty array is the correct answer for most conversations, and a wrong fact stored forever is far worse than a missed one.
- Never record a passing mood, a one-off event, or anything already implied by the app's own tracked data (habit streaks, mood scores, workout logs).`;

export async function extractFacts(
  transcript: string,
  signal?: AbortSignal
): Promise<ExtractedFact[]> {
  if (!transcript.trim()) return [];

  const response = await anthropic.messages.create(
    {
      model: MEMORY_AI_CONFIG.model,
      max_tokens: MEMORY_AI_CONFIG.maxTokens,
      system: EXTRACTION_PROMPT,
      output_config: {
        effort: MEMORY_AI_CONFIG.effort,
        format: { type: "json_schema", schema: FACT_SCHEMA },
      },
      messages: [{ role: "user", content: transcript }],
    },
    { signal }
  );

  // Safety classifiers can decline; there is nothing to parse if they do.
  if (response.stop_reason === "refusal") return [];

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];

  const parsed = JSON.parse(text.text) as { facts?: ExtractedFact[] };
  return (parsed.facts ?? []).filter(
    (f) => f.key.trim().length > 0 && f.content.trim().length > 0
  );
}

const SUMMARY_PROMPT = `You compress conversation history for a wellness app so older turns can be deleted.

Rewrite what you are given as a single dense paragraph that lets the guide carry on as if it still had the full history. Preserve: what the user is working on, decisions and commitments made, what has been tried, and the emotional through-line. Drop: pleasantries, repetition, and anything the app tracks separately.

Write in third person about the user. If you are given an existing summary followed by newer turns, fold them into one continuous paragraph rather than appending — the result is read as a whole, not as a log.`;

/**
 * Fold overflow turns into the running summary.
 *
 * The previous summary is passed back in so compaction is idempotent over
 * time: what returns is always one paragraph, never a growing chain of them.
 */
export async function summarizeConversation(
  previousSummary: string | null,
  overflowTurns: string,
  signal?: AbortSignal
): Promise<string> {
  const input = previousSummary
    ? `Existing summary:\n${previousSummary}\n\nNewer turns to fold in:\n${overflowTurns}`
    : overflowTurns;

  const response = await anthropic.messages.create(
    {
      model: MEMORY_AI_CONFIG.model,
      max_tokens: MEMORY_AI_CONFIG.maxTokens,
      system: SUMMARY_PROMPT,
      output_config: { effort: MEMORY_AI_CONFIG.effort },
      messages: [{ role: "user", content: input }],
    },
    { signal }
  );

  if (response.stop_reason === "refusal") return previousSummary ?? "";

  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : previousSummary ?? "";
}
