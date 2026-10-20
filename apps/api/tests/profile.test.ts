/**
 * Profile editing.
 *
 * The behaviour worth pinning is the merge. `Profile.preferences` is one Json
 * column holding unrelated settings — notification opt-in, reminder time, and
 * Kairo's spiritual dial — so a naive write from the notifications screen
 * would silently reset the dial the user set on a different screen. Prisma is
 * mocked with real state so the sequence of edits is what's under test.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-profile-tests";

interface StoredProfile {
  userId: string;
  displayName: string | null;
  age: number | null;
  fitnessLevel: string | null;
  primaryGoals: unknown;
  weeklyAvailability: number | null;
  equipment: unknown;
  preferences: Record<string, unknown> | null;
  onboardingComplete: boolean;
}

const state: { profile: StoredProfile | null } = { profile: null };

function freshProfile(): StoredProfile {
  return {
    userId: "user_1",
    displayName: "Sam",
    age: 28,
    fitnessLevel: "beginner",
    primaryGoals: ["Build consistency"],
    weeklyAvailability: 3,
    equipment: [],
    preferences: null,
    onboardingComplete: true,
  };
}

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
  const zero = async () => 0;
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      profile: {
        findUnique: async () => state.profile,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (!state.profile) throw new Error("no profile");
          Object.assign(state.profile, data);
          return state.profile;
        },
        upsert: async () => state.profile,
      },
      habit: { findMany: empty, count: zero },
      habitLog: { findMany: empty, count: zero, findFirst: async () => null },
      moodEntry: { findMany: empty, count: zero, findFirst: async () => null },
      conversation: { count: zero },
      message: { count: zero },
      memoryFact: { count: zero, findMany: empty },
      wearableMetric: { count: zero, findMany: empty },
      recommendation: { count: zero, findMany: empty, findFirst: async () => null },
      kinextionScore: { count: zero },
      integration: { findMany: empty },
      therapistShare: { findUnique: async () => null },
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
  state.profile = freshProfile();
});

const patch = (payload: Record<string, unknown>) =>
  app.inject({ method: "PATCH", url: "/api/users/me/profile", payload });

describe("PATCH /api/users/me/profile", () => {
  it("changes only the fields that were sent", async () => {
    const res = await patch({ displayName: "Sammy" });

    expect(res.statusCode).toBe(200);
    expect(state.profile?.displayName).toBe("Sammy");
    // Untouched fields stay untouched — this isn't a replace.
    expect(state.profile?.weeklyAvailability).toBe(3);
    expect(state.profile?.fitnessLevel).toBe("beginner");
  });

  it("rejects an empty body rather than writing nothing", async () => {
    const res = await patch({});
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/nothing to update/i);
  });

  it("lets someone remove an age they'd rather not keep on record", async () => {
    const res = await patch({ age: null });

    expect(res.statusCode).toBe(200);
    expect(state.profile?.age).toBeNull();
  });

  it("sets the spiritual dial Kairo's prompt has always claimed to honour", async () => {
    await patch({ preferences: { aiPersonalityDial: "scripture" } });

    expect(state.profile?.preferences).toEqual({ aiPersonalityDial: "scripture" });
  });

  // The regression this file exists for.
  it("merges preferences instead of replacing them", async () => {
    await patch({ preferences: { aiPersonalityDial: "balanced" } });
    await patch({ preferences: { notificationsEnabled: true, dailyCheckInTime: "20:00" } });

    // Setting a reminder from a different screen must not reset the dial.
    expect(state.profile?.preferences).toEqual({
      aiPersonalityDial: "balanced",
      notificationsEnabled: true,
      dailyCheckInTime: "20:00",
    });
  });

  it("rejects a dial value the guides don't implement", async () => {
    const res = await patch({ preferences: { aiPersonalityDial: "mystic" } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a malformed reminder time", async () => {
    const res = await patch({ preferences: { dailyCheckInTime: "8pm" } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/08:30/);
  });

  it("rejects more goals than the guides can meaningfully use", async () => {
    const res = await patch({ primaryGoals: ["a", "b", "c", "d", "e", "f"] });
    expect(res.statusCode).toBe(400);
  });

  it("404s when there's no profile to edit yet", async () => {
    state.profile = null;
    const res = await patch({ displayName: "Sam" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/onboarding/i);
  });
});

describe("GET /api/users/me/data-summary", () => {
  it("reports counts rather than content", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/me/data-summary" });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.data.counts).toMatchObject({ habits: 0, checkIns: 0, reflections: 0 });
    expect(body.data.therapistSharing).toEqual([]);
    // Nothing on this endpoint should be able to return a journal entry.
    expect(JSON.stringify(body)).not.toMatch(/journal"\s*:\s*"/);
  });
});
