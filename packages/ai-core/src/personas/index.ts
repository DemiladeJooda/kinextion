export { ALTHEO_SYSTEM_PROMPT, ALTHEO_GREETING } from "./altheo";
export { KAIRO_SYSTEM_PROMPT, KAIRO_GREETING } from "./kairo";
export { CRISIS_PROTOCOL, MEDICAL_BOUNDARIES, SAFETY_BLOCK } from "./safety";
export {
  GUIDES,
  GUIDE_IDS,
  DEFAULT_GUIDE,
  resolveGuideId,
  type GuideId,
  type GuideMeta,
  type ChatSurface,
} from "./guides";

import { ALTHEO_SYSTEM_PROMPT, ALTHEO_GREETING } from "./altheo";
import { KAIRO_SYSTEM_PROMPT, KAIRO_GREETING } from "./kairo";
import { SAFETY_BLOCK } from "./safety";
import { GUIDES, type ChatSurface, type GuideId } from "./guides";

const PERSONA_PROMPTS: Record<GuideId, string> = {
  altheo: ALTHEO_SYSTEM_PROMPT,
  kairo: KAIRO_SYSTEM_PROMPT,
};

const GREETINGS: Record<GuideId, string> = {
  altheo: ALTHEO_GREETING,
  kairo: KAIRO_GREETING,
};

export function getSystemPrompt(guide: GuideId): string {
  return PERSONA_PROMPTS[guide];
}

export function getGreeting(guide: GuideId): string {
  return GREETINGS[guide];
}

/**
 * Format rules per surface.
 *
 * The marketing site is a first-impression demo: replies must be short enough
 * to read at a glance and must never render raw markdown, because the web chat
 * bubble prints plain text. The app has real data behind it and room to
 * breathe, so it gets the fuller coaching format.
 */
const SURFACE_RULES: Record<ChatSurface, string> = {
  web: `## Response Format (web — strict)
- 2–4 sentences. No exceptions. Dense and specific, never padded.
- Plain prose only. No markdown, no bullet points, no headers, no numbered lists — the chat renders raw text, so any markup shows up as literal characters.
- Sound like a wise friend who knows them, not a chatbot and not a health app.
- You do NOT have their live biometrics on this page. If asked about specific numbers (HRV, sleep score, readiness), say you'd see that in the full app and work with whatever they tell you now. Never invent a reading.
- When they share something hard, acknowledge it first. Always. Suggestions come second, if at all.`,

  app: `## Response Format (app)
- Conversational and warm. 2–3 short paragraphs for general chat; longer only for an explicit plan request.
- Light formatting is fine: bold for the key action, bullets for a workout or step list. Never more than one list per reply.
- End with a clear next action or an open question when it fits naturally.
- Ask for feedback regularly: "How did that feel?" "Want to adjust anything?"
- Ground every claim in the context you were given. If you don't have a number, don't invent one — ask.`,
};

export interface SystemPromptOptions {
  readonly guide: GuideId;
  readonly surface: ChatSurface;
  /** Signed-in user's first name, if known. */
  readonly userName?: string | null;
  /** Optional live context block (habits, mood, score) assembled by the caller. */
  readonly context?: string | null;
}

/**
 * Compose the full system prompt: persona → safety → identity → format.
 *
 * Order matters. Safety sits above the format rules so a crisis response is
 * never squeezed to fit a sentence budget, and the persona sits first so the
 * stable, cacheable bulk of the prompt comes before the volatile per-user
 * parts.
 */
export function buildSystemPrompt({
  guide,
  surface,
  userName,
  context,
}: SystemPromptOptions): string {
  const name = GUIDES[guide].name;

  const identity = userName
    ? `## Who You're Talking To\nTheir name is ${userName}. Use it naturally — not in every message, just where it lands.`
    : `## Who You're Talking To\nThey haven't signed in, so you don't know their name. Address them as "you". Never call them "user" or "friend", and never ask for their name unprompted.`;

  const opening = `You are ${name}. Stay in character for the entire conversation. If asked what model or company powers you, say you're ${name}, part of Kinextion, and move the conversation back to them.`;

  return [
    PERSONA_PROMPTS[guide],
    identity,
    context?.trim() ? `## Live Context\n${context.trim()}` : null,
    SAFETY_BLOCK,
    SURFACE_RULES[surface],
    opening,
  ]
    .filter(Boolean)
    .join("\n\n");
}
