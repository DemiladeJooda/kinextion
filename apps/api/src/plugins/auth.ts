import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { clerkPlugin, getAuth, clerkClient } from "@clerk/fastify";
import { prisma } from "@kinextion/database";

declare module "fastify" {
  interface FastifyRequest {
    /** Internal Prisma User.id for the authenticated caller — never trust a userId from params/body. */
    userId: string;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Registers Clerk session verification and a `requireAuth` preHandler that
 * resolves the caller's internal User row (creating it on first sight), so
 * every route downstream can use `request.userId` instead of trusting a
 * client-supplied id.
 *
 * Called directly (not via `app.register`) so the decorators it adds apply
 * to the root instance rather than being scoped to a child encapsulation
 * context.
 */
export async function registerAuth(app: FastifyInstance) {
  await app.register(clerkPlugin);

  app.decorateRequest("userId", "");

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId: clerkId } = getAuth(request);

    if (!clerkId) {
      return reply.status(401).send({ success: false, error: "Not authenticated" });
    }

    let user = await prisma.user.findUnique({ where: { clerkId } });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        return reply.status(400).send({ success: false, error: "Account has no email on file" });
      }

      user = await prisma.user.create({ data: { clerkId, email } });
    }

    request.userId = user.id;
  });
}
