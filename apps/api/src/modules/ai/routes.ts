import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import { sendMessageSchema } from "@kinextion/shared";
import { buildContext, getGreeting } from "@kinextion/ai-core";
import { sendToAI } from "./services/ai-service.js";
import type { ChatMessage, Persona, UserProfile } from "@kinextion/shared";

export async function chatRoutes(app: FastifyInstance) {
  // Send a message to Altheo or Kairo
  app.post<{ Params: { userId: string } }>("/:userId/message", async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { userId } = request.params;
    const { persona, content, conversationId } = parsed.data;

    // Get or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const convo = await prisma.conversation.create({
        data: { userId, persona },
      });
      convoId = convo.id;
    }

    // Save user message
    await prisma.message.create({
      data: { conversationId: convoId, role: "user", content },
    });

    // Build context
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const recentMood = await prisma.moodEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const chatMessages: ChatMessage[] = recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));

    const ctx = buildContext(persona as Persona, {
      profile: profile as UserProfile | null,
      recentMood: recentMood
        ? {
            mood: recentMood.mood,
            energy: recentMood.energy ?? undefined,
            stress: recentMood.stress ?? undefined,
            tags: (recentMood.tags as string[]) ?? undefined,
          }
        : undefined,
    }, chatMessages);

    // Get AI response
    const aiResponse = await sendToAI(persona as Persona, ctx.systemPrompt, ctx.messages);

    // Save assistant message
    await prisma.message.create({
      data: {
        conversationId: convoId,
        role: "assistant",
        content: aiResponse,
      },
    });

    return {
      success: true,
      data: {
        conversationId: convoId,
        message: aiResponse,
        persona,
      },
    };
  });

  // Get conversation history
  app.get<{
    Params: { userId: string };
    Querystring: { persona?: string };
  }>("/:userId/conversations", async (request) => {
    const { persona } = request.query;
    const where: Record<string, unknown> = { userId: request.params.userId };
    if (persona) where.persona = persona;

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return { success: true, data: conversations };
  });

  // Get greeting from a persona
  app.get<{ Params: { persona: string } }>("/greeting/:persona", async (request) => {
    const persona = request.params.persona as Persona;
    return {
      success: true,
      data: { message: getGreeting(persona), persona },
    };
  });
}
