/**
 * Public surface of @kinextion/ai-core.
 *
 * Re-exports are explicit rather than `export *`. Turbopack fails to trace
 * multi-hop `export *` chains through a symlinked pnpm workspace package and
 * reports "Export X doesn't exist in target module" at build time, even though
 * tsc resolves the same code fine. Listing the names costs a line each and
 * removes that whole class of bundler-specific breakage.
 */

// ── Personas & guides ─────────────────────────────────────────────────────────
export {
  ALTHEO_SYSTEM_PROMPT,
  ALTHEO_GREETING,
  KAIRO_SYSTEM_PROMPT,
  KAIRO_GREETING,
  CRISIS_PROTOCOL,
  CRISIS_RESOURCES,
  MEDICAL_BOUNDARIES,
  SAFETY_BLOCK,
  GUIDES,
  GUIDE_IDS,
  DEFAULT_GUIDE,
  resolveGuideId,
  getSystemPrompt,
  getGreeting,
  buildSystemPrompt,
} from "./personas/index";

export type {
  GuideId,
  GuideMeta,
  ChatSurface,
  SystemPromptOptions,
} from "./personas/index";

// ── Context assembly ──────────────────────────────────────────────────────────
export { buildContext, COMMUNITY_VOICE_RULE } from "./context/index";
export type { UserContext, BuiltContext } from "./context/index";

// ── Community facilitation ────────────────────────────────────────────────────
export {
  FACILITATOR_SYSTEM_PROMPT,
  TOPIC_OPTIONS_SCHEMA,
  PROMPT_BANK,
  buildSynthesisMessage,
  parseGeneratedOptions,
  synthesizeTopics,
  rhythmGuidance,
  selectOptions,
} from "./facilitator/index";

export type {
  SynthesisInput,
  SynthesisResult,
  TopicGenerator,
  TopicGeneratorRequest,
  CandidateOption,
  RhythmGuidance,
  BankPrompt,
} from "./facilitator/index";

// ── Atomic Habits helpers ─────────────────────────────────────────────────────
export {
  createHabitFramework,
  getHabitPhase,
  getPhaseAdvice,
} from "./atomic-habits/index";

export type { HabitSuggestion } from "./atomic-habits/index";
