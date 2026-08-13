import type { Persona, UserProfile, ChatMessage } from "@kinextion/shared";
import { buildSystemPrompt } from "../personas/index";

/**
 * 4-Tier Context System:
 *
 * Tier 1: System Prompt (persona + safety + Atomic Habits framework)
 * Tier 2: User Profile (goals, fitness level, preferences, health context)
 * Tier 3: Conversation Memory (recent messages + summarized history)
 * Tier 4: Behavioral Data (recent habits, workouts, mood, score trends)
 */

export interface UserContext {
  profile: UserProfile | null;
  recentHabits?: { name: string; completed: boolean; streak: number }[];
  recentMood?: { mood: number; energy?: number; stress?: number; tags?: string[] };
  kinextionScore?: number;
  workoutHistory?: { type: string; name: string; daysAgo: number }[];
  conversationSummary?: string;
}

export interface BuiltContext {
  systemPrompt: string;
  messages: ChatMessage[];
}

/**
 * Build the full context for an AI conversation.
 * Assembles the 4-tier context into a single system prompt + message history.
 */
export function buildContext(
  persona: Persona,
  userContext: UserContext,
  recentMessages: ChatMessage[]
): BuiltContext {
  const systemPrompt = assembleSystemPrompt(persona, userContext);

  return {
    systemPrompt,
    messages: recentMessages,
  };
}

function assembleSystemPrompt(
  persona: Persona,
  ctx: UserContext
): string {
  // Tiers 2–4 are assembled into one context block, then handed to
  // buildSystemPrompt so this path picks up the shared safety rules and the
  // app format rules rather than re-deriving them.
  const parts: string[] = [];

  // Tier 2: User Profile
  if (ctx.profile) {
    parts.push(formatProfileContext(ctx.profile));
  }

  // Tier 3: Conversation summary (if available)
  if (ctx.conversationSummary) {
    parts.push(
      `\n## Previous Conversation Summary\n${ctx.conversationSummary}`
    );
  }

  // Tier 4: Behavioral Data
  const behavioralContext = formatBehavioralContext(ctx);
  if (behavioralContext) {
    parts.push(behavioralContext);
  }

  return buildSystemPrompt({
    guide: persona,
    surface: "app",
    userName: ctx.profile?.displayName ?? null,
    context: parts.length ? parts.join("\n\n") : null,
  });
}

function formatProfileContext(profile: UserProfile): string {
  const lines: string[] = ["\n## Current User Profile"];

  if (profile.displayName) lines.push(`- Name: ${profile.displayName}`);
  if (profile.age) lines.push(`- Age: ${profile.age}`);
  if (profile.fitnessLevel) lines.push(`- Fitness Level: ${profile.fitnessLevel}`);
  if (profile.primaryGoals?.length) {
    lines.push(`- Goals: ${profile.primaryGoals.join(", ")}`);
  }
  if (profile.weeklyAvailability) {
    lines.push(`- Available: ${profile.weeklyAvailability} days/week`);
  }
  if (profile.equipment?.length) {
    lines.push(`- Equipment: ${profile.equipment.join(", ")}`);
  }
  if (profile.preferences?.aiPersonalityDial) {
    lines.push(`- Spiritual preference: ${profile.preferences.aiPersonalityDial}`);
  }

  return lines.join("\n");
}

function formatBehavioralContext(ctx: UserContext): string | null {
  const lines: string[] = [];

  if (ctx.kinextionScore !== undefined) {
    lines.push(`- Kinextion Score today: ${ctx.kinextionScore}/100`);
  }

  if (ctx.recentMood) {
    const m = ctx.recentMood;
    let moodLine = `- Latest mood: ${m.mood}/10`;
    if (m.energy) moodLine += `, energy: ${m.energy}/10`;
    if (m.stress) moodLine += `, stress: ${m.stress}/10`;
    lines.push(moodLine);
    if (m.tags?.length) {
      lines.push(`- Feeling: ${m.tags.join(", ")}`);
    }
  }

  if (ctx.recentHabits?.length) {
    const completed = ctx.recentHabits.filter((h) => h.completed).length;
    const total = ctx.recentHabits.length;
    lines.push(`- Habits today: ${completed}/${total} completed`);
    const streaks = ctx.recentHabits
      .filter((h) => h.streak > 1)
      .map((h) => `${h.name} (${h.streak}-day streak)`);
    if (streaks.length) {
      lines.push(`- Active streaks: ${streaks.join(", ")}`);
    }
  }

  if (ctx.workoutHistory?.length) {
    const recent = ctx.workoutHistory.slice(0, 3);
    const descriptions = recent.map(
      (w) => `${w.name} (${w.type}, ${w.daysAgo === 0 ? "today" : `${w.daysAgo}d ago`})`
    );
    lines.push(`- Recent workouts: ${descriptions.join(", ")}`);
  }

  if (lines.length === 0) return null;

  return `\n## Today's Context\n${lines.join("\n")}`;
}
