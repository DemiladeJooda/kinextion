/**
 * Reading onboarding answers as they're given, Jarvis-style: nobody asks for
 * it and nothing waits on it.
 *
 * One small model call, made when someone finishes "Who do you want to
 * become?". It fixes spelling in what they typed (the identity line and any
 * "Something else" goal), keeping their words and voice, and suggests what
 * they might have access to for becoming that person. The keyword list in
 * `accessOptionsFor` is always the base, so a slow or failed call still
 * leaves a sensible question on screen.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { accessOptionsFor, identityGoalSchema } from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";

const bodySchema = z.object({
  identity: z.string().trim().max(120).optional(),
  goals: z.array(z.string().trim().max(60)).max(5).default([]),
});

const MAX_AI_OPTIONS = 6;

const SYSTEM = [
  "You read one person's onboarding answers inside a habit app. You are not chatting with them; they only see the result.",
  "",
  "1. identity: the line they wrote after \"I'm\" for who they want to become. Fix spelling, typos and grammar only. Keep their words, meaning and voice, lower-case at the start, no full stop. If it's already clean, return it unchanged.",
  "2. goals: the goals they typed themselves. Same rule: fix spelling only, keep their wording, sentence case.",
  "3. access: up to six short things a person might have access to that would help them become who they described. Physical things, places, time or people (\"A quiet hour most days\", \"A friend to do it with\"). Each under six words, sentence case, no full stop. Specific to what they wrote, never generic fitness kit unless they're becoming more active. Don't repeat anything in the existing list.",
  "",
  "If anything they wrote suggests a crisis, self-harm, disordered eating or abuse, set concern to true, return their text exactly as written and leave access empty.",
].join("\n");

interface ReadResult {
  identity?: string;
  goals?: string[];
  access?: string[];
  concern?: boolean;
}

export function registerOnboardingReadRoute(app: FastifyInstance) {
  app.post("/me/onboarding/read", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Nothing to read." });
    const { identity, goals } = parsed.data;
    const base = accessOptionsFor(identity, goals);
    const fallback = { identity: identity ?? null, goals, access: base };
    if (!identity && goals.length === 0) return { success: true, data: fallback };

    try {
      const result = await generateStructured<ReadResult>({
        task: "polish",
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Who they want to become: ${JSON.stringify(identity ?? "")}\nGoals: ${JSON.stringify(goals)}\nExisting access list: ${JSON.stringify(base)}`,
          },
        ],
        toolName: "read_onboarding",
        toolDescription: "Return the cleaned identity and goals, plus extra access options.",
        inputSchema: {
          type: "object",
          properties: {
            identity: { type: "string", maxLength: 120 },
            goals: { type: "array", items: { type: "string", maxLength: 60 } },
            access: { type: "array", items: { type: "string", maxLength: 40 } },
            concern: { type: "boolean" },
          },
          required: ["identity", "goals", "access"],
        },
      });

      if (result.concern) {
        request.log.warn({ event: "onboarding_identity_concern" }, "onboarding answer flagged for care");
        return { success: true, data: fallback };
      }

      const cleanIdentity = result.identity?.trim();
      const cleanGoals = result.goals?.length === goals.length ? result.goals.map((g) => g.trim()) : goals;
      const seen = new Set(base.map((o) => o.toLowerCase()));
      const extra = (result.access ?? [])
        .map((o) => o.trim())
        .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()))
        .slice(0, MAX_AI_OPTIONS);

      return {
        success: true,
        data: {
          identity: cleanIdentity && identityGoalSchema.safeParse(cleanIdentity).success ? cleanIdentity : (identity ?? null),
          goals: cleanGoals.every(Boolean) ? cleanGoals : goals,
          // Theirs first: the AI's picks are specific to what they wrote.
          access: [...extra, ...base],
        },
      };
    } catch (err) {
      request.log.warn({ err }, "onboarding read failed; keyword options stay");
      return { success: true, data: fallback };
    }
  });
}
