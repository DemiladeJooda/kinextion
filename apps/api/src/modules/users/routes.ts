import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { onboardingSchema } from "@kinextion/shared";

export async function userRoutes(app: FastifyInstance) {
  // Get user profile
  app.get<{ Params: { userId: string } }>("/:userId/profile", async (request, reply) => {
    const { userId } = request.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return reply.status(404).send({ success: false, error: "User not found" });
    }

    return { success: true, data: user };
  });

  // Complete onboarding
  app.post<{ Params: { userId: string } }>("/:userId/onboard", async (request, reply) => {
    const { userId } = request.params;
    const parsed = onboardingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const data = parsed.data;

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
        onboardingComplete: true,
      },
      update: {
        displayName: data.displayName,
        age: data.age,
        fitnessLevel: data.fitnessLevel,
        primaryGoals: data.primaryGoals,
        weeklyAvailability: data.weeklyAvailability,
        equipment: data.equipment ?? [],
        onboardingComplete: true,
      },
    });

    return { success: true, data: profile };
  });
}
