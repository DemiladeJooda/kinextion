import type { FastifyInstance } from "fastify";
import { CommunityError } from "./errors.js";
import { getDiscover, getDiscoverResponse } from "./discover.js";
import type { CommunityDeps } from "./service.js";

/**
 * Public Discover. No session: the web's /discover page is open to anyone.
 * Tighter per-IP limits than the signed-in API, since there's no user to key on.
 */
const PUBLIC_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };

/** A client-chosen shuffle seed. Bounded, so it can't be used to smuggle anything. */
const cleanSeed = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : "public";

export async function discoverRoutes(app: FastifyInstance, options: { deps: CommunityDeps }) {
  const { deps } = options;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CommunityError) {
      return reply.status(error.statusCode).send({ success: false, error: error.message, code: error.code });
    }
    throw error;
  });

  app.get<{ Querystring: { seed?: string } }>("/", { config: PUBLIC_LIMIT }, async (request) => ({
    success: true,
    data: await getDiscover(deps, cleanSeed(request.query.seed)),
  }));

  app.get<{ Params: { id: string }; Querystring: { seed?: string } }>(
    "/responses/:id",
    { config: PUBLIC_LIMIT },
    async (request) => ({
      success: true,
      data: await getDiscoverResponse(deps, request.params.id, cleanSeed(request.query.seed)),
    })
  );
}
