/**
 * Persisting and pruning memory.
 *
 * The pure decisions (what to keep, what to compact) live in
 * @kinextion/shared; this module supplies the data and applies the results.
 */

import { prisma } from "@kinextion/database";
import {
  DEFAULT_RETENTION,
  planCompaction,
  selectFactsToKeep,
  type RetentionPolicy,
} from "@kinextion/shared";
import { extractFacts, summarizeConversation, type ExtractedFact } from "./extract.js";

/**
 * Write facts, reinforcing rather than duplicating.
 *
 * A fact observed again bumps `hits` and `lastSeenAt` — which is what keeps
 * it above the eviction line — and takes the higher of the two confidences,
 * so a later offhand mention can't weaken something the user stated plainly.
 */
export async function upsertFacts(userId: string, facts: readonly ExtractedFact[]): Promise<number> {
  for (const fact of facts) {
    const existing = await prisma.memoryFact.findUnique({
      where: { userId_key: { userId, key: fact.key } },
    });

    if (existing) {
      await prisma.memoryFact.update({
        where: { id: existing.id },
        data: {
          content: fact.content,
          confidence: Math.max(existing.confidence, fact.confidence),
          hits: { increment: 1 },
          lastSeenAt: new Date(),
          // A fact re-observed as core is promoted; core is never demoted.
          tier: existing.tier === "core" ? "core" : fact.tier,
        },
      });
    } else {
      await prisma.memoryFact.create({
        data: {
          userId,
          tier: fact.tier,
          category: fact.category,
          key: fact.key,
          content: fact.content,
          confidence: fact.confidence,
          source: "chat",
        },
      });
    }
  }

  return facts.length;
}

/** Enforce the per-user fact budget. Returns how many were evicted. */
export async function pruneFacts(
  userId: string,
  now = new Date(),
  policy: RetentionPolicy = DEFAULT_RETENTION
): Promise<number> {
  const facts = await prisma.memoryFact.findMany({ where: { userId } });
  if (facts.length <= policy.maxFactsPerUser) return 0;

  const { evict } = selectFactsToKeep(
    facts.map((f) => ({
      id: f.id,
      tier: f.tier as "core" | "pattern",
      confidence: f.confidence,
      hits: f.hits,
      lastSeenAt: f.lastSeenAt,
    })),
    now,
    policy
  );

  if (evict.length === 0) return 0;

  await prisma.memoryFact.deleteMany({ where: { id: { in: evict.map((f) => f.id) } } });
  return evict.length;
}

/** Facts to load into a guide's context, most relevant first. */
export async function loadFactsForPrompt(userId: string, limit = 25): Promise<string[]> {
  const facts = await prisma.memoryFact.findMany({
    where: { userId },
    orderBy: [{ tier: "asc" }, { hits: "desc" }, { lastSeenAt: "desc" }],
    take: limit,
  });
  return facts.map((f) => f.content);
}

/**
 * Compact one conversation: summarise the overflow, extract anything durable
 * from it, then delete the raw rows.
 *
 * Extraction runs against the same turns being deleted — this is the last
 * chance to notice something worth keeping forever, so it happens before the
 * delete, and the delete only happens if the summary succeeded.
 */
export async function compactConversation(
  conversationId: string,
  policy: RetentionPolicy = DEFAULT_RETENTION,
  /** Fold every message, not just the overflow — for a conversation that
   *  has gone quiet. Short chats get their facts remembered too. */
  options: { foldAll?: boolean } = {}
): Promise<{ compacted: number; factsFound: number }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, summary: true },
  });
  if (!conversation) return { compacted: 0, factsFound: 0 };

  const messageCount = await prisma.message.count({ where: { conversationId } });
  const plan = options.foldAll
    ? { shouldCompact: messageCount > 0, compactCount: messageCount }
    : planCompaction(messageCount, policy);
  if (!plan.shouldCompact) return { compacted: 0, factsFound: 0 };

  const overflow = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: plan.compactCount,
  });
  if (overflow.length === 0) return { compacted: 0, factsFound: 0 };

  const transcript = overflow.map((m) => `${m.role}: ${m.content}`).join("\n");

  const [summary, facts] = await Promise.all([
    summarizeConversation(conversation.summary, transcript),
    extractFacts(transcript),
  ]);

  // Nothing is deleted unless the summary that replaces it actually exists.
  if (!summary) return { compacted: 0, factsFound: 0 };

  await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { summary } }),
    prisma.message.deleteMany({ where: { id: { in: overflow.map((m) => m.id) } } }),
  ]);

  if (facts.length > 0) {
    await upsertFacts(conversation.userId, facts);
    await pruneFacts(conversation.userId, new Date(), policy);
  }

  return { compacted: overflow.length, factsFound: facts.length };
}
