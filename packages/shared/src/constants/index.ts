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
 * Model choices.
 *
 * `maxTokens` bounds thinking *and* reply together on current models, where
 * adaptive thinking is on by default — the old 1024 was sized for a
 * reply-only budget and would truncate mid-sentence.
 */
export const AI_CONFIG = {
  altheo: {
    name: "Altheo",
    title: "The Coach",
    description: "Your adaptive training companion",
    model: "claude-opus-5",
    maxTokens: 8192,
  },
  kairo: {
    name: "Kairo",
    title: "The Listener",
    description: "Your guide for reflection and clarity",
    model: "claude-opus-5",
    maxTokens: 8192,
  },
} as const;

/**
 * Structured, user-facing generation: habit proposals, conversational habit
 * discovery, check-in prompts. Separate from the guides because the output is
 * a typed object rather than a conversation, and separate from the memory
 * jobs because a user is waiting on it.
 */
export const ASSIST_AI_CONFIG = {
  model: "claude-opus-5",
  /** Bounds thinking and the structured reply together. A few drafts with
   *  rationales fits comfortably; this leaves room to reason first. */
  maxTokens: 4096,
} as const;

/**
 * Background jobs that compress stored data — summarisation and fact
 * extraction. Separated from the guides so the cost dial for maintenance
 * work can move without touching the conversation experience.
 */
export const MEMORY_AI_CONFIG = {
  model: "claude-opus-5",
  /** Extraction returns a short JSON array; it never needs a long reply. */
  maxTokens: 2048,
  /** Compression is mechanical — the cheapest setting that does it well. */
  effort: "low",
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
