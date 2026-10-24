import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "@kinextion/database";
import { sendMessageSchema } from "@kinextion/shared";
import { getGreeting } from "@kinextion/ai-core";
import {
  describeAIFailure,
  sendToAI,
  streamChatWithTools,
  streamFromAI,
} from "./services/ai-service.js";
import {
  CHAT_ACTIONS_PROMPT,
  CHAT_TOOLS,
  runChatTool,
  undoChatAction,
  undoSpecSchema,
  type ChatAction,
  type ToolContext,
} from "./chat-tools.js";
import { prepareTurn, resolveConversation } from "./conversation.js";
import { compactConversation } from "../../lib/memory/store.js";
import type { ChatMessage, Persona } from "@kinextion/shared";

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

    const turn = await prepareTurn(
      request.userId,
      convo.id,
      persona as Persona,
      content,
      topicId,
      request.timeZone
    );
    let aiResponse: string;
    try {
      aiResponse = await sendToAI(persona as Persona, turn.systemPrompt, turn.messages);
    } catch (err) {
      const failure = describeAIFailure(err);
      app.log.error({ err, cause: failure.cause, conversationId: convo.id }, "chat failed");
      return reply
        .status(failure.status)
        .send({ success: false, error: failure.message, code: failure.code });
    }

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

    const turn = await prepareTurn(
      request.userId,
      convo.id,
      persona as Persona,
      content,
      topicId,
      request.timeZone
    );

    // Client navigated away or hit stop → abort upstream so we stop paying
    // for tokens nobody will read.
    const controller = new AbortController();
    request.raw.on("close", () => controller.abort());

    // Newer apps ask for events: text plus action cards, with the guide able
    // to act in the app. Older builds keep the plain-text stream.
    if (request.headers["x-chat-protocol"] === "events") {
      return streamEvents(request, reply, convo.id, persona as Persona, turn, controller);
    }

    /**
     * Headers wait for the first chunk of text. Committing to a 200 before
     * the model has answered meant a failure (no credits, a bad key, an
     * outage) arrived as a reply bubble saying "Something went wrong" — it
     * looked like the guide talking. Until text flows, a failure can still
     * be a real error response the app shows as one.
     */
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      reply.raw.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
        // Stops nginx and friends buffering the stream into one chunk.
        "X-Accel-Buffering": "no",
        "X-Conversation-Id": convo.id,
      });
    };

    let full = "";
    let streamed = "";
    try {
      full = await streamFromAI(
        persona as Persona,
        turn.systemPrompt,
        turn.messages,
        (chunk) => {
          start();
          streamed += chunk;
          reply.raw.write(chunk);
        },
        controller.signal
      );
    } catch (err) {
      if (controller.signal.aborted) {
        if (started) reply.raw.end();
        return reply;
      }
      const failure = describeAIFailure(err);
      app.log.error({ err, cause: failure.cause, conversationId: convo.id }, "chat stream failed");
      if (!started) {
        return reply
          .status(failure.status)
          .header("X-Conversation-Id", convo.id)
          .send({ success: false, error: failure.message, code: failure.code });
      }
      // Cut off mid-reply: keep what arrived and say so.
      reply.raw.write("\n\n(I got cut off there — say that again?)");
      full = streamed;
    }
    reply.raw.end();

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

  /**
   * The chat as newline-delimited JSON events:
   *   {"t":"text","v":"…"}       part of the reply
   *   {"t":"action","action":{…}} something the guide did, with its Undo
   *   {"t":"error","v":"…"}      it went wrong after text had started
   *   {"t":"done"}
   * Headers still wait for the first event, so a failure before anything is
   * said is a real error response, as on the plain-text route.
   */
  async function streamEvents(
    request: FastifyRequest,
    reply: FastifyReply,
    conversationId: string,
    persona: Persona,
    turn: { systemPrompt: string; messages: ChatMessage[] },
    controller: AbortController
  ) {
    let started = false;
    const send = (event: Record<string, unknown>) => {
      if (!started) {
        started = true;
        reply.raw.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-store",
          "X-Accel-Buffering": "no",
          "X-Conversation-Id": conversationId,
        });
      }
      reply.raw.write(`${JSON.stringify(event)}\n`);
    };

    const ctx: ToolContext = {
      userId: request.userId,
      timeZone: request.timeZone,
      log: request.log,
      created: 0,
    };
    const actions: ChatAction[] = [];
    let streamed = "";

    try {
      const full = await streamChatWithTools({
        persona,
        systemPrompt: `${turn.systemPrompt}\n\n${CHAT_ACTIONS_PROMPT}`,
        messages: turn.messages,
        tools: CHAT_TOOLS,
        onText: (v) => {
          streamed += v;
          send({ t: "text", v });
        },
        runTool: async (name, input) => {
          const outcome = await runChatTool(name, input, ctx);
          request.log.info({ event: "chat_tool", name, ok: !outcome.isError }, "chat event");
          if (outcome.action) {
            actions.push(outcome.action);
            send({ t: "action", action: outcome.action });
          }
          return outcome;
        },
        signal: controller.signal,
      });
      streamed = full;
    } catch (err) {
      if (controller.signal.aborted) {
        if (started) reply.raw.end();
        return reply;
      }
      const failure = describeAIFailure(err);
      app.log.error({ err, cause: failure.cause, conversationId }, "chat stream failed");
      if (!started) {
        return reply
          .status(failure.status)
          .header("X-Conversation-Id", conversationId)
          .send({ success: false, error: failure.message, code: failure.code });
      }
      send({ t: "error", v: "I got cut off there — say that again?" });
    }
    send({ t: "done" });
    reply.raw.end();

    // The transcript keeps the words plus a short note of what was done, so
    // the next turn knows ("Added: Push-ups") without storing tool traffic.
    const note = actions.length ? `\n\n[${actions.map((a) => a.title).join("; ")}]` : "";
    if (streamed || note) {
      await prisma.message.create({
        data: { conversationId, role: "assistant", content: `${streamed}${note}`.trim() },
      });
      compactInBackground(conversationId);
    }
    return reply;
  }

  /** Undo an action from its card in the chat. */
  app.post("/me/actions/undo", async (request, reply) => {
    const parsed = z.object({ undo: undoSpecSchema }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Nothing to undo." });
    }
    const ok = await undoChatAction(request.userId, request.timeZone, parsed.data.undo, request.log);
    if (!ok) return reply.status(404).send({ success: false, error: "That's already gone." });
    return { success: true, data: { undone: true } };
  });

  // Get greeting from a persona.
  app.get<{ Params: { persona: string } }>("/greeting/:persona", async (request) => {
    const persona = request.params.persona as Persona;
    return { success: true, data: { message: getGreeting(persona), persona } };
  });
}
