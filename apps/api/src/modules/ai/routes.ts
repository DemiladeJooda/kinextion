import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { sendMessageSchema } from "@kinextion/shared";
import { getGreeting } from "@kinextion/ai-core";
import { sendToAI, streamFromAI } from "./services/ai-service.js";
import { prepareTurn, resolveConversation } from "./conversation.js";
import { compactConversation } from "../../lib/memory/store.js";
import type { Persona } from "@kinextion/shared";

/**
 * Each call is a model request plus a background summarisation, making this
 * the most expensive surface in the API and the one most worth capping.
 */
const CHAT_RATE_LIMIT = { rateLimit: { max: 20, timeWindow: "1 minute" } };

export async function chatRoutes(app: FastifyInstance) {
  // Must be `async`: Fastify's hook runner continues only when a hook returns
  // a promise, so a bare `return` here would hang the request forever.
  app.addHook("preHandler", async (request, reply) => {
    // /greeting/:persona carries no user data — leave it open.
    if (request.url.startsWith("/api/chat/greeting/")) return;
    await app.requireAuth(request, reply);
  });

  /**
   * Compaction is best-effort and off the reply path — the user already has
   * their answer, and a failed compaction should never surface as a failed
   * message. The nightly retention job catches whatever this misses.
   */
  const compactInBackground = (conversationId: string) => {
    void compactConversation(conversationId).catch((err) => {
      app.log.warn({ err, conversationId }, "background compaction failed");
    });
  };

  // Send a message and get the whole reply at once.
  app.post("/me/message", { config: CHAT_RATE_LIMIT }, async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { persona, content, conversationId, topicId } = parsed.data;
    const convo = await resolveConversation(request.userId, persona, conversationId);
    if ("error" in convo) {
      return reply.status(404).send({ success: false, error: "Conversation not found" });
    }

    const turn = await prepareTurn(request.userId, convo.id, persona as Persona, content, topicId);
    const aiResponse = await sendToAI(persona as Persona, turn.systemPrompt, turn.messages);

    await prisma.message.create({
      data: { conversationId: convo.id, role: "assistant", content: aiResponse },
    });

    compactInBackground(convo.id);

    return {
      success: true,
      data: { conversationId: convo.id, message: aiResponse, persona },
    };
  });

  /**
   * Same exchange, streamed as plain UTF-8 text.
   *
   * The conversation id travels in a response header rather than the body,
   * because the body is the reply text itself — a client streaming tokens
   * into a bubble can't also be parsing an envelope out of it.
   */
  app.post("/me/stream", { config: CHAT_RATE_LIMIT }, async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { persona, content, conversationId, topicId } = parsed.data;
    const convo = await resolveConversation(request.userId, persona, conversationId);
    if ("error" in convo) {
      return reply.status(404).send({ success: false, error: "Conversation not found" });
    }

    const turn = await prepareTurn(request.userId, convo.id, persona as Persona, content, topicId);

    // Client navigated away or hit stop → abort upstream so we stop paying
    // for tokens nobody will read.
    const controller = new AbortController();
    request.raw.on("close", () => controller.abort());

    reply.raw.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      // Stops nginx and friends buffering the stream into one chunk.
      "X-Accel-Buffering": "no",
      "X-Conversation-Id": convo.id,
    });

    let full = "";
    try {
      full = await streamFromAI(
        persona as Persona,
        turn.systemPrompt,
        turn.messages,
        (chunk) => reply.raw.write(chunk),
        controller.signal
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        app.log.error({ err, conversationId: convo.id }, "chat stream failed");
        // Headers are long gone, so the only honest options are to end the
        // stream or append a note the user can act on.
        reply.raw.write(
          full ? "\n\n(I got cut off there — say that again?)" : "Something went wrong — try again?"
        );
      }
    } finally {
      reply.raw.end();
    }

    // Persist whatever actually reached the user, even a partial reply —
    // otherwise the next turn's history would contradict what's on screen.
    if (full) {
      await prisma.message.create({
        data: { conversationId: convo.id, role: "assistant", content: full },
      });
      compactInBackground(convo.id);
    }

    return reply;
  });

  // Conversation history for the authenticated user.
  app.get<{ Querystring: { persona?: string } }>("/me/conversations", async (request) => {
    const { persona } = request.query;
    const where: Record<string, unknown> = { userId: request.userId };
    if (persona) where.persona = persona;

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    return { success: true, data: conversations };
  });

  // Get greeting from a persona.
  app.get<{ Params: { persona: string } }>("/greeting/:persona", async (request) => {
    const persona = request.params.persona as Persona;
    return { success: true, data: { message: getGreeting(persona), persona } };
  });
}
