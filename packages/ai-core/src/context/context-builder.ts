import { formatBackground, type Persona, type UserProfile, type ChatMessage } from "@kinextion/shared";
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
  /** Real, computed correlations between wearable data, mood, and habits —
   * never fabricated, and only ever populated when there was enough data to
   * say something honest. See apps/api/src/lib/patterns.ts. */
  patterns?: string[];
  /** Durable one-line facts distilled from past conversations — what the
   * guide still knows once the transcripts themselves are gone. */
  memoryFacts?: string[];
  /**
   * The user's habits as of today — plan, today's state, streak, recent
   * consistency, their why and backup plan, what they promised and what they
   * said after a miss. One line each, already worded for the model.
   */
  habits?: { identityGoal: string | null; lines: string[] };
  /**
   * Where this person sits in their community this week.
   *
   * Participation only — which community, whether they've spoken, when the
   * room closes. Never what they or anyone else said in a room: a guide that
   * quoted a response back at someone would turn reflection into
   * surveillance. `thinkingAbout` carries the week's public question, which
   * every member of that community already sees.
   */
  community?: {
    lines: string[];
    thinkingAbout?: { communityName: string; topicText: string };
  };
}

/**
 * The line Kairo does not cross when helping someone prepare.
 *
 * Helping a person understand a question, argue with them, or find their own
 * words is the whole point. Writing their answer is not: the app's promise is
 * that what a community hears is human.
 */
export const COMMUNITY_VOICE_RULE =
  "Help them understand the question, think it through, and find their own words — as much as they want. Never draft, script, rehearse or write their response for them. What they say to their community has to be theirs; if they ask you to write it, help them say it themselves instead.";

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
    const background = formatBackground(ctx.profile.background);
    if (background) parts.push(`\n${background}`);
  }

  // Tier 3: Durable memory — what survives after transcripts are compacted.
  // Sits above the conversation summary because constraints outrank recency:
  // an injury stays true regardless of what was discussed last week.
  if (ctx.memoryFacts?.length) {
    parts.push(
      `\n## What You Know About Them\n${ctx.memoryFacts.map((f) => `- ${f}`).join("\n")}`
    );
  }

  // Tier 4: Conversation summary (if available)
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

  // Their habits — the product's core loop. After behavioural data so the
  // guide reads mood and patterns first, then what the user is building.
  if (ctx.habits && (ctx.habits.lines.length || ctx.habits.identityGoal)) {
    const lines: string[] = [];
    if (ctx.habits.identityGoal) {
      lines.push(`- Who they're becoming, in their words: ${ctx.habits.identityGoal}`);
    }
    lines.push(...ctx.habits.lines);
    parts.push(
      `\n## Their Habits\n${lines.join("\n")}\n\n` +
        "Use this to understand them, not to report on them. Bring a habit up only when it's relevant to what they're saying. " +
        "Never list their habits back, never guilt them about a miss, and never mention streaks unless they do."
    );
  }

  // Their community — participation, and the week's question if they're
  // working on it. Last, because it's the newest half of the app and should
  // colour the conversation rather than lead it.
  if (ctx.community?.lines.length) {
    parts.push(`\n## Their Community\n${ctx.community.lines.map((l) => `- ${l}`).join("\n")}`);
  }
  if (ctx.community?.thinkingAbout) {
    const { communityName, topicText } = ctx.community.thinkingAbout;
    parts.push(
      `\n## This Week's Question\n${communityName} is discussing: "${topicText}"\n\n${COMMUNITY_VOICE_RULE}`
    );
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
  if (profile.preferences?.coachingIntensity) {
    const guidance: Record<string, string> = {
      gentle: "go easy — small asks, generous encouragement, never imply they're behind",
      balanced: "challenge them when they're ready, ease off when they're not",
      intense: "push harder — expect more, and say so",
    };
    lines.push(
      `- Coaching intensity: ${profile.preferences.coachingIntensity} (${guidance[profile.preferences.coachingIntensity]})`
    );
  }
  const lifestyle: string[] = [];
  if (profile.preferences?.doesTherapy) lifestyle.push("sees a therapist");
  if (profile.preferences?.doesJournal) lifestyle.push("already journals");
  if (profile.preferences?.currentlyWorkingOut) lifestyle.push("already works out");
  if (lifestyle.length) lines.push(`- Already in motion: ${lifestyle.join(", ")}`);

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

  if (ctx.patterns?.length) {
    lines.push(`- Patterns Kinextion has noticed: ${ctx.patterns.join("; ")}`);
  }

  if (lines.length === 0) return null;

  return `\n## Today's Context\n${lines.join("\n")}`;
}
