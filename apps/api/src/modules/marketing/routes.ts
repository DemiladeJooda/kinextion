/**
 * The two public endpoints the marketing site needs.
 *
 * Public means public: no Clerk token, because a visitor deciding whether to
 * sign up doesn't have one. That makes both of these the most exposed surface
 * in the API, so each carries its own tight rate limit on top of the global
 * one, neither returns anything a scraper would want, and neither can be used
 * to find out whether a given email is already on the list.
 *
 * They live in apps/api rather than in a Next route because this process owns
 * the Prisma pool — putting a database client in a serverless function on the
 * web side would open a connection per invocation.
 */

import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@kinextion/database";
import { analyticsBatchSchema, waitlistSignupSchema } from "@kinextion/shared";

export async function marketingRoutes(app: FastifyInstance) {
  /**
   * Join the waitlist.
   *
   * Idempotent by email: signing up twice updates the existing row rather than
   * erroring, and the response is identical either way. A different response
   * for "already on the list" would turn this into an email-enumeration oracle
   * for anyone who wanted one.
   */
  app.post(
    "/waitlist",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = waitlistSignupSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: "That doesn't look like an email address.",
        });
      }

      const { email, source, sessionId } = parsed.data;

      try {
        await prisma.waitlistEntry.upsert({
          where: { email: email.toLowerCase() },
          create: { email: email.toLowerCase(), source, sessionId },
          // Keep the original signup date; refresh where they came from.
          update: { source, sessionId },
        });
      } catch (err) {
        request.log.error({ err }, "waitlist signup failed");
        return reply.status(500).send({
          success: false,
          error: "Couldn't save that just now. Try again in a moment.",
        });
      }

      return { success: true, data: { joined: true } };
    }
  );

  /**
   * Analytics ingest.
   *
   * Accepts a batch because the client buffers events and flushes on a timer
   * or on page hide — one request per tab click would be both wasteful and
   * unreliable, since a visitor who leaves mid-flush is exactly the drop-off
   * this is meant to measure.
   *
   * Writes are best-effort and always answer 202: a dropped analytics event is
   * not worth an error in a visitor's console, and certainly not worth
   * retrying against.
   */
  app.post(
    "/events",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = analyticsBatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(202).send({ success: true, data: { accepted: 0 } });
      }

      const { sessionId, events } = parsed.data;

      try {
        await prisma.analyticsEvent.createMany({
          data: events.map((e) => ({
            sessionId,
            name: e.name,
            tab: e.tab,
            props: (e.props ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        });
      } catch (err) {
        request.log.warn({ err }, "analytics batch dropped");
      }

      return reply.status(202).send({ success: true, data: { accepted: events.length } });
    }
  );
}
