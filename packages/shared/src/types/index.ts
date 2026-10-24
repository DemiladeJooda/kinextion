import type { UserBackground } from "../profile/index.js";
// ─── AI Personas ─────────────────────────────────────────────────

export type Persona = "altheo" | "kairo";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

// ─── Wellness Categories ─────────────────────────────────────────

export type WellnessCategory = "physical" | "mental" | "emotional" | "spiritual";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export type WorkoutType = "strength" | "cardio" | "mobility" | "mixed";

export type WorkoutDifficulty = "too_easy" | "just_right" | "too_hard";

export type HabitFrequency = "daily" | "weekly" | "custom";

// ─── User Profile ────────────────────────────────────────────────

export interface UserProfile {
  displayName?: string;
  /** Ready Player Me avatar id — a stylized, face-matched avatar, not a body scan. */
  avatarId?: string;
  age?: number;
  fitnessLevel?: FitnessLevel;
  primaryGoals?: string[];
  weeklyAvailability?: number;
  equipment?: string[];
  healthConditions?: string[];
  preferences?: UserPreferences;
  /** Who they are, in their own words. See profile/index.ts. */
  background?: UserBackground | null;
  onboardingComplete: boolean;
}

export interface UserPreferences {
  notificationsEnabled?: boolean;
  dailyCheckInTime?: string;
  aiPersonalityDial?: "scripture" | "balanced" | "universal";
  theme?: "aurora" | "light";
  /** How hard the guides push. Read by both personas' prompt context. */
  coachingIntensity?: "gentle" | "balanced" | "intense";
  /** The window the displayed Kinextion Score aggregates and resets on. */
  scorePeriod?: "weekly" | "monthly" | "yearly";
  /** Volunteered once at onboarding — supplementary context, never a gate. */
  doesTherapy?: boolean;
  doesJournal?: boolean;
  currentlyWorkingOut?: boolean;
}

// ─── Kinextion Score ─────────────────────────────────────────────

export interface ScoreBreakdown {
  habitsCompleted: number;
  habitsTotal: number;
  workoutLogged: boolean;
  moodCheckedIn: boolean;
  reflectionDone: boolean;
  streakDays: number;
}

// ─── Atomic Habits ───────────────────────────────────────────────

export interface HabitLoop {
  cue: string;
  craving: string;
  response: string;
  reward: string;
}

// ─── API Responses ───────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
