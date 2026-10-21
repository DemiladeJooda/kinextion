/**
 * The recommendation feedback loop, end to end.
 *
 * The three things that have to hold for this feature to be worth anything:
 *
 *   1. A recommendation is persisted, so feedback has a row to attach to.
 *   2. Every response is written — including "something else", which is the
 *      most common response a user will ever give and the easiest to lose.
 *   3. The stored history is fed back into the next generation.
 *
 * Prisma is mocked with real in-memory state and the model call is stubbed, so
 * what's under test is the sequence of requests and what the generator is
 * handed — not the model's answer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-rec-tests";

interface StoredRec {
  id: string;
  userId: string;
  content: string;
  category: string;
  context: string | null;
  acted: boolean;
  dismissed: boolean;
  createdAt: Date;
  alternative?: string | null;
  alternativeCategory?: string | null;
  chosenAt?: Date | null;
}

const state: { recs: StoredRec[] } = { recs: [] };

/** Captures the system prompt the generator built, so we can assert on it. */
const generateStructured = vi.fn();

vi.mock("../src/modules/ai/services/ai-service.js", () => ({
  generateStructured: (...args: unknown[]) => generateStructured(...args),
  sendToAI: async () => "",
  streamFromAI: async () => "",
}));

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: {
    users: {
      getUser: async () => ({
        primaryEmailAddress: { emailAddress: "test@example.com" },
        emailAddresses: [{ emailAddress: "test@example.com" }],
      }),
    },
  },
}));

vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "test@example.com" };
  const empty = async () => [];
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      profile: { findUnique: async () => null },
      habit: { findMany: empty },
      habitLog: { findMany: empty },
      workoutLog: { findFirst: async () => null },
      moodEntry: { findMany: empty, findFirst: async () => null },
      memoryFact: { findMany: empty },
      wearableMetric: { findMany: empty },
      kinextionScore: { upsert: async () => ({ id: "s1", overallScore: 0 }) },
      recommendation: {
        findMany: async ({ take }: { take?: number } = {}) => {
          const sorted = [...state.recs].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );
          return take ? sorted.slice(0, take) : sorted;
        },
        findFirst: async () =>
          [...state.recs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const rec = {
            id: `r${state.recs.length + 1}`,
            acted: false,
            dismissed: false,
            createdAt: new Date(),
            ...data,
          } as StoredRec;
          state.recs.push(rec);
          return rec;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const found = state.recs.find((r) => r.id === where.id);
          if (!found) throw new Error("not found");
          Object.assign(found, data);
          return found;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; userId: string };
          data: Record<string, unknown>;
        }) => {
          const found = state.recs.filter((r) => r.id === where.id && r.userId === where.userId);
          for (const r of found) Object.assign(r, data);
          return { count: found.length };
        },
      },
    },
  };
});

const { buildApp } = await import("../src/server.js");

let app: Awaited<ReturnType<typeof buildApp>>["app"];

/**
 * A fresh app per test.
 *
 * Generation is rate limited to 12 calls a minute per user, and every test in
 * this file signs in as the same one — so a shared instance runs out of
 * budget partway through the file and later tests get a 429 instead of the
 * behaviour they're asserting on. Rebuilding resets the limiter's store
 * without weakening the limit that ships.
 */
beforeEach(async () => {
  ({ app } = await buildApp());
  await app.ready();

  state.recs = [];
  generateStructured.mockReset();
  generateStructured.mockResolvedValue({
    action: "Walk to the end of the road.",
    why: "You have nothing logged yet today.",
    category: "physical",
  });
});

afterEach(async () => {
  await app.close();
});

const generate = (body: Record<string, unknown> = {}) =>
  app.inject({ method: "POST", url: "/api/recommendations/today", payload: body });

const feedback = (id: string, outcome: string) =>
  app.inject({ method: "POST", url: `/api/recommendations/${id}/feedback`, payload: { outcome } });

/** The system prompt handed to the model on the most recent generation. */
function lastSystemPrompt(): string {
  return generateStructured.mock.calls.at(-1)?.[0].system ?? "";
}

describe("generating and storing", () => {
  it("persists the recommendation so feedback has something to attach to", async () => {
    const res = await generate();

    expect(res.statusCode).toBe(201);
    expect(state.recs).toHaveLength(1);
    expect(state.recs[0].content).toBe("Walk to the end of the road.");
    // The "why" is stored too, so the receipt survives a reload.
    expect(state.recs[0].context).toBe("You have nothing logged yet today.");
  });

  it("returns today's existing recommendation instead of generating another", async () => {
    const first = await generate();
    generateStructured.mockClear();

    const second = await generate();

    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(first.json().data.id);
    // No second model call: regenerating on every open would burn tokens and
    // break the loop, since a card the user never sees twice can't collect
    // feedback.
    expect(generateStructured).not.toHaveBeenCalled();
    expect(state.recs).toHaveLength(1);
  });

  it("records 'something else' as a dismissal of what was on screen", async () => {
    const first = (await generate()).json().data;
    await generate({ refresh: true });

    const original = state.recs.find((r) => r.id === first.id);
    expect(original?.dismissed).toBe(true);
    expect(state.recs).toHaveLength(2);
  });

  it("does not overwrite an outcome the user already gave", async () => {
    const first = (await generate()).json().data;
    await feedback(first.id, "acted");
    await generate({ refresh: true });

    const original = state.recs.find((r) => r.id === first.id);
    expect(original?.acted).toBe(true);
    expect(original?.dismissed).toBe(false);
  });

  it("falls back to a generic action rather than failing when the model is down", async () => {
    generateStructured.mockRejectedValue(new Error("upstream down"));

    const res = await generate();

    expect(res.statusCode).toBe(201);
    // Stored like any other, and the reason says plainly that it isn't tailored.
    expect(state.recs[0].context).toMatch(/general/i);
  });
});

describe("recording outcomes", () => {
  it("writes acted", async () => {
    const rec = (await generate()).json().data;
    const res = await feedback(rec.id, "acted");

    expect(res.statusCode).toBe(200);
    expect(state.recs[0].acted).toBe(true);
    expect(state.recs[0].dismissed).toBe(false);
  });

  it("lets someone change their mind without leaving a row claiming both", async () => {
    const rec = (await generate()).json().data;
    await feedback(rec.id, "dismissed");
    await feedback(rec.id, "acted");

    expect(state.recs[0].acted).toBe(true);
    expect(state.recs[0].dismissed).toBe(false);
  });
});

describe("feeding history back into generation", () => {
  it("tells the model what the user took and what they skipped", async () => {
    state.recs = [
      {
        id: "r_old_1",
        userId: "user_1",
        content: "Drink a glass of water.",
        category: "physical",
        context: null,
        acted: true,
        dismissed: false,
        createdAt: new Date(Date.now() - 3 * 86_400_000),
      },
      {
        id: "r_old_2",
        userId: "user_1",
        content: "Do a twenty-minute mobility flow.",
        category: "physical",
        context: null,
        acted: false,
        dismissed: true,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
    ];

    // findFirst returns the newest row, which here is dismissed — so this
    // generates rather than returning the existing one.
    await generate();

    const prompt = lastSystemPrompt();
    expect(prompt).toContain("Drink a glass of water.");
    expect(prompt).toContain("Do a twenty-minute mobility flow.");
    expect(prompt).toMatch(/took/i);
    expect(prompt).toMatch(/skipped/i);
  });

  it("says plainly that there is no history when there is none", async () => {
    await generate();

    const prompt = lastSystemPrompt();
    expect(prompt).toMatch(/no recommendation has been answered/i);
    // And forbids passing a generic suggestion off as personalised.
    expect(prompt).toMatch(/don't imply this was tailored/i);
  });

  it("makes no preference claim on a handful of answers", async () => {
    state.recs = Array.from({ length: 4 }, (_, i) => ({
      id: `r_${i}`,
      userId: "user_1",
      content: `Old action ${i}`,
      category: "physical",
      context: null,
      acted: true,
      dismissed: false,
      createdAt: new Date(Date.now() - (i + 2) * 86_400_000),
    }));

    await generate({ refresh: true });
    const prompt = lastSystemPrompt();

    // Assert the generation actually happened before asserting on its absence
    // — an empty prompt would satisfy the negative check for the wrong reason.
    expect(prompt).toContain("Old action 0");
    // Four acted-on suggestions is not a preference, and the prompt must not
    // present it as one.
    expect(prompt).not.toMatch(/Acts on \d+ of \d+ suggestions overall/);
  });

  it("states the pattern once there is enough of it", async () => {
    state.recs = Array.from({ length: 12 }, (_, i) => ({
      id: `r_${i}`,
      userId: "user_1",
      content: `Old action ${i}`,
      category: i < 6 ? "physical" : "spiritual",
      context: null,
      // Every physical one taken, every spiritual one skipped.
      acted: i < 6,
      dismissed: i >= 6,
      createdAt: new Date(Date.now() - (i + 2) * 86_400_000),
    }));

    await generate({ refresh: true });

    const prompt = lastSystemPrompt();
    expect(prompt).toMatch(/Acts on 6 of 12 suggestions overall/);
    expect(prompt).toMatch(/Body suggestions land more often: 6 of 6/);
    expect(prompt).toMatch(/Spirit suggestions land less often: 0 of 6/);
  });
});

describe("GET /api/recommendations", () => {
  it("returns the history and the conclusions drawn from it", async () => {
    state.recs = Array.from({ length: 10 }, (_, i) => ({
      id: `r_${i}`,
      userId: "user_1",
      content: `Old action ${i}`,
      category: "physical",
      context: null,
      acted: i < 7,
      dismissed: i >= 7,
      createdAt: new Date(Date.now() - (i + 1) * 86_400_000),
    }));

    const res = await app.inject({ method: "GET", url: "/api/recommendations" });
    const body = res.json();

    expect(body.data.recommendations).toHaveLength(10);
    expect(body.data.preferences.answered).toBe(10);
    expect(body.data.preferences.acted).toBe(7);
    // Every claim shown to the user carries the count behind it.
    for (const line of body.data.preferences.lines) {
      expect(line).toMatch(/\d+ of \d+/);
    }
  });
});

describe("two options to choose from", () => {
  const TWO = {
    options: [
      { action: "Walk to the end of the road.", why: "You'll feel less stiff by lunch.", category: "physical" },
      { action: "Text one friend back.", why: "You'll stop carrying it around today.", category: "emotional" },
    ],
  };
  const choose = (id: string, option: string) =>
    app.inject({ method: "POST", url: `/api/recommendations/${id}/choose`, payload: { option } });

  it("stores both, the first as the main one", async () => {
    generateStructured.mockResolvedValueOnce(TWO);
    await generate();
    expect(state.recs[0]).toMatchObject({
      content: "Walk to the end of the road.",
      alternative: "Text one friend back.",
      alternativeCategory: "emotional",
    });
  });

  it("asks the model for two genuinely different options framed as same-day benefits", async () => {
    generateStructured.mockResolvedValueOnce(TWO);
    await generate();
    const call = generateStructured.mock.calls.at(-1)?.[0];
    expect(call.inputSchema.properties.options.minItems).toBe(2);
    expect(lastSystemPrompt()).toMatch(/genuinely different/);
    expect(lastSystemPrompt()).toMatch(/feel today/);
  });

  it("swaps the alternative into place when it's picked, keeping the one passed over", async () => {
    generateStructured.mockResolvedValueOnce(TWO);
    const created = (await generate()).json().data;
    const res = await choose(created.id, "alternative");
    expect(res.statusCode).toBe(200);
    expect(state.recs[0]).toMatchObject({
      content: "Text one friend back.",
      category: "emotional",
      alternative: "Walk to the end of the road.",
    });
    expect(state.recs[0].chosenAt).toBeInstanceOf(Date);
  });

  it("only counts the first pick", async () => {
    generateStructured.mockResolvedValueOnce(TWO);
    const created = (await generate()).json().data;
    await choose(created.id, "primary");
    await choose(created.id, "alternative");
    expect(state.recs[0].content).toBe("Walk to the end of the road.");
  });

  it("rejects an unknown option", async () => {
    generateStructured.mockResolvedValueOnce(TWO);
    const created = (await generate()).json().data;
    expect((await choose(created.id, "both")).statusCode).toBe(400);
  });
});
