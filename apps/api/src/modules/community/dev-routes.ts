import type { FastifyInstance } from "fastify";
import { devClockSchema } from "@kinextion/shared";
import { HOUR_MS, isAdjustable } from "./clock.js";
import { CommunityError } from "./errors.js";
import { runMaintenance } from "./maintenance.js";
import type { CommunityDeps } from "./service.js";

/**
 * Development tools: a movable clock, so a whole week can be walked in a
 * minute instead of seven days.
 *
 * Registered only when NODE_ENV isn't production *and* COMMUNITY_DEV_TOOLS=1,
 * and deliberately outside the auth hook — driving the week from a terminal
 * shouldn't require minting a session token. That's only defensible because
 * the routes cannot exist in production; the server refuses to register them
 * there, and a test asserts it.
 */
export async function communityDevRoutes(app: FastifyInstance, options: { deps: CommunityDeps }) {
  const { deps } = options;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CommunityError) {
      return reply.status(error.statusCode).send({ success: false, error: error.message, code: error.code });
    }
    throw error;
  });

  app.get("/clock", async () => ({
    success: true,
    data: { now: deps.clock.now().toISOString(), adjustable: isAdjustable(deps.clock) },
  }));

  /** Move the clock, then run maintenance so everything that "happened" in between happens. */
  app.post("/clock", async (request, reply) => {
    const parsed = devClockSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
        code: "INVALID",
      });
    }
    if (!isAdjustable(deps.clock)) {
      throw new CommunityError(409, "CLOCK_FIXED", "This server's clock can't be moved.");
    }
    if (parsed.data.to) deps.clock.set(parsed.data.to);
    if (parsed.data.advanceHours) deps.clock.advance(parsed.data.advanceHours * HOUR_MS);

    const report = await runMaintenance(deps);
    return { success: true, data: { now: deps.clock.now().toISOString(), report } };
  });

  app.post("/maintenance", async () => ({ success: true, data: await runMaintenance(deps) }));
}
