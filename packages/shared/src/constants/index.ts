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

export const AI_CONFIG = {
  altheo: {
    name: "Altheo",
    title: "The Coach",
    description: "Your adaptive training companion",
    model: "claude-sonnet-4-20250514",
    maxTokens: 1024,
  },
  kairo: {
    name: "Kairo",
    title: "The Listener",
    description: "Your guide for reflection and clarity",
    model: "claude-sonnet-4-20250514",
    maxTokens: 1024,
  },
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

export const EQUIPMENT_OPTIONS = [
  "No equipment (bodyweight)",
  "Dumbbells",
  "Resistance bands",
  "Gym membership",
  "Pull-up bar",
  "Yoga mat",
  "Kettlebell",
] as const;
