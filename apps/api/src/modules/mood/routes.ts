import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { createMoodEntrySchema } from "@kinextion/shared";

export async function moodRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Create mood entry
  app.post("/", async (request, reply) => {
    const parsed = createMoodEntrySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const entry = await prisma.moodEntry.create({
      data: { userId: request.userId, ...parsed.data },
    });

    return reply.status(201).send({ success: true, data: entry });
  });

  // Get mood history
  app.get<{ Querystring: { limit?: string } }>("/", async (request) => {
    const limit = parseInt(request.query.limit || "30", 10);

    const entries = await prisma.moodEntry.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { success: true, data: entries };
  });

  // Get latest mood
  app.get("/latest", async (request) => {
    const entry = await prisma.moodEntry.findFirst({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: entry };
  });
}
