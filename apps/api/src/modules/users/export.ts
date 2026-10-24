/**
 * Download my data: everything Kinextion holds that the user created or
 * that's about them, as one JSON file.
 *
 * Left out on purpose:
 *   - OAuth tokens for connected services (secrets, not data).
 *   - What other people wrote: other members' room responses, comments and
 *     reactions. Your own are included.
 *   - Raw provider payloads, which are large and opaque; the daily values
 *     derived from them are included.
 * Recorded audio and video are listed by id and length; the files
 * themselves stay where they're stored.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";

export const EXPORT_VERSION = 1;

export async function buildExport(userId: string) {
  const where = { userId };
  const [
    user,
    profile,
    habits,
    habitLogs,
    precommitments,
    reflections,
    automaticityChecks,
    awayPeriods,
    habitShares,
    workouts,
    checkIns,
    recommendations,
    scores,
    conversations,
    memoryFacts,
    integrations,
    wearableMetrics,
    therapistShare,
    therapistReports,
    memberships,
    roomResponses,
    roomComments,
    roomReactions,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
    prisma.profile.findUnique({ where }),
    prisma.habit.findMany({ where }),
    prisma.habitLog.findMany({ where, orderBy: { date: "asc" } }),
    prisma.precommitment.findMany({ where }),
    prisma.habitReflection.findMany({ where }),
    prisma.automaticityCheck.findMany({ where }),
    prisma.awayPeriod.findMany({ where }),
    prisma.habitShare.findMany({ where }),
    prisma.workoutLog.findMany({ where }),
    prisma.moodEntry.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.recommendation.findMany({ where }),
    prisma.kinextionScore.findMany({ where }),
    prisma.conversation.findMany({
      where,
      include: { messages: { select: { role: true, content: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.memoryFact.findMany({ where }),
    prisma.integration.findMany({
      where,
      select: { provider: true, status: true, lastSyncedAt: true, createdAt: true },
    }),
    prisma.wearableMetric.findMany({
      where,
      select: { provider: true, metricType: true, date: true, value: true, unit: true },
      orderBy: { date: "asc" },
    }),
    prisma.therapistShare.findUnique({ where }),
    prisma.therapistReport.findMany({ where }),
    prisma.communityMembership.findMany({
      where,
      include: { community: { select: { name: true } } },
    }),
    prisma.roomResponse.findMany({
      where,
      select: { id: true, topicId: true, visibility: true, status: true, durationSec: true, createdAt: true, publishedAt: true },
    }),
    prisma.roomComment.findMany({ where, select: { id: true, responseId: true, body: true, createdAt: true, deletedAt: true } }),
    prisma.roomReaction.findMany({ where, select: { responseId: true, verdict: true, createdAt: true } }),
  ]);

  return {
    kinextionExport: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    account: user,
    profile,
    habits: { habits, logs: habitLogs, promises: precommitments, reflections, automaticityChecks, awayPeriods, shares: habitShares },
    workouts,
    checkIns,
    recommendations,
    scores,
    conversations,
    memoryFacts,
    connections: { integrations, dailyReadings: wearableMetrics },
    therapist: { share: therapistShare, reports: therapistReports },
    communities: {
      memberships: memberships.map((m) => ({ community: m.community.name, role: m.role, joinedAt: m.joinedAt, leftAt: m.leftAt })),
      yourResponses: roomResponses,
      yourComments: roomComments,
      yourReactions: roomReactions,
    },
  };
}

export function registerExportRoute(app: FastifyInstance) {
  app.get("/me/export", { config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (request, reply) => {
    const data = await buildExport(request.userId);
    request.log.info({ event: "data_exported" }, "account event");
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="kinextion-export-${new Date().toISOString().slice(0, 10)}.json"`)
      .header("Cache-Control", "no-store")
      .send(JSON.stringify(data, null, 2));
  });
}
