/**
 * What each model call costs, and for whom.
 *
 * Every call records its token counts and a list-price cost against the
 * person it was for. The person comes from the request (see
 * `registerAIUsageContext`), so the AI service doesn't need a user id
 * threaded through every function; work outside a request, like the
 * nightly memory compaction, names its user with `asAIUser`.
 *
 * Recording never gets in the way of a reply: it happens after the call,
 * isn't awaited, and a failed write is logged and dropped.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import type { AITask } from "@kinextion/shared";

// ─── Prices ───────────────────────────────────────────────────────────────────

interface Rates {
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute cache writes, 1.25× input. */
  cacheWrite: number;
}

/**
 * List prices in dollars per million tokens, which is also millionths of a
 * dollar per token — so tokens × rate is the cost in micros, no conversion.
 * The models AI_TASKS uses, plus the ones a refusal fallback can land on.
 * Checked 24 Oct 2026; update when Anthropic changes prices.
 */
export const AI_PRICES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** A model missing from the table is priced high rather than free, so a
 *  gap shows up as overspend instead of hiding. */
const UNKNOWN_RATES: Rates = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

function ratesFor(model: string): Rates {
  if (AI_PRICES[model]) return AI_PRICES[model];
  // Dated or suffixed ids ("claude-opus-5-5-…") price as their base model.
  const base = Object.keys(AI_PRICES)
    .filter((k) => model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return base ? AI_PRICES[base] : UNKNOWN_RATES;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function costMicros(model: string, t: TokenCounts): number {
  const r = ratesFor(model);
  return Math.round(
    t.inputTokens * r.input +
      t.outputTokens * r.output +
      t.cacheReadTokens * r.cacheRead +
      t.cacheWriteTokens * r.cacheWrite
  );
}

// ─── Reading a response ───────────────────────────────────────────────────────

interface TokenFields {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

interface UsageLike extends TokenFields {
  iterations?: ReadonlyArray<TokenFields & { type: string; model?: string }> | null;
}

export interface CallUsage extends TokenCounts {
  model: string;
  costMicros: number;
}

const tokensOf = (u: TokenFields): TokenCounts => ({
  inputTokens: u.input_tokens ?? 0,
  outputTokens: u.output_tokens ?? 0,
  cacheReadTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});

/**
 * Tokens and cost for one response, or null when it carries no usage.
 *
 * When a refusal fallback ran, `usage.iterations` lists each model's share
 * and each is priced at its own model's rate; otherwise the whole call is
 * priced at the model that answered.
 */
export function usageOf(
  response: { model?: string | null; usage?: UsageLike | null },
  requestedModel: string
): CallUsage | null {
  const usage = response.usage;
  if (!usage) return null;
  const model = response.model || requestedModel;

  const parts = (usage.iterations ?? []).filter(
    (it) => it.type === "message" || it.type === "fallback_message"
  );
  if (parts.length === 0) {
    const t = tokensOf(usage);
    return { model, ...t, costMicros: costMicros(model, t) };
  }

  const total: CallUsage = { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: 0 };
  for (const part of parts) {
    const t = tokensOf(part);
    total.inputTokens += t.inputTokens;
    total.outputTokens += t.outputTokens;
    total.cacheReadTokens += t.cacheReadTokens;
    total.cacheWriteTokens += t.cacheWriteTokens;
    total.costMicros += costMicros(part.model || model, t);
  }
  return total;
}

// ─── Who it was for ───────────────────────────────────────────────────────────

/** `request.userId` is filled in by requireAuth after this context opens,
 *  so the request itself is held and read when a call is recorded. */
type Context = { request: { userId: string } } | { userId: string | null };

const context = new AsyncLocalStorage<Context>();

/**
 * Opens a usage context for every request. Callback-style so the rest of
 * the request — later hooks, the handler and anything it starts — runs
 * inside it. Register on the root instance, before the routes.
 */
export function registerAIUsageContext(app: FastifyInstance) {
  app.addHook("onRequest", (request, _reply, done) => {
    context.run({ request }, done);
  });
}

/** Runs `fn` with its model calls charged to `userId` — for work outside a request. */
export function asAIUser<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  return context.run({ userId }, fn);
}

export function currentAIUser(): string | null {
  const store = context.getStore();
  if (!store) return null;
  return ("request" in store ? store.request.userId : store.userId) || null;
}

// ─── Recording ────────────────────────────────────────────────────────────────

/**
 * Records one call. Fire and forget: never awaited by the caller, never
 * throws, and a response without usage (a test double) records nothing.
 */
export function recordAIUsage(
  task: AITask,
  requestedModel: string,
  response: { model?: string | null; usage?: UsageLike | null }
): void {
  try {
    const usage = usageOf(response, requestedModel);
    if (!usage) return;
    void prisma.aiUsage
      .create({ data: { userId: currentAIUser(), task, ...usage } })
      .catch((err: unknown) => {
        console.warn("[ai-usage] not recorded:", err instanceof Error ? err.message : err);
      });
  } catch (err) {
    console.warn("[ai-usage] not recorded:", err instanceof Error ? err.message : err);
  }
}
