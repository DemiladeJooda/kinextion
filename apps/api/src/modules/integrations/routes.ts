import type { FastifyInstance } from "fastify";
import { autoLogFromMetrics } from "../../lib/auto-log.js";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma, type Prisma } from "@kinextion/database";
import { decryptToken, encryptToken } from "../../lib/crypto.js";
import { computePatterns } from "../../lib/patterns.js";
import { PROVIDERS } from "./providers/index.js";

/**
 * Kinextion connects to other apps, not just people. This module owns
 * OAuth for wearables/third-party services (Strava, Whoop, Oura today),
 * and the metrics pulled from each once connected.
 */

function stateSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY is required to sign OAuth state");
  return secret;
}

/** Callback requests come from the provider's server, not the app, so they
 * can't carry a Clerk bearer token — identity travels in this signed state
 * instead, verified with an HMAC so it can't be forged or reused across users. */
function signState(userId: string, provider: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${provider}.${nonce}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string): { userId: string; provider: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [userId, provider, nonce, sig] = parts;
    const expected = createHmac("sha256", stateSecret())
      .update(`${userId}.${provider}.${nonce}`)
      .digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { userId, provider };
  } catch {
    return null;
  }
}

function redirectUriFor(provider: string): string {
  const base = (process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT || "3001"}`).replace(
    /\/$/,
    ""
  );
  return `${base}/api/integrations/${provider}/callback`;
}

/** Custom scheme the mobile app registers (app.json "scheme": "kinextion") —
 * the callback hands off here so the OAuth round trip lands back in-app. */
const DEEP_LINK_BASE = process.env.MOBILE_DEEP_LINK_URL ?? "kinextion://integrations/callback";

export async function integrationRoutes(app: FastifyInstance) {
  // What's connected, and which providers are switched on server-side.
  app.get("/", { preHandler: app.requireAuth }, async (request) => {
    const integrations = await prisma.integration.findMany({
      where: { userId: request.userId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const available = Object.fromEntries(
      Object.entries(PROVIDERS).map(([id, provider]) => [id, provider.isConfigured()])
    );

    return { success: true, data: { integrations, available } };
  });

  // Start connecting a provider — returns the authorize URL for the app to open.
  app.post<{ Params: { provider: string } }>(
    "/:provider/connect",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const provider = PROVIDERS[request.params.provider];
      if (!provider) {
        return reply.status(404).send({ success: false, error: "Unknown provider" });
      }
      if (!provider.isConfigured()) {
        return reply.status(503).send({
          success: false,
          error: `${provider.id} isn't switched on yet — the integration is built, but no API credentials are configured.`,
        });
      }

      const state = signState(request.userId, provider.id);
      const authorizeUrl = provider.getAuthorizeUrl(state, redirectUriFor(provider.id));
      return { success: true, data: { authorizeUrl } };
    }
  );

  // OAuth callback — public. The provider's server hits this directly.
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>("/:provider/callback", async (request, reply) => {
    const providerId = request.params.provider;
    const provider = PROVIDERS[providerId];
    const { code, state, error } = request.query;

    const fail = (reason: string) =>
      reply.redirect(
        `${DEEP_LINK_BASE}?status=error&provider=${providerId}&reason=${encodeURIComponent(reason)}`
      );

    if (error) return fail(error);
    if (!provider || !code || !state) return fail("invalid_request");

    const verified = verifyState(state);
    if (!verified || verified.provider !== providerId) return fail("invalid_state");

    try {
      const tokens = await provider.exchangeCode(code, redirectUriFor(providerId));

      await prisma.integration.upsert({
        where: { userId_provider: { userId: verified.userId, provider: providerId } },
        create: {
          userId: verified.userId,
          provider: providerId,
          status: "connected",
          externalUserId: tokens.externalUserId,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        },
        update: {
          status: "connected",
          externalUserId: tokens.externalUserId,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
          tokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
          lastError: null,
        },
      });

      return reply.redirect(`${DEEP_LINK_BASE}?status=success&provider=${providerId}`);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "unknown_error");
    }
  });

  // Disconnect a provider.
  app.delete<{ Params: { provider: string } }>(
    "/:provider",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const result = await prisma.integration.deleteMany({
        where: { userId: request.userId, provider: request.params.provider },
      });
      if (result.count === 0) {
        return reply.status(404).send({ success: false, error: "Not connected" });
      }
      return { success: true, data: { disconnected: true } };
    }
  );

  // Pull the latest data from a connected provider into WearableMetric rows.
  app.post<{ Params: { provider: string } }>(
    "/:provider/sync",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const providerId = request.params.provider;
      const provider = PROVIDERS[providerId];
      if (!provider) {
        return reply.status(404).send({ success: false, error: "Unknown provider" });
      }

      const integration = await prisma.integration.findUnique({
        where: { userId_provider: { userId: request.userId, provider: providerId } },
      });
      if (!integration || !integration.accessToken) {
        return reply.status(404).send({ success: false, error: "Not connected" });
      }

      const since = integration.lastSyncedAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      try {
        let accessToken = decryptToken(integration.accessToken);

        if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date() && integration.refreshToken) {
          const refreshed = await provider.refresh(decryptToken(integration.refreshToken));
          accessToken = refreshed.accessToken;
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              accessToken: encryptToken(refreshed.accessToken),
              refreshToken: refreshed.refreshToken
                ? encryptToken(refreshed.refreshToken)
                : integration.refreshToken,
              tokenExpiresAt: refreshed.expiresAt,
            },
          });
        }

        const metrics = await provider.fetchMetrics(accessToken, since);

        for (const m of metrics) {
          await prisma.wearableMetric.upsert({
            where: {
              userId_provider_metricType_date: {
                userId: request.userId,
                provider: providerId,
                metricType: m.metricType,
                date: new Date(m.date),
              },
            },
            create: {
              userId: request.userId,
              integrationId: integration.id,
              provider: providerId,
              metricType: m.metricType,
              date: new Date(m.date),
              value: m.value,
              unit: m.unit,
              raw: m.raw as Prisma.InputJsonValue | undefined,
            },
            update: {
              value: m.value,
              unit: m.unit,
              raw: m.raw as Prisma.InputJsonValue | undefined,
            },
          });
        }

        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncedAt: new Date(), status: "connected", lastError: null },
        });

        // Habits linked to this service tick themselves, shown and undoable.
        const autoLogged = await autoLogFromMetrics(request.userId, request.timeZone, providerId, metrics);

        return { success: true, data: { synced: metrics.length, autoLogged } };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        await prisma.integration.update({
          where: { id: integration.id },
          data: { status: "error", lastError: message },
        });
        return reply.status(502).send({ success: false, error: message });
      }
    }
  );

  // Stored metrics — powers charts in the app and the AI interpretation layer.
  app.get<{ Querystring: { type?: string; from?: string; to?: string } }>(
    "/metrics",
    { preHandler: app.requireAuth },
    async (request) => {
      const { type, from, to } = request.query;
      const where: Record<string, unknown> = { userId: request.userId };
      if (type) where.metricType = type;
      if (from || to) {
        where.date = {};
        if (from) (where.date as Record<string, unknown>).gte = new Date(from);
        if (to) (where.date as Record<string, unknown>).lte = new Date(to);
      }

      const metrics = await prisma.wearableMetric.findMany({ where, orderBy: { date: "desc" } });
      return { success: true, data: metrics };
    }
  );

  // Computed patterns — real correlations between wearable data, mood, and
  // habits, or an empty list when there isn't enough overlap to say anything.
  app.get("/patterns", { preHandler: app.requireAuth }, async (request) => {
    const patterns = await computePatterns(request.userId);
    return { success: true, data: patterns };
  });
}
