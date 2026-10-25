/**
 * Internal: the habits success measures and what the guides cost, for the team.
 *
 * Only accounts listed in ADMIN_USER_IDS (comma-separated Clerk user ids)
 * get in; everyone else gets a 404, so the route doesn't advertise itself.
 * Aggregates only — nothing here identifies a person.
 */

import type { FastifyInstance } from "fastify";
import { getAuth } from "@clerk/fastify";
import { loadHabitMetrics } from "../../lib/habit-metrics.js";
import { loadAICostMetrics } from "../../lib/ai-cost-metrics.js";

/** The report window: 7 to 365 days, 28 by default. */
const windowDays = (raw?: string) => Math.min(365, Math.max(7, Number(raw) || 28));

export function adminIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);
  app.addHook("preHandler", async (request, reply) => {
    const clerkId = getAuth(request).userId;
    if (!clerkId || !adminIds().has(clerkId)) {
      return reply.status(404).send({ success: false, error: "Not found" });
    }
  });

  app.get<{ Querystring: { days?: string } }>("/metrics", async (request) => {
    return { success: true, data: await loadHabitMetrics(windowDays(request.query.days)) };
  });

  /** What the guides cost, per person and per task. */
  app.get<{ Querystring: { days?: string } }>("/ai-costs", async (request) => {
    return { success: true, data: await loadAICostMetrics(windowDays(request.query.days)) };
  });
}
