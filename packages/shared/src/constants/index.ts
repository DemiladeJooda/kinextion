// ─── Wellness Categories ─────────────────────────────────────────

export const WELLNESS_CATEGORIES = [
  "physical",
  "mental",
  "emotional",
  "spiritual",
] as const;

export const WELLNESS_LABELS: Record<string, string> = {
  physical: "Body",
  mental: "Mind",
  emotional: "Heart",
  spiritual: "Spirit",
};

// ─── Kinextion Score ─────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  habitsCompletion: 40,
  workoutLogged: 20,
  moodCheckIn: 15,
  reflection: 15,
  streakBonus: 10,
} as const;

export const MAX_SCORE = 100;

// ─── AI ──────────────────────────────────────────────────────────

/**
 * Which model does what.
 *
 * Three tiers, chosen per task by how much understanding it needs:
 *
 *   deep      Claude Opus 5.5 — anything that has to understand the person:
 *             the guides' conversations, designing a habit, reading a miss,
 *             the daily recommendation.
 *   balanced  Claude Sonnet 5.5 — real judgement on a narrower job: a
 *             check-in question, the community's weekly topics, deciding
 *             what's worth remembering.
 *   light     Claude Haiku 5.5 — mechanical work: tidying wording,
 *             compressing old chat history.
 *
 * To move a task, change its `tier` here; nothing else needs to change.
 * `maxTokens` covers thinking and the reply together (thinking is on by
 * default on all three). `effort` trades depth for cost and speed.
 */
export const AI_MODELS = {
  deep: "claude-opus-5-5",
  balanced: "claude-sonnet-5-5",
  light: "claude-haiku-5-5",
} as const;

export type AITier = keyof typeof AI_MODELS;
export type AIEffort = "low" | "medium" | "high" | "xhigh" | "max";

export const AI_TASKS = {
  /** Altheo and Kairo in conversation. Streamed, so a large budget is safe. */
  chat: { tier: "deep", effort: "medium", maxTokens: 16000 },
  /** Proposing habits from what Kinextion knows. */
  habitSuggest: { tier: "deep", effort: "medium", maxTokens: 12000 },
  /** Working a habit out in conversation. */
  habitDiscover: { tier: "deep", effort: "medium", maxTokens: 12000 },
  /** "What would it take?" — reflect back, propose one change. */
  coach: { tier: "deep", effort: "medium", maxTokens: 8000 },
  /** The daily two-option micro-recommendation. */
  recommendation: { tier: "deep", effort: "medium", maxTokens: 8000 },
  /** One question to start the journal. */
  checkinPrompt: { tier: "balanced", effort: "low", maxTokens: 4000 },
  /** The community's weekly topic and summaries. */
  community: { tier: "balanced", effort: "medium", maxTokens: 8000 },
  /** Deciding which facts from a chat are worth remembering. */
  memoryExtract: { tier: "balanced", effort: "low", maxTokens: 4000 },
  /** Rewording a habit's text for display. Balanced, not light: the why is
   *  shown back every day, and Haiku 5.5 kept inventing reasons the user
   *  never gave (tested 23 Oct 2026). Runs once per habit edit, so it's cheap. */
  polish: { tier: "balanced", effort: "low", maxTokens: 2000 },
  /** Folding old chat turns into a summary. */
  memorySummary: { tier: "light", effort: "low", maxTokens: 4000 },
} as const satisfies Record<string, { tier: AITier; effort: AIEffort; maxTokens: number }>;

export type AITask = keyof typeof AI_TASKS;

/** The model, effort and budget for a task. */
export function aiTask(task: AITask): { model: string; effort: AIEffort; maxTokens: number; tier: AITier } {
  const t = AI_TASKS[task];
  return { model: AI_MODELS[t.tier], effort: t.effort, maxTokens: t.maxTokens, tier: t.tier };
}

/** The guides' names and titles. Their model comes from `AI_TASKS.chat`. */
export const AI_CONFIG = {
  altheo: {
    name: "Altheo",
    title: "The Coach",
    description: "Your adaptive training companion",
    model: AI_MODELS[AI_TASKS.chat.tier],
    maxTokens: AI_TASKS.chat.maxTokens,
  },
  kairo: {
    name: "Kairo",
    title: "The Listener",
    description: "Your guide for reflection and clarity",
    model: AI_MODELS[AI_TASKS.chat.tier],
    maxTokens: AI_TASKS.chat.maxTokens,
  },
} as const;

/** @deprecated Use `aiTask(...)`. Kept for older imports. */
export const ASSIST_AI_CONFIG = {
  model: AI_MODELS.deep,
  maxTokens: 8000,
} as const;

/** @deprecated Use `aiTask("memoryExtract")` / `aiTask("memorySummary")`. */
export const MEMORY_AI_CONFIG = {
  model: AI_MODELS[AI_TASKS.memoryExtract.tier],
  maxTokens: AI_TASKS.memoryExtract.maxTokens,
  effort: AI_TASKS.memoryExtract.effort,
} as const;

// ─── Onboarding ──────────────────────────────────────────────────

export const GOAL_OPTIONS = [
  "Build consistency",
  "Get stronger",
  "Lose weight",
  "Improve mental clarity",
  "Reduce stress",
  "Better sleep",
  "Build confidence",
  "Stay active",
] as const;

// ─── Daily check-in ──────────────────────────────────────────────

/**
 * The tag vocabulary offered at check-in.
 *
 * Fixed rather than free-text on purpose: a closed set is what makes tags
 * countable later — "anxious" and "anxiety" would otherwise never aggregate
 * into the same trend, and the therapist report's tag summary would be noise.
 * Paired opposites keep the list honest about good days as well as bad ones.
 */
export const CHECKIN_TAGS = [
  "calm",
  "anxious",
  "energised",
  "drained",
  "focused",
  "scattered",
  "motivated",
  "flat",
  "grateful",
  "frustrated",
  "connected",
  "lonely",
  "rested",
  "restless",
  "proud",
  "overwhelmed",
] as const;

export type CheckInTag = (typeof CHECKIN_TAGS)[number];

/** Cap on how many of the above one entry can carry — mirrors the schema. */
export const MAX_CHECKIN_TAGS = 10;

// ─── Habits ──────────────────────────────────────────────────────

/**
 * What each wellness dimension means in habit terms. Shown in the builder so
 * "spiritual" doesn't have to mean religion unless the user wants it to, and
 * fed to the model so proposals land in the right category.
 */
export const HABIT_CATEGORY_HINTS: Record<string, string> = {
  physical: "Movement, food, sleep, recovery — anything your body does.",
  mental: "Focus, learning, screen time — how you spend your attention.",
  emotional: "Mood, relationships, reflection — how you process a day.",
  spiritual: "Meaning, stillness, values — whatever grounds you, religious or not.",
};

/**
 * The spiritual dial, worded to match what Kairo's system prompt actually
 * does with each setting. Universal is first because it's the documented
 * default — the guide assumes it unless the user says otherwise.
 */
export const SPIRITUAL_DIAL_OPTIONS = [
  {
    value: "universal",
    label: "Universal",
    description: "Gratitude, presence, purpose, kindness. No religious content.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Faith-based wisdom alongside universal principles.",
  },
  {
    value: "scripture",
    label: "Scripture",
    description: "Scripture, prayer prompts and devotional reflection.",
  },
] as const;

/** How hard Altheo and Kairo push. Worded for what the prompt context
 * actually does with each setting — see context-builder's formatProfileContext. */
export const COACHING_INTENSITY_OPTIONS = [
  {
    value: "gentle",
    label: "Gentle",
    description: "Small asks, generous encouragement. Never implies you're behind.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Challenges you when you're ready, eases off when you're not.",
  },
  {
    value: "intense",
    label: "Intense",
    description: "Pushes harder. Expects more, and says so.",
  },
] as const;

/** The window the displayed Kinextion Score aggregates and resets on. */
export const SCORE_PERIOD_OPTIONS = [
  {
    value: "weekly",
    label: "Weekly",
    description: "Averages this week's daily scores. Resets every Monday.",
  },
  {
    value: "monthly",
    label: "Monthly",
    description: "Averages this month's daily scores. Resets on the 1st.",
  },
  {
    value: "yearly",
    label: "Yearly",
    description: "Averages the year's daily scores so far. Resets every January.",
  },
] as const;

// ─── Wearable metrics ────────────────────────────────────────────

/**
 * Every metric type the provider adapters can produce, and how to read it.
 *
 * `higherIsBetter` is null where the honest answer is "it depends" — a resting
 * heart rate of 48 is excellent for one person and a reason to see a doctor
 * for another, and the app has no business colouring it green or red.
 */
export const METRIC_META: Record<
  string,
  { label: string; unit: string; higherIsBetter: boolean | null; group: "body" | "calendar" }
> = {
  steps: { label: "Steps", unit: "", higherIsBetter: true, group: "body" },
  sleep_duration: { label: "Sleep", unit: "min", higherIsBetter: true, group: "body" },
  sleep_score: { label: "Sleep score", unit: "", higherIsBetter: true, group: "body" },
  hrv: { label: "HRV", unit: "ms", higherIsBetter: true, group: "body" },
  resting_heart_rate: {
    label: "Resting heart rate",
    unit: "bpm",
    higherIsBetter: null,
    group: "body",
  },
  active_calories: { label: "Active calories", unit: "kcal", higherIsBetter: true, group: "body" },
  workout: { label: "Workout time", unit: "min", higherIsBetter: true, group: "body" },
  listening_minutes: { label: "Music listened", unit: "min", higherIsBetter: null, group: "body" },
  calendar_busy_minutes: {
    label: "Time booked",
    unit: "min",
    higherIsBetter: null,
    group: "calendar",
  },
  calendar_first_busy_minute: {
    label: "Day starts",
    unit: "clock",
    higherIsBetter: null,
    group: "calendar",
  },
  calendar_last_busy_minute: {
    label: "Day ends",
    unit: "clock",
    higherIsBetter: null,
    group: "calendar",
  },
  calendar_longest_free_minutes: {
    label: "Longest free block",
    unit: "min",
    higherIsBetter: true,
    group: "calendar",
  },
  calendar_free_block_start_minute: {
    label: "Free block starts",
    unit: "clock",
    higherIsBetter: null,
    group: "calendar",
  },
};

export const EQUIPMENT_OPTIONS = [
  "No equipment (bodyweight)",
  "Dumbbells",
  "Resistance bands",
  "Gym membership",
  "Pull-up bar",
  "Yoga mat",
  "Kettlebell",
] as const;
