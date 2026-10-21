import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { computePeriodScore, recomputeTodayScore, type ScorePeriod } from "../../lib/score.js";

export async function scoreRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Get today's Kinextion Score for the authenticated user.
  // The computation itself lives in lib/score.ts, shared with the check-in
  // route so both surfaces can never disagree about the same day.
  app.get("/today", async (request) => {
    return { success: true, data: await recomputeTodayScore(request.userId, request.timeZone) };
  });

  // The headline number shown on the home screen — a period average rather
  // than a single day, scoped to whatever window the user picked in Profile
  // (default weekly). See lib/score.ts computePeriodScore for why.
  app.get("/period", async (request) => {
    const profile = await prisma.profile.findUnique({ where: { userId: request.userId } });
    const preferences = (profile?.preferences as { scorePeriod?: ScorePeriod } | null) ?? null;
    const period = preferences?.scorePeriod ?? "weekly";
    return { success: true, data: await computePeriodScore(request.userId, period, request.timeZone) };
  });

  // Get score history
  app.get<{ Querystring: { days?: string } }>("/history", async (request) => {
    const days = parseInt(request.query.days || "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const scores = await prisma.kinextionScore.findMany({
      where: {
        userId: request.userId,
        date: { gte: since },
      },
      orderBy: { date: "asc" },
    });

    return { success: true, data: scores };
  });
}
