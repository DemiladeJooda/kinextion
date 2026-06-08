import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { createHabitSchema, logHabitSchema } from "@kinextion/shared";

export async function habitRoutes(app: FastifyInstance) {
  // List user habits
  app.get<{ Params: { userId: string } }>("/:userId", async (request) => {
    const habits = await prisma.habit.findMany({
      where: { userId: request.params.userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: habits };
  });

  // Create a habit
  app.post<{ Params: { userId: string } }>("/:userId", async (request, reply) => {
    const parsed = createHabitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const habit = await prisma.habit.create({
      data: { userId: request.params.userId, ...parsed.data },
    });

    return reply.status(201).send({ success: true, data: habit });
  });

  // Log habit completion
  app.post("/log", async (request, reply) => {
    const parsed = logHabitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { habitId, date, completed, notes } = parsed.data;

    const habit = await prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit) {
      return reply.status(404).send({ success: false, error: "Habit not found" });
    }

    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date: new Date(date) } },
      create: {
        habitId,
        userId: habit.userId,
        date: new Date(date),
        completed,
        notes,
      },
      update: { completed, notes },
    });

    return { success: true, data: log };
  });

  // Get habit logs for a date range
  app.get<{
    Params: { userId: string };
    Querystring: { from?: string; to?: string };
  }>("/:userId/logs", async (request) => {
    const { from, to } = request.query;
    const where: Record<string, unknown> = { userId: request.params.userId };

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
