import type { FastifyInstance } from "fastify";
import { clerkClient, getAuth } from "@clerk/fastify";
import { prisma, Prisma } from "@kinextion/database";
import { onboardingSchema, updateProfileSchema } from "@kinextion/shared";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Get the authenticated user's profile
  app.get("/me/profile", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { profile: true },
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: "User not found" });
    }

    return { success: true, data: user };
  });

  // Complete onboarding
  app.post("/me/onboard", async (request, reply) => {
    const parsed = onboardingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const data = parsed.data;
    const userId = request.userId;

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName,
        age: data.age,
        fitnessLevel: data.fitnessLevel,
        primaryGoals: data.primaryGoals,
        weeklyAvailability: data.weeklyAvailability,
        equipment: data.equipment ?? [],
        identityGoal: data.identityGoal,
        preferences: data.preferences as Prisma.InputJsonValue | undefined,
        onboardingComplete: true,
      },
      update: {
        displayName: data.displayName,
        age: data.age,
        fitnessLevel: data.fitnessLevel,
        primaryGoals: data.primaryGoals,
        weeklyAvailability: data.weeklyAvailability,
        equipment: data.equipment ?? [],
        ...(data.identityGoal ? { identityGoal: data.identityGoal } : {}),
        ...(data.preferences ? { preferences: data.preferences as Prisma.InputJsonValue } : {}),
        onboardingComplete: true,
      },
    });

    return { success: true, data: profile };
  });

  /**
   * Edit the profile after onboarding.
   *
   * Only the fields sent are written, so changing the spiritual dial doesn't
   * require resending someone's goals. `preferences` is merged rather than
   * replaced for the same reason one level deeper: it's a single Json column
   * holding unrelated settings, and a notification change must not wipe the
   * dial sitting beside it.
   */
  app.patch("/me/profile", async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const userId = request.userId;
    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      return reply
        .status(404)
        .send({ success: false, error: "No profile yet — finish onboarding first." });
    }

    const body = parsed.data;
    const data: Prisma.ProfileUpdateInput = {};

    if ("displayName" in body) data.displayName = body.displayName;
    if ("avatarId" in body) data.avatarId = body.avatarId ?? null;
    if ("age" in body) data.age = body.age ?? null;
    if ("fitnessLevel" in body) data.fitnessLevel = body.fitnessLevel;
    if ("primaryGoals" in body) data.primaryGoals = body.primaryGoals as Prisma.InputJsonValue;
    if ("weeklyAvailability" in body) data.weeklyAvailability = body.weeklyAvailability;
    if ("equipment" in body) data.equipment = body.equipment as Prisma.InputJsonValue;
    if ("identityGoal" in body) data.identityGoal = body.identityGoal ?? null;
    if ("background" in body) {
      data.background = body.background
        ? (body.background as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }

    if (body.preferences) {
      const current = (existing.preferences as Record<string, unknown> | null) ?? {};
      data.preferences = { ...current, ...body.preferences } as Prisma.InputJsonValue;
    }

    const profile = await prisma.profile.update({ where: { userId }, data });
    return { success: true, data: profile };
  });

  /**
   * What Kinextion is holding on this account.
   *
   * Counts rather than content: enough for someone to see the shape of what's
   * stored without the screen itself becoming a second copy of their journal.
   * Every number is a live count, not an estimate.
   */
  app.get("/me/data-summary", async (request) => {
    const userId = request.userId;

    const [
      habits,
      habitLogs,
      checkIns,
      reflections,
      conversations,
      messages,
      memoryFacts,
      wearableMetrics,
      recommendations,
      scores,
      integrations,
      share,
      earliest,
    ] = await Promise.all([
      prisma.habit.count({ where: { userId } }),
      prisma.habitLog.count({ where: { userId } }),
      prisma.moodEntry.count({ where: { userId } }),
      prisma.moodEntry.count({
        where: {
          userId,
          OR: [{ journal: { not: null } }, { gratitude: { not: null } }],
        },
      }),
      prisma.conversation.count({ where: { userId } }),
      prisma.message.count({ where: { conversation: { userId } } }),
      prisma.memoryFact.count({ where: { userId } }),
      prisma.wearableMetric.count({ where: { userId } }),
      prisma.recommendation.count({ where: { userId } }),
      prisma.kinextionScore.count({ where: { userId } }),
      prisma.integration.findMany({ where: { userId }, select: { provider: true, status: true } }),
      prisma.therapistShare.findUnique({ where: { userId } }),
      prisma.habitLog.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
    ]);

    return {
      success: true,
      data: {
        counts: {
          habits,
          habitLogs,
          checkIns,
          reflections,
          conversations,
          messages,
          memoryFacts,
          wearableMetrics,
          recommendations,
          scores,
        },
        connected: integrations.map((i: { provider: string; status: string }) => i.provider),
        therapistSharing: share?.active
          ? Object.entries((share.categories as Record<string, boolean>) ?? {})
              .filter(([, on]) => on)
              .map(([name]) => name)
          : [],
        since: earliest?.date ?? null,
      },
    };
  });

  /**
   * Delete the account and everything attached to it.
   *
   * Both app stores require in-app account deletion for apps with accounts,
   * and it has to be a real delete rather than a deactivation flag.
   *
   * Order matters: application rows go first (every relation cascades from
   * `User`), and the Clerk identity goes last. If the Clerk call fails after
   * the data is gone, the user is left with an identity that owns nothing —
   * recoverable. The reverse would leave orphaned health data with no owner
   * and no way to reach it, which is not.
   */
  app.delete("/me", async (request, reply) => {
    const { userId: clerkId } = getAuth(request);
    if (!clerkId) {
      return reply.status(401).send({ success: false, error: "Not authenticated" });
    }

    // Cascades through profile, conversations, messages, habits, logs,
    // workouts, moods, scores, integrations, wearable metrics, memory facts,
    // rollups, therapist share and reports — see schema.prisma onDelete.
    await prisma.user.delete({ where: { id: request.userId } });

    try {
      await clerkClient.users.deleteUser(clerkId);
    } catch (err) {
      // The user's data is already gone, which is what they asked for. Log
      // loudly so the dangling Clerk identity gets cleaned up out of band.
      request.log.error(
        { err, clerkId },
        "user data deleted but Clerk identity remains — needs manual cleanup"
      );
    }

    return { success: true, data: { deleted: true } };
  });
}
