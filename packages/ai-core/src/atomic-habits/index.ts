import type { HabitLoop } from "@kinextion/shared";

/**
 * Atomic Habits Engine
 *
 * Helps structure habits around the four laws of behavior change:
 * 1. Make it obvious (Cue)
 * 2. Make it attractive (Craving)
 * 3. Make it easy (Response)
 * 4. Make it satisfying (Reward)
 */

export interface HabitSuggestion {
  habit: HabitLoop;
  twoMinuteVersion: string;
  habitStack: string;
  identityStatement: string;
}

/**
 * Generate a structured habit suggestion following Atomic Habits principles.
 * This creates the framework — the AI fills in personalized content.
 */
export function createHabitFramework(
  habitName: string,
  existingRoutine: string
): HabitSuggestion {
  return {
    habit: {
      cue: `After I ${existingRoutine}`,
      craving: `I want to feel the momentum of showing up for myself`,
      response: habitName,
      reward: `I mark it done and see my streak grow`,
    },
    twoMinuteVersion: `Do just 2 minutes of ${habitName.toLowerCase()}`,
    habitStack: `After I ${existingRoutine}, I will ${habitName.toLowerCase()}`,
    identityStatement: `I am someone who ${habitName.toLowerCase()} consistently`,
  };
}

/**
 * Score how well a habit is established based on completion data.
 * Returns a phase: "building" | "growing" | "established" | "automatic"
 */
export function getHabitPhase(
  completionRate: number,
  streakDays: number
): "building" | "growing" | "established" | "automatic" {
  if (streakDays >= 66 && completionRate >= 0.9) return "automatic";
  if (streakDays >= 30 && completionRate >= 0.8) return "established";
  if (streakDays >= 7 && completionRate >= 0.6) return "growing";
  return "building";
}

/**
 * Get coaching advice based on habit phase.
 */
export function getPhaseAdvice(phase: ReturnType<typeof getHabitPhase>): string {
  const advice: Record<typeof phase, string> = {
    building:
      "Focus on showing up, not the result. Even 2 minutes counts. The goal right now is consistency, not intensity.",
    growing:
      "You're building momentum. Start to increase duration or intensity slightly. Your identity is shifting — you're becoming someone who does this.",
    established:
      "This habit is becoming part of who you are. Now's the time to refine it or stack a new micro-habit on top.",
    automatic:
      "This is wired in. It's part of your identity now. Consider how this habit can support a new challenge you want to take on.",
  };
  return advice[phase];
}
