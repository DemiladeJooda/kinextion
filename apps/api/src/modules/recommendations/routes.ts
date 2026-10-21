/**
 * Micro-recommendations, and what the user did with them.
 *
 * The Recommendation model existed with `acted` and `dismissed` columns that
 * nothing ever wrote, because recommendations were generated live on the
 * phone and never stored. That made the loop open: the system could suggest,
 * but it could never find out whether the suggestion was any good.
 *
 * Closing it needs three things, and this module is all three:
 *   - recommendations persisted at generation time, so feedback has a row to
 *     attach to;
 *   - the two outcomes recordable against that row;
 *   - the history read back into the next generation.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import {
  generateRecommendationSchema,
  recommendationFeedbackSchema,
  chooseRecommendationSchema,
} from "@kinextion/shared";
import { buildHabitContext } from "../../lib/habit-context.js";
import { startOfToday } from "../../lib/score.js";
import { generateRecommendation } from "./generator.js";
import { loadRecommendationHistory } from "./preferences.js";

export async function recommendationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  /** Generation costs a model call — capped like the other assisted routes. */
  const ASSIST_RATE_LIMIT = { rateLimit: { max: 12, timeWindow: "1 minute" } };

  const latestToday = (userId: string, timeZone: string) =>
    prisma.recommendation.findFirst({
      where: { userId, createdAt: { gte: startOfToday(timeZone) } },
      orderBy: { createdAt: "desc" },
    });

  // Today's recommendation, or null. Read-only and free — the app calls this
  // on mount so a reopened screen shows the same card, with the same id, in
  // whatever state the user left it.
  app.get("/today", async (request) => {
    return { success: true, data: await latestToday(request.userId, request.timeZone) };
  });

  /**
   * Get today's recommendation, generating one only if needed.
   *
   * Deliberately idempotent: an existing, un-dismissed recommendation is
   * returned untouched rather than replaced. Regenerating on every app open
   * would both burn tokens and break the loop this module exists to close —
   * a recommendation the user never saw twice can't accumulate feedback.
   */
  app.post("/today", { config: ASSIST_RATE_LIMIT }, async (request, reply) => {
    const parsed = generateRecommendationSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const userId = request.userId;
    const { refresh, localHour, timeZone } = parsed.data;
    const existing = await latestToday(userId, request.timeZone);

    if (existing && !existing.dismissed && !refresh) {
      return { success: true, data: existing };
    }

    // "Give me something else" is a rejection of what's on screen, and it's
    // the most common feedback a user will ever give — recording it is most
    // of the value in this feature.
    if (refresh && existing && !existing.acted && !existing.dismissed) {
      await prisma.recommendation.update({
        where: { id: existing.id },
        data: { dismissed: true },
      });
    }

    const [context, history] = await Promise.all([
      buildHabitContext(userId, { localHour, timeZone: timeZone ?? request.timeZone }),
      loadRecommendationHistory(userId, timeZone ?? null),
    ]);

    const generated = await generateRecommendation(context, history);

    const created = await prisma.recommendation.create({
      data: {
        userId,
        content: generated.action,
        category: generated.category,
        context: generated.why,
        alternative: generated.alternative?.action ?? null,
        alternativeCategory: generated.alternative?.category ?? null,
        alternativeContext: generated.alternative?.why ?? null,
      },
    });

    return reply.status(201).send({
      success: true,
      data: created,
      meta: { basis: context.basis, learned: history.lines },
    });
  });

  /**
   * Pick one of the two options.
   *
   * Picking the alternative swaps it into the main fields, so everything
   * downstream — feedback, history, what the generator learns from — keeps
   * reading `content` as "the thing they chose", and the option passed over
   * stays in `alternative`. Only the first pick counts.
   */
  app.post<{ Params: { id: string } }>("/:id/choose", async (request, reply) => {
    const parsed = chooseRecommendationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const rec = await prisma.recommendation.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!rec) {
      return reply.status(404).send({ success: false, error: "Recommendation not found" });
    }
    if (rec.chosenAt || !rec.alternative) {
      return { success: true, data: rec };
    }

    const swap = parsed.data.option === "alternative";
    const updated = await prisma.recommendation.update({
      where: { id: rec.id },
      data: {
        chosenAt: new Date(),
        ...(swap
          ? {
              content: rec.alternative,
              category: rec.alternativeCategory ?? rec.category,
              context: rec.alternativeContext,
              alternative: rec.content,
              alternativeCategory: rec.category,
              alternativeContext: rec.context,
            }
          : {}),
      },
    });

    return { success: true, data: updated };
  });

  /**
   * Record what happened.
   *
   * Scoped `updateMany` so ownership is enforced in the same statement as the
   * write — a count of 0 means "not yours or not real", and the route doesn't
   * distinguish the two.
   */
  app.post<{ Params: { id: string } }>("/:id/feedback", async (request, reply) => {
    const parsed = recommendationFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const acted = parsed.data.outcome === "acted";
    const result = await prisma.recommendation.updateMany({
      where: { id: request.params.id, userId: request.userId },
      // Both flags are set every time so changing your mind is possible —
      // marking one acted after dismissing it clears the dismissal rather
      // than leaving a row that claims both.
      data: { acted, dismissed: !acted },
    });

    if (result.count === 0) {
      return reply.status(404).send({ success: false, error: "Recommendation not found" });
    }

    return { success: true, data: { id: request.params.id, acted, dismissed: !acted } };
  });

  /**
   * History, plus what the system has concluded from it.
   *
   * The conclusions are the same sentences given to the model when generating
   * — one function produces both (see utils/preferences.ts), so what the app
   * tells the user it has learned is exactly what it acts on.
   */
  app.get<{ Querystring: { limit?: string; timeZone?: string } }>("/", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "30", 10) || 30, 100);

    const [recommendations, history] = await Promise.all([
      prisma.recommendation.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      loadRecommendationHistory(request.userId, request.query.timeZone ?? null),
    ]);

    return {
      success: true,
      data: {
        recommendations,
        preferences: {
          lines: history.lines,
          answered: history.profile.answered,
          acted: history.profile.acted,
          provisional: history.profile.provisional,
        },
      },
    };
  });
}
