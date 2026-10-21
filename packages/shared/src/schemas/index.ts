import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────

export const wellnessCategorySchema = z.enum([
  "physical",
  "mental",
  "emotional",
  "spiritual",
]);

export const fitnessLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const personaSchema = z.enum(["altheo", "kairo"]);

export const habitFrequencySchema = z.enum(["daily", "weekly", "custom"]);

/** A part of the day rather than a minute — flexible timing keeps habits
 *  going better than a rigid slot (Beshears et al. 2021). */
export const habitTimeWindowSchema = z.enum(["morning", "midday", "evening", "anytime"]);

/** Building = in progress; established = graduated; paused = on hold, no misses. */
export const habitStatusSchema = z.enum(["building", "established", "paused"]);

/** What a log says about the day. Done and minimum count; rest is neutral. */
export const habitLogStateSchema = z.enum(["done", "minimum", "rest"]);

export const habitLogSourceSchema = z.enum(["tap", "notification", "backfill", "integration"]);

/** "someone who moves every day" — the identity a user's habits attach to. */
export const identityGoalSchema = z.string().trim().min(3).max(120);

export const workoutTypeSchema = z.enum([
  "strength",
  "cardio",
  "mobility",
  "mixed",
]);

export const workoutDifficultySchema = z.enum([
  "too_easy",
  "just_right",
  "too_hard",
]);

// ─── Onboarding ──────────────────────────────────────────────────

export const onboardingSchema = z.object({
  displayName: z.string().min(1).max(50),
  age: z.number().int().min(13).max(120).optional(),
  fitnessLevel: fitnessLevelSchema,
  primaryGoals: z.array(z.string()).min(1).max(5),
  weeklyAvailability: z.number().int().min(1).max(7),
  equipment: z.array(z.string()).optional(),
  identityGoal: identityGoalSchema.optional(),
  /** Supplementary lifestyle context, volunteered once at onboarding. */
  preferences: z
    .object({
      doesTherapy: z.boolean().optional(),
      doesJournal: z.boolean().optional(),
      currentlyWorkingOut: z.boolean().optional(),
    })
    .optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ─── Profile & preferences ───────────────────────────────────────

export const spiritualDialSchema = z.enum(["scripture", "balanced", "universal"]);
export const coachingIntensitySchema = z.enum(["gentle", "balanced", "intense"]);
export const scorePeriodSchema = z.enum(["weekly", "monthly", "yearly"]);

export const userPreferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  /** "HH:MM", 24-hour, in the user's own local time. */
  dailyCheckInTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must look like 08:30")
    .optional(),
  /**
   * How much faith content Kairo uses. Kairo's prompt has always described
   * this as user-controlled; this is the control.
   */
  aiPersonalityDial: spiritualDialSchema.optional(),
  /** How hard both guides push. */
  coachingIntensity: coachingIntensitySchema.optional(),
  /** Per-habit reminders at each habit's part of the day, plus the evening
   *  last call. On by default once notifications are allowed. */
  habitReminders: z.boolean().optional(),
  /** The window the displayed Kinextion Score aggregates and resets on. */
  scorePeriod: scorePeriodSchema.optional(),
  doesTherapy: z.boolean().optional(),
  doesJournal: z.boolean().optional(),
  currentlyWorkingOut: z.boolean().optional(),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;

/**
 * Editing a profile after onboarding.
 *
 * Separate from onboardingSchema rather than a `.partial()` of it, because the
 * two mean different things: onboarding sets a floor of required answers, and
 * this changes one thing at a time without resending the rest. `age` is
 * nullable here — someone who gave it once is allowed to take it back.
 */
export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(50).optional(),
    /** Ready Player Me avatar id, or null to clear it. */
    avatarId: z.string().max(100).nullish(),
    age: z.number().int().min(13).max(120).nullish(),
    fitnessLevel: fitnessLevelSchema.optional(),
    primaryGoals: z.array(z.string().max(60)).min(1).max(5).optional(),
    weeklyAvailability: z.number().int().min(1).max(7).optional(),
    equipment: z.array(z.string().max(60)).max(12).optional(),
    /** Null clears it. */
    identityGoal: identityGoalSchema.nullish(),
    preferences: userPreferencesSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Chat ────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  persona: personaSchema,
  content: z.string().min(1).max(5000),
  /**
   * Set when the user opened this chat from their community's weekly question,
   * so the guide knows what they're working on. Membership is checked
   * server-side; an id alone reveals nothing.
   */
  topicId: z.string().min(1).max(64).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ─── Habits ──────────────────────────────────────────────────────

/**
 * A habit. The four loop fields keep their database names; in the product
 * they are: cue = the anchor ("After I…"), craving = why it matters,
 * response = the tiny version, reward = today's payoff.
 */
export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  category: wellnessCategorySchema,
  cue: z.string().max(200).optional(),
  craving: z.string().max(200).optional(),
  response: z.string().max(200).optional(),
  reward: z.string().max(200).optional(),
  frequency: habitFrequencySchema,
  targetDays: z.array(z.number().int().min(0).max(6)).optional(),
  fullVersion: z.string().max(200).optional(),
  backupPlan: z.string().max(300).optional(),
  pairWith: z.string().max(200).optional(),
  timeWindow: habitTimeWindowSchema.optional(),
  /** Only meaningful with frequency "weekly": times per week, 1–7. */
  perWeekTarget: z.number().int().min(1).max(7).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  reminderEnabled: z.boolean().optional(),
  /** First day it's due, when that's later than today ("start Monday"). */
  startsOn: z.string().date().optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

/**
 * Editing a habit. Every field optional — a rename shouldn't require
 * resending the whole habit loop. `isActive: false` archives it,
 * which is deliberately not a delete: the logs stay, so streaks and history
 * survive a habit the user has finished with.
 */
export const updateHabitSchema = createHabitSchema
  .partial()
  .extend({ isActive: z.boolean().optional(), status: habitStatusSchema.optional() })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to update",
  });

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

/**
 * Logging a day. `completed` stays required so older app builds keep
 * working; newer ones also send `state`. A rest day is always stored as
 * not completed, whatever `completed` says, so it can never inflate a score.
 */
export const logHabitSchema = z.object({
  habitId: z.string().cuid(),
  date: z.string().date(),
  completed: z.boolean(),
  state: habitLogStateSchema.optional(),
  value: z.number().min(0).max(100_000).optional(),
  source: habitLogSourceSchema.optional(),
  notes: z.string().max(500).optional(),
});

export type LogHabitInput = z.infer<typeof logHabitSchema>;

// ─── Habit assistance (AI-proposed drafts) ───────────────────────
// A draft is a *proposal*, never a saved habit. Nothing reaches the database
// until the user accepts it, so the model can suggest freely and the user
// still owns every row.

export const habitDraftSchema = z.object({
  name: z.string().min(1).max(100),
  category: wellnessCategorySchema,
  cue: z.string().max(200).optional(),
  craving: z.string().max(200).optional(),
  response: z.string().max(200).optional(),
  reward: z.string().max(200).optional(),
  frequency: habitFrequencySchema,
  targetDays: z.array(z.number().int().min(0).max(6)).optional(),
  fullVersion: z.string().max(200).optional(),
  backupPlan: z.string().max(300).optional(),
  timeWindow: habitTimeWindowSchema.optional(),
  perWeekTarget: z.number().int().min(1).max(7).optional(),
  /** Why this one — must refer to signals that were actually supplied. */
  rationale: z.string().min(1).max(300),
});

export type HabitDraft = z.infer<typeof habitDraftSchema>;

/**
 * Where the user actually is in their day. Sent by the client rather than
 * inferred server-side, because the server's clock is UTC in a datacentre and
 * "after work" has to mean the user's evening, not the server's.
 */
export const localTimeSchema = z.object({
  localHour: z.number().int().min(0).max(23).optional(),
  timeZone: z.string().max(64).optional(),
});

export const suggestHabitsSchema = localTimeSchema.extend({
  /** Narrow the proposals to one dimension of wellbeing. */
  focus: wellnessCategorySchema.optional(),
  count: z.number().int().min(1).max(5).default(3),
});

export type SuggestHabitsInput = z.infer<typeof suggestHabitsSchema>;

export const discoverTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

/**
 * Conversational habit discovery. The client sends the whole short transcript
 * each turn rather than a conversation id: this is a bounded, disposable
 * exchange about *building* habits, not a guide conversation worth keeping.
 */
export const discoverHabitsSchema = localTimeSchema.extend({
  turns: z.array(discoverTurnSchema).min(1).max(24),
});

export type DiscoverHabitsInput = z.infer<typeof discoverHabitsSchema>;

// ─── Workouts ────────────────────────────────────────────────────

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).optional(),
  reps: z.number().int().min(1).optional(),
  weight: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  notes: z.string().optional(),
});

/**
 * A workout log. Exercises are optional: "30 minutes of cardio" is a
 * complete log, and requiring sets and reps before anything saves is how a
 * workout that happened never makes it into the app.
 */
export const logWorkoutSchema = z.object({
  name: z.string().min(1).max(100),
  type: workoutTypeSchema,
  duration: z.number().int().min(1).max(600).optional(),
  exercises: z.array(exerciseSchema).max(50).default([]),
  difficulty: workoutDifficultySchema.optional(),
  aiGenerated: z.boolean().optional(),
});

export type LogWorkoutInput = z.infer<typeof logWorkoutSchema>;

// ─── Recommendations ─────────────────────────────────────────────

/**
 * What happened to a recommendation.
 *
 * Only two outcomes are recordable, and neither is a default: a recommendation
 * nobody responded to stays open forever rather than decaying into a rejection.
 * Silence is not a signal — see packages/shared/src/utils/preferences.ts.
 */
/** Which of the two offered micro-actions the user picked. */
export const chooseRecommendationSchema = z.object({
  option: z.enum(["primary", "alternative"]),
});

export const recommendationFeedbackSchema = z.object({
  outcome: z.enum(["acted", "dismissed"]),
});

export type RecommendationFeedbackInput = z.infer<typeof recommendationFeedbackSchema>;

export const generateRecommendationSchema = localTimeSchema.extend({
  /**
   * Ask for a different one. Recorded as a dismissal of the current
   * recommendation, because "give me something else" is exactly that.
   */
  refresh: z.boolean().optional(),
});

export type GenerateRecommendationInput = z.infer<typeof generateRecommendationSchema>;

// ─── Mood ────────────────────────────────────────────────────────

export const createMoodEntrySchema = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
  journal: z.string().max(5000).optional(),
  gratitude: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export type CreateMoodEntryInput = z.infer<typeof createMoodEntrySchema>;

/**
 * The full daily check-in.
 *
 * Every field beyond `mood` was always accepted by the API and simply never
 * asked for. What's different here is the update semantics, which the three
 * states of each field encode:
 *
 *   absent  → leave whatever is already stored for today alone
 *   null    → clear it
 *   value   → set it
 *
 * That distinction is load-bearing. Tapping a mood face on the home screen
 * sends only `mood`; without "absent means leave alone", that one tap would
 * silently erase a journal entry written earlier the same day.
 */
export const checkInSchema = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10).nullish(),
  stress: z.number().int().min(1).max(10).nullish(),
  journal: z.string().max(5000).nullish(),
  gratitude: z.string().max(1000).nullish(),
  tags: z.array(z.string().max(30)).max(10).nullish(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

// ─── Marketing site ──────────────────────────────────────────────

export const waitlistSignupSchema = z.object({
  email: z.string().email().max(200),
  /** Which tab the form was submitted from. */
  source: z.string().max(40).optional(),
  sessionId: z.string().max(64).optional(),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupSchema>;

/**
 * Analytics events.
 *
 * `name` is constrained to a known list rather than accepting free text — an
 * open ingest endpoint with an arbitrary string field is a storage bill
 * waiting to happen, and an unbounded set of event names is unqueryable
 * anyway. Adding a metric means adding it here, deliberately.
 */
export const analyticsEventNameSchema = z.enum([
  "session_start",
  "tab_view",
  "tab_dwell",
  "scroll_depth",
  "cta_click",
  "chat_demo_open",
  "chat_demo_message",
  "chat_demo_error",
  "waitlist_view",
  "waitlist_submit",
  "waitlist_error",
  "signin_click",
]);

export const analyticsEventSchema = z.object({
  name: analyticsEventNameSchema,
  tab: z.string().max(40).optional(),
  /** Small non-identifying extras: a dwell time, a scroll percentage. */
  props: z.record(z.union([z.string().max(120), z.number(), z.boolean()])).optional(),
});

export const analyticsBatchSchema = z.object({
  /** Random per tab session, generated in the browser. Never a user id. */
  sessionId: z.string().min(8).max(64),
  events: z.array(analyticsEventSchema).min(1).max(50),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

// ─── Therapist Starter Pack ──────────────────────────────────────
// Every category defaults to false — sharing is opt-in, never assumed.

export const therapistCategoriesSchema = z.object({
  habits: z.boolean().default(false),
  moodTrends: z.boolean().default(false),
  journalExcerpts: z.boolean().default(false),
  patterns: z.boolean().default(false),
  score: z.boolean().default(false),
});

export type TherapistCategoriesInput = z.infer<typeof therapistCategoriesSchema>;

export const generateTherapistReportSchema = z.object({
  days: z.number().int().min(7).max(90).default(30),
});

export type GenerateTherapistReportInput = z.infer<typeof generateTherapistReportSchema>;
