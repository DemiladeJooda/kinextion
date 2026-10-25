/**
 * What each model call costs, and who it's charged to.
 *
 *   - Cost is tokens × list price, cache reads and writes at their own rates.
 *   - A refusal fallback is priced per model it ran on; an unknown model is
 *     priced high, never free.
 *   - The person comes from the request, even though requireAuth fills it in
 *     after the context opens; work outside a request names its own user.
 *   - Recording never blocks or breaks a reply.
 *   - The report turns grouped spend into per-user monthly figures, with no
 *     user ids in it.
 */

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@kinextion/database", () => ({ prisma: { aiUsage: { create: (...a: unknown[]) => create(...a) } } }));

const { asAIUser, costMicros, currentAIUser, recordAIUsage, registerAIUsageContext, usageOf } = await import(
  "../src/lib/ai-usage.js"
);
const { aiCostMetrics } = await import("../src/lib/ai-cost-metrics.js");

const tokens = (i: number, o: number, read = 0, write = 0) => ({
  inputTokens: i,
  outputTokens: o,
  cacheReadTokens: read,
  cacheWriteTokens: write,
});

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({});
});

describe("pricing", () => {
  it("prices Opus 5.5 input, output, cache reads and writes at their own rates", () => {
    // 2,000 × $4 + 500 × $20 + 10,000 × $0.20 + 1,000 × $5 per million
    expect(costMicros("claude-opus-5-5", tokens(2000, 500, 10_000, 1000))).toBe(8000 + 10_000 + 2000 + 5000);
  });

  it("prices Haiku 5.5 a fraction of Opus", () => {
    expect(costMicros("claude-haiku-5-5", tokens(2000, 500))).toBe(450);
  });

  it("prices a dated id as its base model, and an unknown one high", () => {
    expect(costMicros("claude-sonnet-5-5-20261001", tokens(1000, 0))).toBe(2000);
    expect(costMicros("some-new-model", tokens(1000, 0))).toBe(5000);
  });

  it("prices a fallback per model it ran on", () => {
    const u = usageOf(
      {
        model: "claude-opus-4-8",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          iterations: [
            { type: "message", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
            { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          ],
        },
      },
      "claude-opus-5-5"
    );
    expect(u).toMatchObject({ model: "claude-opus-4-8", inputTokens: 2000, outputTokens: 300 });
    expect(u!.costMicros).toBe(1000 * 4 + 100 * 20 + 1000 * 5 + 200 * 25);
  });

  it("has nothing to say about a response without usage", () => {
    expect(usageOf({ model: "claude-opus-5-5" }, "claude-opus-5-5")).toBeNull();
  });
});

describe("who a call is charged to", () => {
  it("is the signed-in person, set by auth after the context opened", async () => {
    const app = Fastify();
    registerAIUsageContext(app);
    app.decorateRequest("userId", "");
    app.addHook("preHandler", async (request) => {
      request.userId = "user_42";
    });
    app.get("/", async () => {
      await new Promise((r) => setTimeout(r, 1));
      return { user: currentAIUser() };
    });
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.json()).toEqual({ user: "user_42" });
    await app.close();
  });

  it("is no one on a signed-out request", async () => {
    const app = Fastify();
    registerAIUsageContext(app);
    app.decorateRequest("userId", "");
    app.get("/", async () => ({ user: currentAIUser() }));
    expect((await app.inject({ method: "GET", url: "/" })).json()).toEqual({ user: null });
    await app.close();
  });

  it("is whoever asAIUser names, outside a request", async () => {
    expect(currentAIUser()).toBeNull();
    expect(await asAIUser("user_7", async () => currentAIUser())).toBe("user_7");
    expect(await asAIUser(null, async () => currentAIUser())).toBeNull();
  });
});

describe("recording", () => {
  const reply = { model: "claude-opus-5-5", usage: { input_tokens: 100, output_tokens: 10 } };

  it("writes tokens and cost against the current person", async () => {
    await asAIUser("user_1", async () => recordAIUsage("coach", "claude-opus-5-5", reply));
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        task: "coach",
        model: "claude-opus-5-5",
        inputTokens: 100,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costMicros: 600,
      },
    });
  });

  it("records nothing for a response without usage", () => {
    recordAIUsage("chat", "claude-opus-5-5", { model: "claude-opus-5-5" });
    expect(create).not.toHaveBeenCalled();
  });

  it("never throws when the write fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    create.mockRejectedValue(new Error("db down"));
    expect(() => recordAIUsage("chat", "claude-opus-5-5", reply)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("the cost report", () => {
  const row = (task: string, calls: number, costMicros: number, cacheReadTokens = 0) => ({
    task,
    calls,
    costMicros,
    inputTokens: 1000,
    outputTokens: 100,
    cacheReadTokens,
    cacheWriteTokens: 0,
  });

  const m = aiCostMetrics({
    days: 15,
    from: new Date("2026-10-01T00:00:00Z"),
    to: new Date("2026-10-16T00:00:00Z"),
    byTask: [row("recommendation", 30, 600_000), row("chat", 40, 2_400_000, 3000)],
    byModel: [{ model: "claude-opus-5-5", calls: 70, costMicros: 3_000_000 }],
    byUser: [
      { userId: "a", calls: 50, costMicros: 2_000_000 },
      { userId: "b", calls: 15, costMicros: 500_000 },
      { userId: "c", calls: 4, costMicros: 300_000 },
      { userId: null, calls: 1, costMicros: 200_000 },
    ],
    activeUsers: 6,
  });

  it("spreads the whole bill over everyone active, as a 30-day month", () => {
    expect(m.totalUsd).toBe(3);
    expect(m.projectedMonthlyUsd).toBe(6);
    expect(m.monthly.perActiveUserUsd).toBe(1);
  });

  it("describes guide users separately, without the shared work", () => {
    expect(m.aiUsers).toBe(3);
    expect(m.monthly.perAIUserUsd).toBeCloseTo((2.8 * 2) / 3, 6);
    expect(m.monthly.medianAIUserUsd).toBe(1);
    expect(m.monthly.heaviestAIUserUsd).toBe(4);
    expect(m.unattributed).toEqual({ calls: 1, usd: 0.2 });
  });

  it("ranks tasks by spend and reports the cache share", () => {
    expect(m.byTask.map((t) => t.task)).toEqual(["chat", "recommendation"]);
    expect(m.byTask[0]).toMatchObject({ usd: 2.4, share: 0.8, avgCallUsd: 0.06 });
    expect(m.cacheReadShare).toBeCloseTo(3000 / 5000, 6);
  });

  it("carries no user ids", () => {
    expect(JSON.stringify(m)).not.toMatch(/"(a|b|c)"/);
  });

  it("is honest about an empty window", () => {
    const empty = aiCostMetrics({ days: 28, from: new Date(), to: new Date(), byTask: [], byModel: [], byUser: [], activeUsers: 0 });
    expect(empty.totalUsd).toBe(0);
    expect(empty.monthly.perActiveUserUsd).toBeNull();
    expect(empty.cacheReadShare).toBeNull();
  });
});
