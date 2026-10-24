import Anthropic from "@anthropic-ai/sdk";
import { aiTask, type AITask, type ChatMessage, type Persona } from "@kinextion/shared";
import { guidanceFor } from "../../../lib/guidance.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AIFailure {
  /** HTTP status to send the app. */
  status: number;
  /** Stable code the app can branch on. */
  code: "ai_unavailable" | "ai_busy" | "ai_unreachable" | "ai_error";
  /** Safe to show a user. */
  message: string;
  /** For the server log: what actually went wrong. */
  cause: string;
}

/**
 * What a failed model call means, for the person waiting on it and for
 * whoever reads the logs. Account problems (no credits, a bad key) are the
 * operator's to fix, so users get a calm "unavailable" while the log says
 * exactly which. Uses the SDK's typed errors; the one exception is the
 * credit-balance case, which the API reports as a plain 400 with no class
 * of its own.
 */
export function describeAIFailure(err: unknown): AIFailure {
  const unavailable = "The guides are unavailable right now. Your habits and check-ins still work — try again a little later.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, code: "ai_unavailable", message: unavailable, cause: "Anthropic API key rejected" };
  }
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    return {
      status: 503,
      code: "ai_unavailable",
      message: unavailable,
      cause: "Anthropic account is out of credits (Plans & Billing)",
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      status: 503,
      code: "ai_busy",
      message: "The guides are busy right now. Give it a minute and try again.",
      cause: "Anthropic rate limit",
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      status: 503,
      code: "ai_unreachable",
      message: "Couldn't reach the guides just now. Try again in a moment.",
      cause: "Could not connect to Anthropic",
    };
  }
  const status = err instanceof Anthropic.APIError ? err.status : undefined;
  return {
    status: 502,
    code: "ai_error",
    message: "Something went wrong on our side. Try again?",
    cause: `Anthropic call failed${status ? ` (${status})` : ""}: ${err instanceof Error ? err.message : String(err)}`,
  };
}

// ─── Requests ─────────────────────────────────────────────────────────────────

/**
 * Model, effort and refusal fallbacks for a task.
 *
 * Opus 5.5 and Sonnet 5.5 can decline a request their safety classifiers
 * flag; a wellness app sees plenty of text about bodies, food and feelings
 * that can trip them. `fallbacks: "default"` re-runs a declined request on
 * a model suited to the category, inside the same call, so the user gets an
 * answer rather than a refusal. Haiku has no server-side fallback.
 */
function requestFor(task: AITask) {
  const t = aiTask(task);
  return {
    model: t.model,
    max_tokens: t.maxTokens,
    output_config: { effort: t.effort },
    ...(t.tier === "light"
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
  };
}

/** The system prompt plus whatever the team's notes say for this task. */
function withGuidance(system: string, task: AITask, persona?: Persona): string {
  const notes = guidanceFor(task, persona);
  return notes ? `${system}\n\n${notes}` : system;
}

function toApiMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m) => ({
    role: m.role === "system" ? "user" : (m.role as "user" | "assistant"),
    content: m.content,
  }));
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Send a conversation to a guide and get the whole reply at once.
 */
export async function sendToAI(
  persona: Persona,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const response = await anthropic.beta.messages.create({
    ...requestFor("chat"),
    system: withGuidance(systemPrompt, "chat", persona),
    messages: toApiMessages(messages),
  });
  if (response.stop_reason === "refusal") {
    return "That's not something I can help with here — but if it's weighing on you, I'm listening.";
  }
  return textOf(response.content) || "I'm here for you. Could you tell me more?";
}

// ─── Structured output ────────────────────────────────────────────────────────

const UNSUPPORTED = ["minLength", "maxLength", "minimum", "maximum", "multipleOf", "minItems", "maxItems"];

function describeLimits(node: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof node.maxLength === "number") parts.push(`at most ${node.maxLength} characters`);
  if (typeof node.minLength === "number" && node.minLength > 0) parts.push(`at least ${node.minLength} characters`);
  if (typeof node.minimum === "number" && typeof node.maximum === "number") {
    parts.push(`from ${node.minimum} to ${node.maximum}`);
  } else if (typeof node.minimum === "number") parts.push(`at least ${node.minimum}`);
  else if (typeof node.maximum === "number") parts.push(`at most ${node.maximum}`);
  if (typeof node.maxItems === "number") parts.push(`at most ${node.maxItems} items`);
  if (typeof node.minItems === "number" && node.minItems > 0) parts.push(`at least ${node.minItems} items`);
  return parts.length ? parts.join(", ") : null;
}

/**
 * A JSON Schema rewritten for structured outputs, which accept a subset:
 * every object needs `additionalProperties: false`, and length, number and
 * item-count limits aren't supported. Those limits move into the field's
 * description, so the model still sees them, and callers keep validating
 * the result with Zod — the limits are enforced there, not trusted.
 */
export function toStructuredSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStructuredSchema);
  if (!schema || typeof schema !== "object") return schema;

  const node = { ...(schema as Record<string, unknown>) };
  const limits = describeLimits(node);
  for (const key of UNSUPPORTED) delete node[key];
  if (limits) {
    node.description = node.description ? `${node.description} (${limits})` : `(${limits})`;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "properties" && value && typeof value === "object") {
      node.properties = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toStructuredSchema(v)])
      );
    } else if (key === "items" || key === "anyOf" || key === "allOf") {
      node[key] = toStructuredSchema(value);
    }
  }
  if (node.type === "object") node.additionalProperties = false;
  return node;
}

export class AIRefusalError extends Error {
  constructor() {
    super("The model declined this request");
    this.name = "AIRefusalError";
  }
}

/**
 * Ask a model for a typed object rather than prose.
 *
 * Uses structured outputs (`output_config.format`): the API constrains the
 * reply to the schema, so it always parses. (The previous version forced a
 * tool call, which Opus 5.5 and Sonnet 5.5 no longer accept.) Callers still
 * validate the contents with Zod — this guarantees shape, not sense.
 *
 * `task` picks the model and effort (see AI_TASKS in @kinextion/shared) and
 * which of the team's guidance notes apply. `toolName` and
 * `toolDescription` are kept as the output's name and purpose, for logs
 * and for the model.
 */
export async function generateStructured<T>(params: {
  task: AITask;
  system: string;
  messages: ChatMessage[];
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the result — this is the output contract. */
  inputSchema: Record<string, unknown>;
  /** Overrides the task's budget, for unusually small or large replies. */
  maxTokens?: number;
}): Promise<T> {
  const base = requestFor(params.task);
  const response = await anthropic.beta.messages.create({
    ...base,
    ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
    system: withGuidance(
      `${params.system}\n\nReply with the ${params.toolName} object: ${params.toolDescription}`,
      params.task
    ),
    output_config: {
      ...base.output_config,
      format: { type: "json_schema", schema: toStructuredSchema(params.inputSchema) as Record<string, unknown> },
    },
    messages: toApiMessages(params.messages),
  });

  if (response.stop_reason === "refusal") throw new AIRefusalError();
  if (response.stop_reason === "max_tokens") throw new Error("Structured reply was cut off");

  const text = textOf(response.content);
  if (!text) throw new Error("Model returned no structured output");
  return JSON.parse(text) as T;
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

/**
 * A guide's reply, streamed.
 *
 * Calls `onDelta` for each chunk and resolves with the complete text, so the
 * caller can write to the wire as it arrives *and* still persist the finished
 * reply. The conversation is cached (top-level `cache_control`): each turn
 * resends the same system prompt and history, and a cache read costs a
 * tenth of fresh input.
 */
export async function streamFromAI(
  persona: Persona,
  systemPrompt: string,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const stream = anthropic.beta.messages.stream(
    {
      ...requestFor("chat"),
      cache_control: { type: "ephemeral" },
      system: withGuidance(systemPrompt, "chat", persona),
      messages: toApiMessages(messages),
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

  // Safety classifiers can decline before any text is produced (and after
  // the fallback model, if it declined too).
  if (final.stop_reason === "refusal" && !full) {
    const message =
      "That's not something I can help with here — but if it's weighing on you, I'm listening.";
    onDelta(message);
    return message;
  }

  return full || "I'm here for you. Could you tell me more?";
}

// ─── Chat that can act ────────────────────────────────────────────────────────

/** Rounds of tool use per reply — enough to create a habit and then talk
 *  about it, never an open-ended loop. */
const MAX_TOOL_ROUNDS = 4;

export interface ToolRun {
  /** What the model is told. */
  result: string;
  isError?: boolean;
}

/**
 * A guide's reply that can take actions in the app.
 *
 * Streams text as it arrives; when the guide calls a tool, runs it through
 * `runTool`, hands the result back, and keeps streaming the rest of the
 * reply. The assistant's content — thinking, fallback and tool blocks
 * included — goes back unchanged each round, as the API requires.
 */
export async function streamChatWithTools(params: {
  persona: Persona;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: Anthropic.Beta.BetaTool[];
  runTool: (name: string, input: unknown) => Promise<ToolRun>;
  onText: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const history: Anthropic.Beta.BetaMessageParam[] = toApiMessages(params.messages);
  const system = withGuidance(params.systemPrompt, "chat", params.persona);
  let full = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = anthropic.beta.messages.stream(
      {
        ...requestFor("chat"),
        cache_control: { type: "ephemeral" },
        system,
        tools: params.tools,
        messages: history,
      },
      { signal: params.signal }
    );

    let firstText = true;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        // A sentence before a tool call and one after it shouldn't run
        // together — only at the join, never inside the new round's words.
        if (firstText && full && !/\s$/.test(full) && !/^\s/.test(event.delta.text)) {
          full += " ";
          params.onText(" ");
        }
        firstText = false;
        full += event.delta.text;
        params.onText(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" && !full) {
      const message =
        "That's not something I can help with here — but if it's weighing on you, I'm listening.";
      params.onText(message);
      return message;
    }
    if (final.stop_reason !== "tool_use") break;

    history.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });

    const calls = final.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
    );
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      let outcome: ToolRun;
      try {
        outcome = await params.runTool(call.name, call.input);
      } catch (err) {
        outcome = { result: `That didn't work: ${err instanceof Error ? err.message : "unknown error"}`, isError: true };
      }
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: outcome.result,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    // Every result in one message, so the model keeps making parallel calls.
    history.push({ role: "user", content: results });
  }

  return full || "Done.";
}
