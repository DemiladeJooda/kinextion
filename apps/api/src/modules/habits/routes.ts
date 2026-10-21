import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import {
  createHabitSchema,
  logHabitSchema,
  updateHabitSchema,
  suggestHabitsSchema,
  discoverHabitsSchema,
} from "@kinextion/shared";
import { addDays, dateFromKey } from "@kinextion/shared";
import { buildHabitContext } from "../../lib/habit-context.js";
import { recomputeTodayScore } from "../../lib/score.js";
import { discoverHabits, suggestHabits } from "./assistant.js";

export async function habitRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  /** AI-backed routes cost a model call each, so they get their own cap on
   * top of the API-wide limit — same reasoning as the chat routes. */
  const ASSIST_RATE_LIMIT = { rateLimit: { max: 12, timeWindow: "1 minute" } };

  // List the authenticated user's habits. Archived ones are excluded unless
  // asked for — the habits tab wants today's list, the manage screen wants
  // everything the user has ever built.
  app.get<{ Querystring: { includeArchived?: string } }>("/", async (request) => {
    const includeArchived = request.query.includeArchived === "true";
    const habits = await prisma.habit.findMany({
      where: {
        userId: request.userId,
        ...(includeArchived ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return { success: true, data: habits };
  });

  // Create a habit
  app.post("/", async (request, reply) => {
    const parsed = createHabitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const habit = await prisma.habit.create({
      data: { userId: request.userId, ...parsed.data },
    });

    request.log.info(
      {
        event: "habit_created",
        frequency: habit.frequency,
        hasCue: Boolean(habit.cue),
        hasTinyVersion: Boolean(habit.response),
      },
      "habit event"
    );

    return reply.status(201).send({ success: true, data: habit });
  });

  /**
   * Edit a habit. Ownership is checked with a scoped `updateMany` rather than
   * a find-then-update: one statement, no window between the check and the
   * write, and a count of 0 is indistinguishable from "doesn't exist" — so
   * this never confirms that another user's habit id is real.
   */
  app.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const parsed = updateHabitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const result = await prisma.habit.updateMany({
      where: { id: request.params.id, userId: request.userId },
      data: parsed.data,
    });

    if (result.count === 0) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
    return { success: true, data: habit };
  });

  /**
   * Archive, not delete.
   *
   * The logs are the user's history — dropping a habit shouldn't erase the
   * three weeks they kept it. `isActive: false` takes it off today's list and
   * out of the score denominator while leaving every HabitLog row intact, so
   * streaks, the therapist report and the pattern engine still see the past.
   */
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const result = await prisma.habit.updateMany({
      where: { id: request.params.id, userId: request.userId },
      data: { isActive: false },
    });

    if (result.count === 0) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    return { success: true, data: { archived: true } };
  });

  /**
   * Habits proposed from what Kinextion already knows — profile, the habits
   * that are working and the ones that aren't, mood, wearable data, calendar
   * rhythm. `basis` names every signal that actually fed the proposals, so
   * the app can show its receipts rather than asking for trust.
   */
  app.post("/suggest", { config: ASSIST_RATE_LIMIT }, async (request, reply) => {
    const parsed = suggestHabitsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const context = await buildHabitContext(request.userId, {
      localHour: parsed.data.localHour,
      timeZone: parsed.data.timeZone ?? request.timeZone,
    });

    try {
      const drafts = await suggestHabits(context, parsed.data);
      return { success: true, data: { drafts, basis: context.basis } };
    } catch (err) {
      request.log.error({ err }, "habit suggestion failed");
      return reply.status(502).send({
        success: false,
        error: "Couldn't put suggestions together just now. Try again in a moment.",
      });
    }
  });

  /**
   * Talk it through instead of filling in a form. The client sends the short
   * transcript each turn and gets back a reply plus, once there's enough to
   * go on, drafts the user can accept. Nothing is saved here — accepting a
   * draft is a normal POST to this module.
   */
  app.post("/discover", { config: ASSIST_RATE_LIMIT }, async (request, reply) => {
    const parsed = discoverHabitsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const context = await buildHabitContext(request.userId, {
      localHour: parsed.data.localHour,
      timeZone: parsed.data.timeZone ?? request.timeZone,
    });

    try {
      const result = await discoverHabits(context, parsed.data.turns);
      return { success: true, data: { ...result, basis: context.basis } };
    } catch (err) {
      request.log.error({ err }, "habit discovery failed");
      return reply.status(502).send({
        success: false,
        error: "I lost my train of thought there. Say that again?",
      });
    }
  });

  // Log habit completion — ownership is enforced via the habit lookup below,
  // not the request body, so no one can log entries against another user's habit.
  app.post("/log", async (request, reply) => {
    const parsed = logHabitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { habitId, date, notes, value } = parsed.data;
    const state = parsed.data.state ?? "done";
    // A rest day never counts as done, whatever the client sent.
    const completed = state === "rest" ? false : parsed.data.completed;
    const source = parsed.data.source ?? "tap";

    /**
     * `date` is the user's own calendar day, sent by the client. Nothing can
     * be logged for a day that hasn't started yet. One day of slack, because
     * a client too old to send X-Time-Zone is judged against UTC, and east of
     * Greenwich the user's today is already UTC's tomorrow.
     */
    const today = request.localToday();
    if (date > addDays(today, 1)) {
      return reply.status(400).send({ success: false, error: "That day hasn't happened yet." });
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit || habit.userId !== request.userId) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    const day = dateFromKey(date);
    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date: day } },
      create: {
        habitId,
        userId: habit.userId,
        date: day,
        completed,
        notes,
        state,
        value,
        source: date < today && source === "tap" ? "backfill" : source,
      },
      update: { completed, notes, state, value, loggedAt: new Date() },
    });

    request.log.info(
      {
        event: "habit_logged",
        completed,
        state,
        source,
        backfill: date < today,
        frequency: habit.frequency,
      },
      "habit event"
    );

    // The score moves in the same round trip, so the app doesn't need a
    // second request before it can show the new number. `data` stays the
    // log itself for clients that predate `meta`.
    const score = await recomputeTodayScore(request.userId, request.timeZone);
    return { success: true, data: log, meta: { score } };
  });

  // Get habit logs for a date range
  app.get<{ Querystring: { from?: string; to?: string } }>("/logs", async (request) => {
    const { from, to } = request.query;
    const where: Record<string, unknown> = { userId: request.userId };

    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const logs = await prisma.habitLog.findMany({
      where,
      include: { habit: { select: { name: true, category: true } } },
      orderBy: { date: "desc" },
    });

    return { success: true, data: logs };
  });
}
