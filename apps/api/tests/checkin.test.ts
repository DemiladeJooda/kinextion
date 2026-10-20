/**
 * Check-in merge semantics.
 *
 * These exist because of a bug introduced while building this feature and
 * caught before it shipped: the check-in route originally wrote every column
 * on every submit, so tapping a mood face on the home screen after writing a
 * journal entry would have silently erased the journal — and taken the score's
 * reflection points with it.
 *
 * The rule the tests pin down: a field left out of the body is left alone, a
 * field sent as null is cleared. Prisma is mocked with real in-memory state so
 * the sequence of requests is what's being tested, not one call in isolation.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-checkin-tests";

interface StoredEntry {
  id: string;
  userId: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  journal: string | null;
  gratitude: string | null;
  tags: unknown;
  createdAt: Date;
}

/** Mutable across requests, reset per test — this is the point of the file. */
const state: { entries: StoredEntry[]; score: { overallScore: number; breakdown: unknown } | null } = {
  entries: [],
  score: null,
};

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
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      profile: { findUnique: async () => null },
      habit: { findMany: async () => [] },
      habitLog: { findMany: async () => [] },
      workoutLog: { findFirst: async () => null },
      memoryFact: { findMany: async () => [] },
      wearableMetric: { findMany: async () => [] },
      moodEntry: {
        findFirst: async () => state.entries[state.entries.length - 1] ?? null,
        findMany: async () => state.entries,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const entry = {
            id: `m${state.entries.length + 1}`,
            energy: null,
            stress: null,
            journal: null,
            gratitude: null,
            tags: [],
            createdAt: new Date(),
            ...data,
          } as StoredEntry;
          state.entries.push(entry);
          return entry;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const found = state.entries.find((e) => e.id === where.id);
          if (!found) throw new Error("not found");
          Object.assign(found, data);
          return found;
        },
      },
      kinextionScore: {
        upsert: async ({ create }: { create: { overallScore: number; breakdown: unknown } }) => {
          state.score = { overallScore: create.overallScore, breakdown: create.breakdown };
          return { id: "s1", ...create };
        },
      },
    },
  };
});

const { buildApp } = await import("../src/server.js");

let app: Awaited<ReturnType<typeof buildApp>>["app"];

beforeAll(async () => {
  ({ app } = await buildApp());
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  state.entries = [];
  state.score = null;
});

const post = (payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/checkin", payload });

describe("check-in merge semantics", () => {
  it("creates today's entry on the first submit", async () => {
    const res = await post({ mood: 8, journal: "Long day but a good one." });
    expect(res.statusCode).toBe(201);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].journal).toBe("Long day but a good one.");
  });

  it("edits today's entry instead of stacking a second one", async () => {
    await post({ mood: 6 });
    const res = await post({ mood: 9 });

    expect(res.statusCode).toBe(200);
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].mood).toBe(9);
  });

  // The regression this file was written for.
  it("keeps the journal when a later submit sends only a mood", async () => {
    await post({ mood: 7, journal: "Wrote this in the morning.", gratitude: "Coffee." });
    await post({ mood: 4 });

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].mood).toBe(4);
    expect(state.entries[0].journal).toBe("Wrote this in the morning.");
    expect(state.entries[0].gratitude).toBe("Coffee.");
  });

  it("clears a field when it is explicitly sent as null", async () => {
    await post({ mood: 7, journal: "Written by mistake." });
    await post({ mood: 7, journal: null });

    expect(state.entries[0].journal).toBeNull();
  });

  it("returns the recomputed score in the same response", async () => {
    const res = await post({ mood: 7, journal: "Something worth 15 points." });
    const body = res.json();

    expect(body.success).toBe(true);
    expect(body.data.score).toBeDefined();
    // 15 for the mood check-in + 15 for reflection, with no habits to complete.
    expect(body.data.score.overallScore).toBe(30);
  });

  it("earns no reflection points for a mood-only check-in", async () => {
    const res = await post({ mood: 7 });
    expect(res.json().data.score.overallScore).toBe(15);
  });
});

describe("GET /api/checkin/today", () => {
  it("reports no entry before the first check-in", async () => {
    const res = await app.inject({ method: "GET", url: "/api/checkin/today" });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.data.entry).toBeNull();
    expect(body.data.reflectionDone).toBe(false);
  });

  it("reports reflection as done once something is written", async () => {
    await post({ mood: 5, gratitude: "The dog." });
    const res = await app.inject({ method: "GET", url: "/api/checkin/today" });

    expect(res.json().data.reflectionDone).toBe(true);
  });
});
