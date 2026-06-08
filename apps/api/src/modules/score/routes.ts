import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { calculateKinextionScore, toDateString } from "@kinextion/shared";

export async function scoreRoutes(app: FastifyInstance) {
  // Get today's Kinextion Score
  app.get<{ Params: { userId: string } }>("/:userId/today", async (request) => {
    const { userId } = request.params;
    const todayStr = toDateString(new Date());
    const todayDate = new Date(todayStr);

    // Gather today's data
    const [habits, habitLogs, workoutLog, moodEntry] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, isActive: true },
      }),
      prisma.habitLog.findMany({
        where: { userId, date: todayDate },
      }),
      prisma.workoutLog.findFirst({
        where: {
          userId,
          createdAt: { gte: todayDate },
        },
      }),
      prisma.moodEntry.findFirst({
        where: {
          userId,
          createdAt: { gte: todayDate },
        },
      }),
    ]);

    // Calculate streak (consecutive days with at least one completed habit)
    let streakDays = 0;
    const checkDate = new Date(todayDate);
    for (let i = 0; i < 90; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const dayLogs = await prisma.habitLog.findMany({
        where: {
          userId,
          date: new Date(toDateString(checkDate)),
          completed: true,
        },
      });
      if (dayLogs.length === 0) break;
      streakDays++;
    }

    const completedToday = habitLogs.filter((l: { completed: boolean }) => l.completed).length;

    const score = calculateKinextionScore({
      habitsCompleted: completedToday,
      habitsTotal: habits.length,
      workoutLogged: !!workoutLog,
      moodCheckedIn: !!moodEntry,
      reflectionDone: !!(moodEntry?.journal || moodEntry?.gratitude),
      streakDays,
    });

    // Upsert score
    const savedScore = await prisma.kinextionScore.upsert({
      where: { userId_date: { userId, date: todayDate } },
      create: {
        userId,
        date: todayDate,
        overallScore: score,
        breakdown: {
          habitsCompleted: completedToday,
          habitsTotal: habits.length,
          workoutLogged: !!workoutLog,
          moodCheckedIn: !!moodEntry,
          reflectionDone: !!(moodEntry?.journal || moodEntry?.gratitude),
          streakDays,
        },
      },
      update: {
        overallScore: score,
        breakdown: {
          habitsCompleted: completedToday,
          habitsTotal: habits.length,
          workoutLogged: !!workoutLog,
          moodCheckedIn: !!moodEntry,
          reflectionDone: !!(moodEntry?.journal || moodEntry?.gratitude),
          streakDays,
        },
      },
    });

    return { success: true, data: savedScore };
  });

  // Get score history
  app.get<{
    Params: { userId: string };
    Querystring: { days?: string };
  }>("/:userId/history", async (request) => {
    const days = parseInt(request.query.days || "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const scores = await prisma.kinextionScore.findMany({
      where: {
        userId: request.params.userId,
        date: { gte: since },
      },
      orderBy: { date: "asc" },
    });

    return { success: true, data: scores };
  });
}
