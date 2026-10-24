/**
 * Chat failures are errors, not replies.
 *
 * The bug this pins down: the stream route sent "200 OK" before the model
 * answered, so when the Anthropic account ran out of credits every message
 * came back as a guide bubble reading "Something went wrong — try again?".
 * Nothing said the AI was unavailable, and it looked like broken code.
 */

import Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-chat-tests";

const streamFromAI = vi.fn();
const sendToAI = vi.fn();
const streamChatWithTools = vi.fn();
const undoChatAction = vi.fn();
vi.mock("../src/modules/ai/services/ai-service.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/modules/ai/services/ai-service.js")>();
  return {
    ...actual,
    streamFromAI: (...args: unknown[]) => streamFromAI(...args),
    sendToAI: (...args: unknown[]) => sendToAI(...args),
    streamChatWithTools: (...args: unknown[]) => streamChatWithTools(...args),
  };
});
vi.mock("../src/modules/ai/chat-tools.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/modules/ai/chat-tools.js")>();
  return {
    ...actual,
    runChatTool: async (name: string) => ({
      result: "ok",
      action: { kind: "habit_created", title: `Added: ${name}`, undo: { kind: "archive_habit", habitId: "h1" } },
    }),
    undoChatAction: (...args: unknown[]) => undoChatAction(...args),
  };
});

vi.mock("../src/modules/ai/conversation.js", () => ({
  resolveConversation: async () => ({ id: "conv_1" }),
  prepareTurn: async () => ({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
}));

const saved: Array<Record<string, unknown>> = [];
vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));
vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "t@example.com" };
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      message: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          saved.push(data);
          return data;
        },
      },
    },
  };
});
vi.mock("../src/lib/memory/store.js", () => ({ compactConversation: async () => {} }));

const { buildApp } = await import("../src/server.js");
const { describeAIFailure } = await import("../src/modules/ai/services/ai-service.js");
let app: Awaited<ReturnType<typeof buildApp>>["app"];

beforeAll(async () => {
  ({ app } = await buildApp());
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  streamFromAI.mockReset();
  sendToAI.mockReset();
  streamChatWithTools.mockReset();
  undoChatAction.mockReset();
  saved.length = 0;
});

const outOfCredits = () =>
  Anthropic.APIError.generate(
    400,
    { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } },
    undefined,
    new Headers()
  );

const send = () =>
  app.inject({
    method: "POST",
    url: "/api/chat/me/stream",
    payload: { persona: "kairo", content: "hey" },
  });

describe("POST /api/chat/me/stream", () => {
  it("returns a real error when the AI account is out of credits", async () => {
    streamFromAI.mockRejectedValue(outOfCredits());
    const res = await send();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ success: false, code: "ai_unavailable" });
    expect(res.json().error).toMatch(/unavailable/);
    expect(saved).toHaveLength(0);
  });

  it("streams a reply with a 200 once text arrives", async () => {
    streamFromAI.mockImplementation(async (_p, _s, _m, onDelta: (c: string) => void) => {
      onDelta("Hey. ");
      onDelta("How's today going?");
      return "Hey. How's today going?";
    });
    const res = await send();
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-conversation-id"]).toBe("conv_1");
    expect(res.body).toBe("Hey. How's today going?");
    expect(saved[0]).toMatchObject({ role: "assistant", content: "Hey. How's today going?" });
  });

  it("keeps what arrived when the reply is cut off midway", async () => {
    streamFromAI.mockImplementation(async (_p, _s, _m, onDelta: (c: string) => void) => {
      onDelta("Half a thought");
      throw new Error("socket hang up");
    });
    const res = await send();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/^Half a thought/);
    expect(res.body).toMatch(/cut off/);
    expect(saved[0]).toMatchObject({ content: "Half a thought" });
  });
});

describe("POST /api/chat/me/stream with events", () => {
  const sendEvents = () =>
    app.inject({
      method: "POST",
      url: "/api/chat/me/stream",
      headers: { "x-chat-protocol": "events" },
      payload: { persona: "altheo", content: "make me a push-up habit" },
    });
  const parse = (body: string) => body.trim().split("\n").map((l) => JSON.parse(l));

  it("streams text and action cards, and notes the action in the transcript", async () => {
    streamChatWithTools.mockImplementation(async (o: any) => {
      o.onText("Done — ");
      await o.runTool("Push-ups", {});
      o.onText("start tomorrow morning.");
      return "Done — start tomorrow morning.";
    });
    const res = await sendEvents();
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/ndjson/);
    expect(parse(res.body)).toEqual([
      { t: "text", v: "Done — " },
      { t: "action", action: expect.objectContaining({ title: "Added: Push-ups" }) },
      { t: "text", v: "start tomorrow morning." },
      { t: "done" },
    ]);
    expect(saved[0]).toMatchObject({ content: "Done — start tomorrow morning.\n\n[Added: Push-ups]" });
    // The guide gets the action rules on top of its usual prompt.
    expect(streamChatWithTools.mock.calls[0][0].systemPrompt).toMatch(/^sys\n\n/);
  });

  it("is still a real error when nothing was said", async () => {
    streamChatWithTools.mockRejectedValue(outOfCredits());
    const res = await sendEvents();
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("ai_unavailable");
  });
});

describe("POST /api/chat/me/actions/undo", () => {
  it("undoes a valid spec for the signed-in user", async () => {
    undoChatAction.mockResolvedValue(true);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/me/actions/undo",
      payload: { undo: { kind: "archive_habit", habitId: "h1" } },
    });
    expect(res.statusCode).toBe(200);
    expect(undoChatAction.mock.calls[0].slice(0, 3)).toEqual(["user_1", "UTC", { kind: "archive_habit", habitId: "h1" }]);
  });

  it("rejects anything that isn't an undo spec", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/me/actions/undo",
      payload: { undo: { kind: "drop_table" } },
    });
    expect(res.statusCode).toBe(400);
    expect(undoChatAction).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat/me/message", () => {
  it("returns a real error instead of crashing", async () => {
    sendToAI.mockRejectedValue(outOfCredits());
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/me/message",
      payload: { persona: "altheo", content: "hey" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("ai_unavailable");
  });
});

describe("describeAIFailure", () => {
  it("names the real cause for the log and keeps the user message calm", () => {
    const f = describeAIFailure(outOfCredits());
    expect(f.cause).toMatch(/out of credits/);
    expect(f.message).not.toMatch(/credit|billing|anthropic/i);
  });

  it("tells a rejected key and a rate limit apart", () => {
    const badKey = Anthropic.APIError.generate(401, { error: { message: "invalid x-api-key" } }, undefined, new Headers());
    const busy = Anthropic.APIError.generate(429, { error: { message: "rate limited" } }, undefined, new Headers());
    expect(describeAIFailure(badKey)).toMatchObject({ code: "ai_unavailable", cause: /key rejected/ });
    expect(describeAIFailure(busy).code).toBe("ai_busy");
  });
});
