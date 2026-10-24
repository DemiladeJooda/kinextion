/**
 * The coach loop's routes, mounted inside habitRoutes (so they share its
 * auth hook and prefix):
 *
 *   POST /api/habits/:id/reflect            answer "What would it take?"
 *   POST /api/habits/reflections/:id/apply  apply the one suggested change
 *   GET  /api/habits/reflections            recent answers (to not ask twice)
 *   POST /api/habits/:id/precommit          "Tomorrow, I'll …"
 *   GET  /api/habits/precommitments         promises for today and tomorrow
 *   POST /api/habits/:id/automaticity       the weekly "automatic yet?" check
 *   GET  /api/habits/automaticity           every check from the past year
 */

import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import {
  addDays,
  automaticityCheckSchema,
  changeToUpdate,
  dateFromKey,
  habitChangeSchema,
  precommitSchema,
  reflectOnMissSchema,
  srbaiScore,
  whatWouldItTake,
} from "@kinextion/shared";
import { reflectOnMiss } from "./coach.js";
import { schedulePolish } from "./polish.js";
import { statusSideEffects } from "../../lib/habit-status.js";
import { habitData } from "../../lib/habit-json.js";

const ASSIST_RATE_LIMIT = { rateLimit: { max: 12, timeWindow: "1 minute" } };

interface StoredSuggestion {
  suggested: unknown;
  backupPlan: string | null;
  applied: boolean;
}

function badRequest(issues: { message: string }[]) {
  return { success: false, error: issues.map((i) => i.message).join(", ") };
}

export function registerCoachRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/:id/reflect",
    { config: ASSIST_RATE_LIMIT },
    async (request, reply) => {
      const parsed = reflectOnMissSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send(badRequest(parsed.error.issues));

      const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
      if (!habit || habit.userId !== request.userId) {
        return reply.status(404).send({ success: false, error: "Habit not found" });
      }

      const { missedOn, answer, skipped } = parsed.data;
      const prompt = whatWouldItTake(habit.name);

      // "Not now" is recorded too, so the question isn't asked again for
      // this miss — pressure is the thing this loop exists to avoid.
      if (skipped || !answer.trim()) {
        const reflection = await prisma.habitReflection.create({
          data: {
            userId: request.userId,
            habitId: habit.id,
            date: dateFromKey(missedOn),
            prompt,
            answer: "",
          },
        });
        return reply.status(201).send({ success: true, data: { reflection, skipped: true } });
      }

      const coach = await reflectOnMiss(habit, missedOn, answer);
      const suggestion: StoredSuggestion = {
        suggested: coach.change,
        backupPlan: coach.backupPlan,
        applied: false,
      };
      const reflection = await prisma.habitReflection.create({
        data: {
          userId: request.userId,
          habitId: habit.id,
          date: dateFromKey(missedOn),
          prompt,
          answer: answer.trim(),
          appliedChange: suggestion as unknown as Prisma.InputJsonValue,
        },
      });

      if (coach.concern) {
        request.log.warn({ event: "reflection_concern", habitId: habit.id }, "reflection flagged for care");
      }
      request.log.info(
        { event: "reflection_answered", change: coach.change.type, backupPlan: !!coach.backupPlan },
        "habit event"
      );

      return reply.status(201).send({
        success: true,
        data: {
          reflection,
          reply: coach.reply,
          change: coach.change,
          backupPlan: coach.backupPlan,
          concern: coach.concern,
        },
      });
    }
  );

  /**
   * Apply what was suggested — only what was suggested. The change is read
   * back from the stored reflection rather than the request body, so the
   * button can't be used to make an edit the user wasn't shown.
   */
  app.post<{ Params: { id: string } }>("/reflections/:id/apply", async (request, reply) => {
    const reflection = await prisma.habitReflection.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!reflection) {
      return reply.status(404).send({ success: false, error: "Not found" });
    }
    const stored = (reflection.appliedChange ?? null) as StoredSuggestion | null;
    const change = habitChangeSchema.safeParse(stored?.suggested);
    if (!stored || !change.success) {
      return reply.status(400).send({ success: false, error: "Nothing to apply." });
    }
    if (stored.applied) {
      const habit = await prisma.habit.findUnique({ where: { id: reflection.habitId } });
      return { success: true, data: habit };
    }

    const update = changeToUpdate(change.data) ?? {};
    const current = await prisma.habit.findUnique({ where: { id: reflection.habitId } });
    const statusExtra = current
      ? await statusSideEffects(current, update.status, request.localToday())
      : {};
    const data = {
      ...update,
      ...statusExtra,
      ...(stored.backupPlan ? { backupPlan: stored.backupPlan } : {}),
    };

    if (Object.keys(data).length) {
      await prisma.habit.updateMany({
        where: { id: reflection.habitId, userId: request.userId },
        data: habitData(data),
      });
    }
    await prisma.habitReflection.update({
      where: { id: reflection.id },
      data: { appliedChange: { ...stored, applied: true } as unknown as Prisma.InputJsonValue },
    });

    schedulePolish(request.log, reflection.habitId, request.userId);
    const habit = await prisma.habit.findUnique({ where: { id: reflection.habitId } });
    return { success: true, data: habit };
  });

  app.get<{ Querystring: { since?: string } }>("/reflections", async (request) => {
    const since = request.query.since && /^\d{4}-\d{2}-\d{2}$/.test(request.query.since)
      ? request.query.since
      : addDays(request.localToday(), -14);
    const reflections = await prisma.habitReflection.findMany({
      where: { userId: request.userId, date: { gte: dateFromKey(since) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { success: true, data: reflections };
  });

  /**
   * The weekly "does this feel automatic yet?" check: four 1–7 answers,
   * one per habit per day (a second answer the same day replaces the first).
   */
  app.post<{ Params: { id: string } }>("/:id/automaticity", async (request, reply) => {
    const parsed = automaticityCheckSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(badRequest(parsed.error.issues));

    const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
    if (!habit || habit.userId !== request.userId) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    const day = dateFromKey(request.localToday());
    const score = srbaiScore(parsed.data.items);
    const check = await prisma.automaticityCheck.upsert({
      where: { habitId_date: { habitId: habit.id, date: day } },
      create: { userId: request.userId, habitId: habit.id, date: day, items: parsed.data.items, score },
      update: { items: parsed.data.items, score },
    });
    request.log.info({ event: "automaticity_checked", score }, "habit event");
    return reply.status(201).send({ success: true, data: check });
  });

  app.get("/automaticity", async (request) => {
    const checks = await prisma.automaticityCheck.findMany({
      where: {
        userId: request.userId,
        date: { gte: dateFromKey(addDays(request.localToday(), -365)) },
      },
      orderBy: { date: "asc" },
      select: { id: true, habitId: true, date: true, score: true },
    });
    return { success: true, data: checks };
  });

  /** "Tomorrow, I'll …" — today or tomorrow only; saying it again replaces it. */
  app.post<{ Params: { id: string } }>("/:id/precommit", async (request, reply) => {
    const parsed = precommitSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(badRequest(parsed.error.issues));

    const today = request.localToday();
    const { forDate, text } = parsed.data;
    if (forDate < today || forDate > addDays(today, 1)) {
      return reply.status(400).send({ success: false, error: "Commit to today or tomorrow." });
    }

    const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
    if (!habit || habit.userId !== request.userId) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    const day = dateFromKey(forDate);
    const precommitment = await prisma.precommitment.upsert({
      where: { habitId_forDate: { habitId: habit.id, forDate: day } },
      create: { userId: request.userId, habitId: habit.id, forDate: day, text },
      update: { text },
    });
    return reply.status(201).send({ success: true, data: precommitment });
  });

  app.get("/precommitments", async (request) => {
    const today = request.localToday();
    const precommitments = await prisma.precommitment.findMany({
      where: {
        userId: request.userId,
        forDate: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 1)) },
      },
    });
    return { success: true, data: precommitments };
  });
}
