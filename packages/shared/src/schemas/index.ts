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
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ─── Chat ────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  persona: personaSchema,
  content: z.string().min(1).max(5000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ─── Habits ──────────────────────────────────────────────────────

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  category: wellnessCategorySchema,
  cue: z.string().max(200).optional(),
  craving: z.string().max(200).optional(),
  response: z.string().max(200).optional(),
  reward: z.string().max(200).optional(),
  frequency: habitFrequencySchema,
  targetDays: z.array(z.number().int().min(0).max(6)).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const logHabitSchema = z.object({
  habitId: z.string().cuid(),
  date: z.string().date(),
  completed: z.boolean(),
  notes: z.string().max(500).optional(),
});

export type LogHabitInput = z.infer<typeof logHabitSchema>;

// ─── Workouts ────────────────────────────────────────────────────

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1).optional(),
  reps: z.number().int().min(1).optional(),
  weight: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const logWorkoutSchema = z.object({
  name: z.string().min(1).max(100),
  type: workoutTypeSchema,
  duration: z.number().int().min(1).optional(),
  exercises: z.array(exerciseSchema).min(1),
  difficulty: workoutDifficultySchema.optional(),
  aiGenerated: z.boolean().optional(),
});

export type LogWorkoutInput = z.infer<typeof logWorkoutSchema>;

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
