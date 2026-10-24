/**
 * Shared conversation setup for the chat routes.
 *
 * Both the streaming and non-streaming routes need the same three things:
 * a conversation the caller actually owns, the user's message saved, and a
 * context assembled from memory. Keeping that in one place means the two
 * routes can't drift into remembering different things.
 */

import { prisma } from "@kinextion/database";
import { DEFAULT_RETENTION, localDateKey } from "@kinextion/shared";
import { buildContext } from "@kinextion/ai-core";
import { computePatterns } from "../../lib/patterns.js";
import { habitsForChat } from "../../lib/habits-for-chat.js";
import { loadFactsForPrompt } from "../../lib/memory/store.js";
import { communityContextFor } from "../community/context.js";
import { sharedCommunityDeps } from "../community/deps.js";
import type { ChatMessage, Persona, UserProfile } from "@kinextion/shared";

/**
 * Resolve the conversation, verifying ownership rather than assuming it —
 * otherwise a caller could append into someone else's thread by guessing an id.
 */
export async function resolveConversation(
  userId: string,
  persona: string,
  conversationId?: string
): Promise<{ id: string } | { error: "not_found" }> {
  if (!conversationId) {
    const created = await prisma.conversation.create({ data: { userId, persona } });
    return { id: created.id };
  }

  const existing = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!existing || existing.userId !== userId) return { error: "not_found" };
  return { id: existing.id };
}

export interface PreparedTurn {
  systemPrompt: string;
  messages: ChatMessage[];
}

/**
 * Save the user's message, then assemble the guide's context.
 *
 * The verbatim window is deliberately short — older turns live in the
 * conversation summary and in durable memory facts rather than being
 * replayed in full on every request.
 */
export async function prepareTurn(
  userId: string,
  conversationId: string,
  persona: Persona,
  content: string,
  topicId?: string,
  timeZone = "UTC"
): Promise<PreparedTurn> {
  await prisma.message.create({
    data: { conversationId, role: "user", content },
  });

  const [conversation, previous, profile, recentMessages, recentMood, patterns, memoryFacts] =
    await Promise.all([
      prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { summary: true },
      }),
      // The train of thought across sessions: a new chat opens with the
      // summary of the last one with this guide, instead of starting cold.
      prisma.conversation.findFirst({
        where: { userId, persona, id: { not: conversationId }, summary: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { summary: true },
      }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: DEFAULT_RETENTION.chatWindowTurns,
      }),
      prisma.moodEntry.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
      // Only Kinextion's own computed patterns — never fabricated, and only
      // the strongest couple so the guide isn't reciting a stats printout.
      computePatterns(userId).then((p) => p.slice(0, 2).map((x) => x.summary)),
      loadFactsForPrompt(userId),
    ]);

  const chatMessages: ChatMessage[] = recentMessages
    .slice()
    .reverse()
    .map((m: { role: string; content: string }) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));

  // Participation only, and best-effort: the guides worked before there were
  // communities, and a community read that fails must not break a chat.
  let community;
  try {
    community = await communityContextFor(sharedCommunityDeps(), userId, topicId);
  } catch {
    community = undefined;
  }

  // Habits, best-effort like community: a failed read must not break a chat.
  let habits;
  try {
    habits = await habitsForChat(userId, timeZone, profile?.identityGoal ?? null);
  } catch {
    habits = undefined;
  }

  const ctx = buildContext(
    persona,
    {
      profile: profile as UserProfile | null,
      community,
      habits,
      patterns: patterns.length ? patterns : undefined,
      memoryFacts: memoryFacts.length ? memoryFacts : undefined,
      conversationSummary:
        conversation?.summary ??
        (previous?.summary ? `From your last conversation: ${previous.summary}` : undefined),
      recentMood: recentMood
        ? {
            mood: recentMood.mood,
            energy: recentMood.energy ?? undefined,
            stress: recentMood.stress ?? undefined,
            tags: (recentMood.tags as string[]) ?? undefined,
          }
        : undefined,
    },
    chatMessages
  );

  return { systemPrompt: `${ctx.systemPrompt}\n\n${rightNow(timeZone)}`, messages: ctx.messages };
}

/**
 * The guides had no idea what day it was, so "tomorrow", "this evening" or
 * "back next Sunday" couldn't be turned into anything. To the hour, in the
 * user's own time zone — precise enough to plan with.
 */
export function rightNow(timeZone: string, at = new Date()): string {
  const date = at.toLocaleDateString("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const hour = at.toLocaleTimeString("en-US", { timeZone, hour: "numeric", hour12: true });
  return `## Right now\nIt's ${date}, around ${hour.toLowerCase().replace(" ", "")} where they are (${localDateKey(at, timeZone)}).`;
}
