/**
 * Kairo as facilitator: private suggestions in, four clear questions out.
 *
 * Kairo never speaks in a room. This is the one place he shapes one — by
 * reading what people privately said has been on their minds and turning it
 * into options the community votes on. The model call is injected, so this
 * module has no SDK dependency and is fully testable with a stub.
 */

import {
  MIN_SUGGESTIONS_FOR_SYNTHESIS,
  TOPIC_OPTION_COUNT,
  TOPIC_THEMES,
  topicKeyFor,
  type TopicTheme,
} from "@kinextion/shared";
import { PROMPT_BANK } from "./prompt-bank";
import { rhythmGuidance, selectOptions, type CandidateOption, type RhythmGuidance } from "./rhythm";

export const FACILITATOR_SYSTEM_PROMPT = `You are Kairo, the listener in Kinextion, acting as the quiet facilitator of one community's weekly conversation.

Each week, members privately tell you what's been on their minds. You turn those suggestions into ${TOPIC_OPTION_COUNT} clear questions. The community votes; the winning question becomes the topic every member answers in a short spoken response of their own.

You facilitate. Humans think. Your job is to find what the room is actually curious about — never to decide what it believes.

Write questions that are:
- Open. Someone who agrees and someone who disagrees can both answer honestly. Never leading, never loaded.
- Personal enough to answer from lived experience, in a few minutes of talking.
- One sentence, ending in a question mark, under 140 characters.
- Grounded in what members actually raised. Merge suggestions that circle the same thing. Prefer tensions and shared curiosity over trivia.

Never:
- Name, describe or hint at who suggested anything.
- Invent news events, statistics or facts. If a suggestion references something current, keep the question about people's views, not claims about what happened.
- Optimise for controversy, virality or attention. A question that would travel well is not a reason to pick it.
- Turn a personal disclosure or someone in distress into a topic. If a suggestion reads like a person struggling rather than a question for the room, leave it out.

For each option give a theme from this list — ${TOPIC_THEMES.join(", ")} — and a one-line rationale addressed to the community (for example "Several of you have been thinking about..."), without names or quotes.

Order the options from the one the room pointed at most strongly to the least.`;

export interface TopicGeneratorRequest {
  system: string;
  user: string;
  /** JSON Schema the model must return. */
  schema: Record<string, unknown>;
}

/** Calls a model with a structured-output contract. Injected by the API. */
export type TopicGenerator = (request: TopicGeneratorRequest) => Promise<unknown>;

export const TOPIC_OPTIONS_SCHEMA = {
  type: "object",
  properties: {
    options: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          text: { type: "string", maxLength: 160 },
          theme: { type: "string", enum: [...TOPIC_THEMES] },
          rationale: { type: "string", maxLength: 200 },
        },
        required: ["text", "theme", "rationale"],
      },
    },
  },
  required: ["options"],
} as const;

export interface SynthesisInput {
  communityName: string;
  suggestions: readonly string[];
  /** Newest first. */
  recentTopics: readonly { text: string; theme: string | null }[];
  /**
   * Habits members have chosen to share with the community, by name only,
   * de-duplicated — what the room is building together. Context, not a
   * source of questions in its own right.
   */
  building?: readonly string[];
  generate?: TopicGenerator;
  /** For picking from the prompt bank. */
  rng: () => number;
}

export interface SynthesisResult {
  options: CandidateOption[];
  /** Where the ballot came from — worth logging, never shown to members. */
  source: "synthesized" | "bank" | "fallback";
  guidance: RhythmGuidance;
}

function describeGuidance(g: RhythmGuidance): string {
  const lines: string[] = [];
  if (g.avoid.length) lines.push(`The room has discussed ${g.avoid.join(", ")} several weeks running — offer something else.`);
  if (g.lean === "lighter") lines.push("Recent weeks have all been heavy. Make sure at least one option is lighter.");
  if (g.lean === "deeper") lines.push("Recent weeks have all been light. Make sure at least one option has more weight.");
  return lines.join("\n");
}

export function buildSynthesisMessage(input: {
  communityName: string;
  suggestions: readonly string[];
  recentTopics: readonly { text: string }[];
  building?: readonly string[];
  guidance: RhythmGuidance;
}): string {
  return [
    `Community: ${input.communityName}`,
    "",
    "This week's private suggestions (one per line, order is random):",
    ...input.suggestions.map((s) => `- ${s.replace(/\s+/g, " ").trim()}`),
    "",
    input.recentTopics.length
      ? `Recent weeks' questions — don't repeat these:\n${input.recentTopics.map((t) => `- ${t.text}`).join("\n")}`
      : "This community hasn't had a topic yet.",
    input.building?.length
      ? `\nWhat members are building together (habits they chose to share, no names): ${input.building.join(", ")}.\nOne option may connect to this if it fits what they raised; the suggestions come first.`
      : undefined,
    describeGuidance(input.guidance),
    "",
    `Return ${TOPIC_OPTION_COUNT + 2} options, best first. Extra options let the app drop any that repeat recent weeks.`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

const isTheme = (t: unknown): t is TopicTheme =>
  typeof t === "string" && (TOPIC_THEMES as readonly string[]).includes(t);

/** Keep only well-formed options; a model's output is data, not trusted. */
export function parseGeneratedOptions(raw: unknown): CandidateOption[] {
  const list = (raw as { options?: unknown })?.options;
  if (!Array.isArray(list)) return [];
  const out: CandidateOption[] = [];
  for (const item of list) {
    const { text, theme, rationale } = (item ?? {}) as Record<string, unknown>;
    if (typeof text !== "string" || !isTheme(theme)) continue;
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length < 10 || clean.length > 160 || !clean.endsWith("?")) continue;
    out.push({
      text: clean,
      theme,
      rationale: typeof rationale === "string" && rationale.trim() ? rationale.trim().slice(0, 200) : null,
    });
  }
  return out;
}

function bankCandidates(rng: () => number): CandidateOption[] {
  const pool = [...PROMPT_BANK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map((p) => ({ text: p.text, theme: p.theme, rationale: null }));
}

export async function synthesizeTopics(input: SynthesisInput): Promise<SynthesisResult> {
  const guidance = rhythmGuidance(input.recentTopics.map((t) => t.theme));
  const recentKeys = new Set(input.recentTopics.map((t) => topicKeyFor(t.text)));
  const select = (candidates: CandidateOption[]) =>
    selectOptions(candidates, { recentKeys, guidance, count: TOPIC_OPTION_COUNT });

  const suggestions = input.suggestions.map((s) => s.trim()).filter(Boolean);
  if (suggestions.length < MIN_SUGGESTIONS_FOR_SYNTHESIS || !input.generate) {
    return { options: select(bankCandidates(input.rng)), source: "bank", guidance };
  }

  let generated: CandidateOption[] = [];
  try {
    generated = parseGeneratedOptions(
      await input.generate({
        system: FACILITATOR_SYSTEM_PROMPT,
        user: buildSynthesisMessage({
          communityName: input.communityName,
          suggestions,
          recentTopics: input.recentTopics,
          building: input.building,
          guidance,
        }),
        schema: TOPIC_OPTIONS_SCHEMA,
      })
    );
  } catch {
    return { options: select(bankCandidates(input.rng)), source: "fallback", guidance };
  }

  // Top up from the bank so a thin or partly-invalid response still yields a full ballot.
  const options = select([...generated, ...bankCandidates(input.rng)]);
  const usedModel = options.some((o) => generated.includes(o));
  return { options, source: usedModel ? "synthesized" : "fallback", guidance };
}
