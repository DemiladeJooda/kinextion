/**
 * Health data that lives on the phone: Apple Health and Android's Health
 * Connect.
 *
 * Unlike Strava or Oura there's no server-to-server API and no OAuth: the
 * app asks the phone for permission, reads daily totals itself, and posts
 * them here. So "connecting" just records that the user switched it on, and
 * each sync is the app sending the last few days. From then on it's the
 * same as any other source: stored as daily metrics, and habits linked to
 * it log themselves.
 *
 * Only one figure per day is accepted (steps, workout and sleep minutes,
 * resting heart rate, HRV, blood pressure, weight, active calories), never
 * individual samples, and only for the last week.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@kinextion/database";
import { addDays, dateFromKey, DEVICE_HEALTH_PROVIDERS } from "@kinextion/shared";
import { autoLogFromMetrics } from "../../lib/auto-log.js";

const providerSchema = z.enum(DEVICE_HEALTH_PROVIDERS);

const ingestSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().date(),
        steps: z.number().int().min(0).max(200_000).optional(),
        workoutMinutes: z.number().min(0).max(1440).optional(),
        sleepMinutes: z.number().min(0).max(1440).optional(),
        restingHeartRate: z.number().min(20).max(250).optional(),
        hrv: z.number().min(1).max(400).optional(),
        /** The day's average blood pressure reading, when they took one. */
        systolic: z.number().min(60).max(260).optional(),
        diastolic: z.number().min(30).max(160).optional(),
        weightKg: z.number().min(20).max(400).optional(),
        activeCalories: z.number().min(0).max(10_000).optional(),
      })
    )
    .min(1)
    .max(7),
});

export function registerDeviceHealthRoutes(app: FastifyInstance) {
  app.post<{ Params: { provider: string } }>(
    "/device/:provider/connect",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const provider = providerSchema.safeParse(request.params.provider);
      if (!provider.success) return reply.status(404).send({ success: false, error: "Unknown provider" });
      const row = await prisma.integration.upsert({
        where: { userId_provider: { userId: request.userId, provider: provider.data } },
        create: { userId: request.userId, provider: provider.data, status: "connected" },
        update: { status: "connected", lastError: null },
      });
      return { success: true, data: { id: row.id, provider: row.provider, status: row.status } };
    }
  );

  app.post<{ Params: { provider: string } }>(
    "/device/:provider/ingest",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const provider = providerSchema.safeParse(request.params.provider);
      if (!provider.success) return reply.status(404).send({ success: false, error: "Unknown provider" });
      const body = ingestSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({ success: false, error: body.error.issues.map((i) => i.message).join(", ") });
      }

      const integration = await prisma.integration.findUnique({
        where: { userId_provider: { userId: request.userId, provider: provider.data } },
      });
      if (!integration || integration.status === "disconnected") {
        return reply.status(404).send({ success: false, error: "Not connected" });
      }

      // The last week only, nothing in the future (a day of slack for zones).
      const today = request.localToday();
      const days = body.data.days.filter((d) => d.date <= addDays(today, 1) && d.date >= addDays(today, -7));
      const metrics = days.flatMap((d) => [
        ...(d.steps != null ? [{ metricType: "steps", date: d.date, value: d.steps, unit: "steps" }] : []),
        ...(d.workoutMinutes != null ? [{ metricType: "workout", date: d.date, value: Math.round(d.workoutMinutes), unit: "min" }] : []),
        ...(d.sleepMinutes != null ? [{ metricType: "sleep_duration", date: d.date, value: Math.round(d.sleepMinutes), unit: "min" }] : []),
        ...(d.restingHeartRate != null ? [{ metricType: "resting_heart_rate", date: d.date, value: Math.round(d.restingHeartRate), unit: "bpm" }] : []),
        ...(d.hrv != null ? [{ metricType: "hrv", date: d.date, value: Math.round(d.hrv), unit: "ms" }] : []),
        // Blood pressure only as a pair; half a reading means nothing.
        ...(d.systolic != null && d.diastolic != null
          ? [
              { metricType: "blood_pressure_systolic", date: d.date, value: Math.round(d.systolic), unit: "mmHg" },
              { metricType: "blood_pressure_diastolic", date: d.date, value: Math.round(d.diastolic), unit: "mmHg" },
            ]
          : []),
        ...(d.weightKg != null ? [{ metricType: "weight", date: d.date, value: Math.round(d.weightKg * 10) / 10, unit: "kg" }] : []),
        ...(d.activeCalories != null ? [{ metricType: "active_calories", date: d.date, value: Math.round(d.activeCalories), unit: "kcal" }] : []),
      ]);

      for (const m of metrics) {
        await prisma.wearableMetric.upsert({
          where: {
            userId_provider_metricType_date: {
              userId: request.userId,
              provider: provider.data,
              metricType: m.metricType,
              date: dateFromKey(m.date),
            },
          },
          create: {
            userId: request.userId,
            integrationId: integration.id,
            provider: provider.data,
            metricType: m.metricType,
            date: dateFromKey(m.date),
            value: m.value,
            unit: m.unit,
          },
          update: { value: m.value, unit: m.unit },
        });
      }
      await prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date(), status: "connected", lastError: null },
      });

      const autoLogged = await autoLogFromMetrics(request.userId, request.timeZone, provider.data, metrics);
      return { success: true, data: { synced: metrics.length, autoLogged } };
    }
  );
}
