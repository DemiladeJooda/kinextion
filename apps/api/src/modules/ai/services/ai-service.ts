import Anthropic from "@anthropic-ai/sdk";
import { AI_CONFIG } from "@kinextion/shared";
import type { ChatMessage, Persona } from "@kinextion/shared";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Send a conversation to Claude and get a response.
 * Uses the appropriate model tier based on the persona.
 */
export async function sendToAI(
  persona: Persona,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const config = AI_CONFIG[persona];

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content,
    })),
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "I'm here for you. Could you tell me more?";
}
