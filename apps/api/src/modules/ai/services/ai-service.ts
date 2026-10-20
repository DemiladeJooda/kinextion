import Anthropic from "@anthropic-ai/sdk";
import { AI_CONFIG, ASSIST_AI_CONFIG } from "@kinextion/shared";
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

/**
 * Ask the model for a typed object rather than prose.
 *
 * Uses a forced tool call instead of "reply with JSON": the API validates the
 * arguments against the schema before they ever reach us, so there's no fenced
 * code block to strip, no trailing comma to repair, and no half-written object
 * when the model runs long. Callers still parse the result with Zod — this
 * guarantees well-formed JSON, not that the contents are sane.
 */
export async function generateStructured<T>(params: {
  system: string;
  messages: ChatMessage[];
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool's input — this is the output contract. */
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const response = await anthropic.messages.create({
    model: ASSIST_AI_CONFIG.model,
    max_tokens: params.maxTokens ?? ASSIST_AI_CONFIG.maxTokens,
    system: params.system,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema as Anthropic.Tool.InputSchema,
      },
    ],
    // Leaves the model no option to answer in prose.
    tool_choice: { type: "tool", name: params.toolName },
    messages: params.messages.map((m) => ({
      role: m.role === "system" ? "user" : (m.role as "user" | "assistant"),
      content: m.content,
    })),
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model returned no structured output");
  }

  return block.input as T;
}

/**
 * Same request, streamed.
 *
 * Calls `onDelta` for each chunk and resolves with the complete text, so the
 * caller can write to the wire as it arrives *and* still persist the finished
 * reply. The first chunk is awaited before the caller commits to a 200 —
 * otherwise an auth or billing failure would arrive after headers were
 * already sent, and the client would see a truncated body instead of an error.
 */
export async function streamFromAI(
  persona: Persona,
  systemPrompt: string,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const config = AI_CONFIG[persona];

  const stream = anthropic.messages.stream(
    {
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      })),
    },
    { signal }
  );

  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      full += event.delta.text;
      onDelta(event.delta.text);
    }
  }

  const final = await stream.finalMessage();

  // Safety classifiers can decline before any text is produced.
  if (final.stop_reason === "refusal" && !full) {
    const message =
      "That's not something I can help with here — but if it's weighing on you, I'm listening.";
    onDelta(message);
    return message;
  }

  return full || "I'm here for you. Could you tell me more?";
}
