import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { validateEnv } from "./lib/env.js";
import { registerAuth } from "./plugins/auth.js";
import { registerTimeZone } from "./plugins/time-zone.js";
import { userRoutes } from "./modules/users/routes.js";
import { habitRoutes } from "./modules/habits/routes.js";
import { workoutRoutes } from "./modules/workouts/routes.js";
import { moodRoutes } from "./modules/mood/routes.js";
import { checkInRoutes } from "./modules/checkin/routes.js";
import { recommendationRoutes } from "./modules/recommendations/routes.js";
import { marketingRoutes } from "./modules/marketing/routes.js";
import { chatRoutes } from "./modules/ai/routes.js";
import { scoreRoutes } from "./modules/score/routes.js";
import { integrationRoutes } from "./modules/integrations/routes.js";
import { therapistRoutes } from "./modules/therapist/routes.js";
import { nearbyRoutes } from "./modules/nearby/routes.js";
import { communityRoutes } from "./modules/community/routes.js";
import { discoverRoutes } from "./modules/community/discover-routes.js";
import { communityDevRoutes } from "./modules/community/dev-routes.js";
import { createCommunityDeps, setSharedCommunityDeps } from "./modules/community/deps.js";
import type { CommunityDeps } from "./modules/community/service.js";
import { adminRoutes } from "./modules/admin/routes.js";

interface BuildOptions {
  /** Tests run the real server against an in-memory community store and a manual clock. */
  communityDeps?: CommunityDeps;
  /** Force the community dev routes on or off, regardless of COMMUNITY_DEV_TOOLS. Never on in production. */
  communityDevTools?: boolean;
}

async function buildApp(options: BuildOptions = {}) {
  const env = validateEnv();

  const app = Fastify({
    logger: {
      level: env.isProduction ? "info" : "debug",
      redact: {
        // Health data plus bearer tokens — neither belongs in a log line,
        // and logs usually outlive the request by a long way.
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.content',
          'req.body.journal',
          'req.body.gratitude',
          // Habit discovery is a spoken conversation about someone's actual
          // life — same sensitivity as a journal entry, same treatment.
          'req.body.turns',
        ],
        censor: "[redacted]",
      },
    },
    // Trust the proxy's X-Forwarded-For so rate limiting keys on the real
    // client IP rather than the load balancer's.
    trustProxy: env.isProduction,
    // Health payloads are small; a large body is a mistake or an attack.
    bodyLimit: 1_048_576, // 1 MB
  });

  await app.register(helmet, {
    // The API serves JSON to native clients and the web app, never HTML,
    // so the browser-document directives don't apply.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    /**
     * Without this the browser is only offered GET, HEAD and POST, and every
     * PUT, PATCH or DELETE from the web app fails its preflight — which looks
     * like a network error in the app rather than a refusal. The phone never
     * noticed because native requests aren't subject to CORS.
     */
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });

  /**
   * Baseline limit across the whole API. The AI routes are far more
   * expensive per call and set their own tighter limit on top of this.
   */
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    // Authenticated users get their own bucket so one busy network doesn't
    // rate-limit everyone behind it.
    keyGenerator: (request) => request.userId || request.ip,
    // Must be a real Error carrying `statusCode` — the custom error handler
    // below reads that to decide the response, and a plain object would fall
    // through to the 500 branch.
    errorResponseBuilder: (_request, context) => {
      const seconds = Math.max(1, Math.ceil(context.ttl / 1000));
      const err = new Error(
        `Too many requests. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
      ) as Error & { statusCode: number };
      err.statusCode = 429;
      return err;
    },
  });

  /**
   * Never leak internals to a client.
   *
   * Fastify's default handler echoes the error message, which for a Prisma
   * failure can include column names and fragments of the query.
   */
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;

    if (status >= 500) {
      request.log.error({ err: error }, "unhandled error");
      return reply.status(500).send({
        success: false,
        error: "Something went wrong on our end.",
      });
    }

    // 4xx errors are the client's to fix, so the message is safe to pass on.
    return reply.status(status).send({ success: false, error: error.message });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ success: false, error: "Not found" })
  );

  // Health check — exempt from rate limiting so uptime probes never trip it.
  app.get("/health", { config: { rateLimit: false } }, async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  registerTimeZone(app);
  await registerAuth(app);

  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(habitRoutes, { prefix: "/api/habits" });
  await app.register(workoutRoutes, { prefix: "/api/workouts" });
  await app.register(moodRoutes, { prefix: "/api/mood" });
  await app.register(checkInRoutes, { prefix: "/api/checkin" });
  await app.register(recommendationRoutes, { prefix: "/api/recommendations" });
  await app.register(chatRoutes, { prefix: "/api/chat" });
  await app.register(scoreRoutes, { prefix: "/api/score" });
  await app.register(integrationRoutes, { prefix: "/api/integrations" });
  await app.register(therapistRoutes, { prefix: "/api/therapist" });
  await app.register(nearbyRoutes, { prefix: "/api/nearby" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  // A movable clock for walking a week in minutes. Never in production, and
  // never without asking for it.
  const communityDevTools =
    !env.isProduction && (options.communityDevTools ?? process.env.COMMUNITY_DEV_TOOLS === "1");
  const communityDeps = options.communityDeps ?? createCommunityDeps({ devTools: communityDevTools });
  // Shared with the guides' chat context, which runs outside the route plugins.
  setSharedCommunityDeps(communityDeps);

  await app.register(communityRoutes, {
    prefix: "/api/community",
    deps: communityDeps,
    devTools: communityDevTools,
  });
  // Public — anyone can browse what communities chose to share.
  await app.register(discoverRoutes, { prefix: "/api/discover", deps: communityDeps });
  if (communityDevTools) {
    // Unauthenticated on purpose, and impossible in production — see dev-routes.ts.
    await app.register(communityDevRoutes, { prefix: "/api/community/dev", deps: communityDeps });
  }
  // Public — the marketing site has no session to send. Registered last so
  // it reads as the exception it is.
  await app.register(marketingRoutes, { prefix: "/api" });

  return { app, env };
}

async function start() {
  let app;
  let env;

  try {
    ({ app, env } = await buildApp());
  } catch (err) {
    // Config problems are reported plainly — a stack trace here just buries
    // the list of missing variables.
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`Kinextion API running on http://${env.host}:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Finish in-flight requests before exiting so a deploy doesn't drop them.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      app.log.info(`${signal} received, shutting down`);
      await app.close();
      process.exit(0);
    });
  }
}

// Only listen when run directly — tests import buildApp and inject their own.
if (process.env.NODE_ENV !== "test") {
  start();
}

export { buildApp };
