/**
 * The daily check-in — mood, energy, stress, tags, gratitude, journal.
 *
 * The API already accepted all of these on POST /api/mood; nothing ever asked
 * for them. This module exists to make the check-in a first-class thing with
 * its own semantics:
 *
 *   - One check-in per day. A second submission edits the first rather than
 *     stacking entries, so "today's check-in" is a single, editable answer.
 *   - Submitting returns the recomputed score in the same round trip, so the
 *     ring on the home screen moves the moment the sheet closes.
 *
 * Journal and gratitude are the most sensitive fields in the product; both are
 * in the server's log redaction list (see server.ts) so they never reach a log
 * line that outlives the request.
 */

import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import { checkInSchema, localTimeSchema } from "@kinextion/shared";
import { buildHabitContext } from "../../lib/habit-context.js";
import { recomputeTodayScore, startOfToday } from "../../lib/score.js";
import { generateCheckInPrompt } from "./prompt.js";
import { saveCheckIn } from "./save.js";

export async function checkInRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  /** One model call per request — capped like the other assisted routes. */
  const ASSIST_RATE_LIMIT = { rateLimit: { max: 12, timeWindow: "1 minute" } };

  // Today's check-in, or null. Drives whether the app shows "check in" or
  // "edit today's check-in", and prefills the sheet.
  app.get("/today", async (request) => {
    const entry = await prisma.moodEntry.findFirst({
      where: { userId: request.userId, createdAt: { gte: startOfToday(request.timeZone) } },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: {
        entry,
        // The score's reflection component needs one of these two, so the
        // client can show exactly what's still missing.
        reflectionDone: Boolean(entry?.journal || entry?.gratitude),
      },
    };
  });

  /**
   * Submit or amend today's check-in.
   *
   * Deliberately not a plain create: someone who taps a mood on the home
   * screen in the morning and writes a journal entry at night has had one
   * day, not two check-ins, and the score should read it that way.
   */
  app.post("/", async (request, reply) => {
    const parsed = checkInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const userId = request.userId;
    const { entry, existing } = await saveCheckIn(userId, request.timeZone, parsed.data);

    return reply.status(existing ? 200 : 201).send({
      success: true,
      data: { entry, score: await recomputeTodayScore(userId, request.timeZone) },
    });
  });

  /**
   * A question to start from, generated from today's real data.
   *
   * Best-effort by design: the prompt helper swallows its own failures and
   * returns a plain question, because an unavailable model must never be the
   * reason someone can't write in their journal.
   */
  app.post("/prompt", { config: ASSIST_RATE_LIMIT }, async (request) => {
    const parsed = localTimeSchema.safeParse(request.body ?? {});
    const options = parsed.success ? parsed.data : {};

    const context = await buildHabitContext(request.userId, {
      ...options,
      timeZone: options.timeZone ?? request.timeZone,
    });
    const prompt = await generateCheckInPrompt(context);

    return { success: true, data: { ...prompt, basis: context.basis } };
  });
}
