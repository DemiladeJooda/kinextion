import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import { generateTherapistReportSchema, therapistCategoriesSchema } from "@kinextion/shared";
import { buildTherapistReport, EMPTY_CATEGORIES, type TherapistShareCategories } from "../../lib/therapist-report.js";

/**
 * The Therapist Starter Pack. We don't provide therapists — this hands the
 * licensed therapist a user already has real context, so they aren't
 * starting from zero. Every category is opt-in, off by default, and
 * revocable; nothing here is shared automatically or sent anywhere by us —
 * the user reviews and sends the report themselves.
 */

function readCategories(raw: Prisma.JsonValue | null): TherapistShareCategories {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_CATEGORIES;
  const c = raw as Record<string, unknown>;
  return {
    habits: c.habits === true,
    moodTrends: c.moodTrends === true,
    journalExcerpts: c.journalExcerpts === true,
    patterns: c.patterns === true,
    score: c.score === true,
  };
}

export async function therapistRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  // Current consent state — "not set up" (all false, inactive) if the user
  // has never opted into anything.
  app.get("/consent", async (request) => {
    const share = await prisma.therapistShare.findUnique({ where: { userId: request.userId } });
    return {
      success: true,
      data: {
        active: share?.active ?? false,
        categories: share ? readCategories(share.categories) : EMPTY_CATEGORIES,
        updatedAt: share?.updatedAt ?? null,
      },
    };
  });

  // Set which categories are shared. Turning every category off is
  // equivalent to revoking — there's no state where sharing is on but
  // nothing is actually shared.
  app.put("/consent", async (request, reply) => {
    const parsed = therapistCategoriesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const categories = parsed.data;
    const anyOn = Object.values(categories).some(Boolean);

    const share = await prisma.therapistShare.upsert({
      where: { userId: request.userId },
      create: { userId: request.userId, categories, active: anyOn },
      update: { categories, active: anyOn, revokedAt: anyOn ? null : new Date() },
    });

    return { success: true, data: { active: share.active, categories: readCategories(share.categories) } };
  });

  // Revoke entirely. Past reports already generated/shared are untouched —
  // this stops future sharing, it doesn't unshare what already left the app.
  app.post("/consent/revoke", async (request) => {
    const share = await prisma.therapistShare.upsert({
      where: { userId: request.userId },
      create: { userId: request.userId, categories: EMPTY_CATEGORIES, active: false, revokedAt: new Date() },
      update: { categories: EMPTY_CATEGORIES, active: false, revokedAt: new Date() },
    });
    return { success: true, data: { active: share.active, categories: readCategories(share.categories) } };
  });

  // Generate a new report from currently-consented categories.
  app.post("/reports", async (request, reply) => {
    const parsed = generateTherapistReportSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const share = await prisma.therapistShare.findUnique({ where: { userId: request.userId } });
    const categories = share ? readCategories(share.categories) : EMPTY_CATEGORIES;

    if (!share?.active || !Object.values(categories).some(Boolean)) {
      return reply.status(400).send({
        success: false,
        error: "Nothing is opted in yet — choose what to share before generating a report.",
      });
    }

    const summary = await buildTherapistReport(request.userId, categories, parsed.data.days, request.timeZone);

    const report = await prisma.therapistReport.create({
      data: {
        userId: request.userId,
        shareId: share.id,
        periodStart: new Date(summary.periodStart),
        periodEnd: new Date(summary.periodEnd),
        summary: summary as unknown as Prisma.InputJsonValue,
      },
    });

    return reply.status(201).send({ success: true, data: report });
  });

  // Past reports — metadata only, so the list is cheap to render.
  app.get("/reports", async (request) => {
    const reports = await prisma.therapistReport.findMany({
      where: { userId: request.userId },
      select: { id: true, periodStart: true, periodEnd: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: reports };
  });

  // Full content of one report.
  app.get<{ Params: { id: string } }>("/reports/:id", async (request, reply) => {
    const report = await prisma.therapistReport.findUnique({ where: { id: request.params.id } });
    if (!report || report.userId !== request.userId) {
      return reply.status(404).send({ success: false, error: "Report not found" });
    }
    return { success: true, data: report };
  });
}
