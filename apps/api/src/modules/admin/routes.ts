/**
 * Internal: the habits success measures, for the team.
 *
 * Only accounts listed in ADMIN_USER_IDS (comma-separated Clerk user ids)
 * get in; everyone else gets a 404, so the route doesn't advertise itself.
 * Aggregates only — nothing here identifies a person.
 */

import type { FastifyInstance } from "fastify";
import { getAuth } from "@clerk/fastify";
import { loadHabitMetrics } from "../../lib/habit-metrics.js";

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
    const days = Math.min(365, Math.max(7, Number(request.query.days) || 28));
    return { success: true, data: await loadHabitMetrics(days) };
  });
}
