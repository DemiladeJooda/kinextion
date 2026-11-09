/**
 * Turning what someone said in onboarding into things the guides remember.
 *
 * Their why is core memory: it's what gets said back on a hard day.
 */

import { prisma, Prisma } from "@kinextion/database";
import type { Understanding } from "@kinextion/shared";
import { upsertFacts } from "../../lib/memory/store.js";
import type { ExtractedFact } from "../../lib/memory/extract.js";

const STYLE: Record<NonNullable<Understanding["helpStyle"]>, string> = {
  straight: "Wants it straight: be direct and hold them to it.",
  gentle: "Wants gentleness on hard days.",
  plan: "Wants clear next steps and less talk.",
  why: "Wants help working out why, with questions before answers.",
};

export function factsFrom(u: Understanding): ExtractedFact[] {
  const fact = (tier: ExtractedFact["tier"], category: ExtractedFact["category"], key: string, content: string): ExtractedFact => ({
    tier,
    category,
    key,
    content,
    confidence: 0.95,
  });

  const facts: ExtractedFact[] = [
    fact("core", "goal", "goal:first_focus", `Came to Kinextion for help with ${u.area.toLowerCase()}${u.specifics.length ? `, specifically: ${u.specifics.join("; ").toLowerCase()}` : ""}.`),
  ];
  if (u.coreWhy) facts.push(fact("core", "identity", "identity:core_why", `Why it really matters to them, in their words: ${u.coreWhy}`));
  if (u.whyLadder.length > 1) facts.push(fact("core", "identity", "identity:why_path", `How they got to that reason: ${u.whyLadder.join(" → ")}`));
  if (u.routine) facts.push(fact("pattern", "context", "context:existing_routine", `Asked if they have a routine for this: ${u.routine}.`));
  if (u.obstacles.length) facts.push(fact("pattern", "constraint", "constraint:usual_obstacles", `What usually gets in their way: ${u.obstacles.join("; ")}.`));
  if (u.helpStyle) facts.push(fact("core", "preference", "preference:help_style", STYLE[u.helpStyle]));
  return facts;
}

export async function rememberUnderstanding(userId: string, understanding: Understanding, existing: unknown) {
  await upsertFacts(userId, factsFrom(understanding));
  const context = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {};
  await prisma.profile.update({
    where: { userId },
    data: { aiContext: { ...context, understanding } as Prisma.InputJsonValue },
  });
}
