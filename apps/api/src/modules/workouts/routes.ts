import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import { logWorkoutSchema } from "@kinextion/shared";
import { recomputeTodayScore } from "../../lib/score.js";

/**
 * Workout logging.
 *
 * The WorkoutLog table and the score's 20 workout points existed with no way
 * to write a row, so nobody could ever earn them. This is the write path:
 * small on purpose, because the logging screen it serves is built for three
 * taps, not a spreadsheet.
 */
export async function workoutRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  app.post("/", async (request, reply) => {
    const parsed = logWorkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const workout = await prisma.workoutLog.create({
      data: {
        userId: request.userId,
        ...parsed.data,
        exercises: parsed.data.exercises as Prisma.InputJsonValue,
      },
    });

    request.log.info({ event: "workout_logged", type: workout.type }, "workout event");

    // Same round trip as the habit log: the score moves the moment the
    // sheet closes.
    const score = await recomputeTodayScore(request.userId, request.timeZone);
    return reply.status(201).send({ success: true, data: workout, meta: { score } });
  });

  app.get<{ Querystring: { limit?: string } }>("/", async (request) => {
    const limit = Math.min(Math.max(parseInt(request.query.limit || "20", 10) || 20, 1), 100);
    const workouts = await prisma.workoutLog.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { success: true, data: workouts };
  });

  /** Undo for a mis-tap. Scoped delete, so another user's id is just a 404. */
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const result = await prisma.workoutLog.deleteMany({
      where: { id: request.params.id, userId: request.userId },
    });
    if (result.count === 0) {
      return reply.status(404).send({ success: false, error: "Workout not found" });
    }
    const score = await recomputeTodayScore(request.userId, request.timeZone);
    return { success: true, data: { deleted: true }, meta: { score } };
  });
}
