/**
 * Route-level contract tests.
 *
 * These exist because of a real bug: the chat module's auth hook returned a
 * bare `undefined` on the public greeting path, and Fastify's hook runner
 * only continues when a hook returns a promise — so that endpoint hung
 * forever rather than failing. A typecheck can't see that; a request can.
 *
 * Prisma and Clerk are mocked so this runs without a database or network.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-route-tests";

/** Flipped per-test to simulate a signed-in or signed-out caller. */
let signedInClerkId: string | null = null;

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: signedInClerkId }),
  clerkClient: {
    users: {
      getUser: async () => ({
        primaryEmailAddress: { emailAddress: "test@example.com" },
        emailAddresses: [{ emailAddress: "test@example.com" }],
      }),
      deleteUser: async () => ({}),
    },
  },
}));

vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "test@example.com" };
  const none = async () => null;
  const empty = async () => [];
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user, delete: async () => user },
      profile: { findUnique: none, upsert: async () => ({ id: "p1" }), update: async () => ({ id: "p1" }) },
      habit: {
        findMany: empty,
        create: async () => ({ id: "h1" }),
        findUnique: none,
        updateMany: async () => ({ count: 0 }),
      },
      habitLog: { findMany: empty, upsert: async () => ({ id: "hl1" }) },
      moodEntry: {
        findFirst: none,
        findMany: empty,
        create: async () => ({ id: "m1" }),
        update: async () => ({ id: "m1" }),
      },
      workoutLog: {
        findFirst: none,
        findMany: empty,
        create: async () => ({ id: "w1", type: "cardio" }),
        deleteMany: async () => ({ count: 0 }),
      },
      kinextionScore: { findMany: empty, upsert: async () => ({ id: "s1", overallScore: 0 }) },
      conversation: { findMany: empty, findUnique: none, create: async () => ({ id: "c1" }) },
      message: { findMany: empty, count: async () => 0, create: async () => ({ id: "msg1" }) },
      recommendation: {
        findMany: empty,
        findFirst: none,
        create: async () => ({ id: "r1" }),
        update: async () => ({ id: "r1" }),
        updateMany: async () => ({ count: 0 }),
      },
      integration: { findMany: empty, findUnique: none },
      wearableMetric: { findMany: empty },
      memoryFact: { findMany: empty },
      therapistShare: { findUnique: none },
      therapistReport: { findMany: empty, findUnique: none },
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

/** Every route that must never serve an unauthenticated caller. */
const PROTECTED: Array<[string, string]> = [
  ["GET", "/api/users/me/profile"],
  ["PATCH", "/api/users/me/profile"],
  ["GET", "/api/users/me/data-summary"],
  ["POST", "/api/users/me/onboard"],
  ["DELETE", "/api/users/me"],
  ["GET", "/api/habits"],
  ["POST", "/api/habits"],
  ["PATCH", "/api/habits/h1"],
  ["DELETE", "/api/habits/h1"],
  ["POST", "/api/habits/suggest"],
  ["POST", "/api/habits/discover"],
  ["POST", "/api/habits/log"],
  ["GET", "/api/habits/logs"],
  ["POST", "/api/workouts"],
  ["GET", "/api/workouts"],
  ["DELETE", "/api/workouts/w1"],
  ["GET", "/api/mood"],
  ["POST", "/api/mood"],
  ["GET", "/api/mood/latest"],
  ["GET", "/api/checkin/today"],
  ["POST", "/api/checkin"],
  ["POST", "/api/checkin/prompt"],
  ["GET", "/api/recommendations"],
  ["GET", "/api/recommendations/today"],
  ["POST", "/api/recommendations/today"],
  ["POST", "/api/recommendations/r1/feedback"],
  ["POST", "/api/recommendations/r1/choose"],
  ["GET", "/api/score/today"],
  ["GET", "/api/score/history"],
  ["POST", "/api/chat/me/message"],
  ["POST", "/api/chat/me/stream"],
  ["GET", "/api/chat/me/conversations"],
  ["GET", "/api/integrations"],
  ["POST", "/api/integrations/strava/connect"],
  ["DELETE", "/api/integrations/strava"],
  ["GET", "/api/integrations/metrics"],
  ["GET", "/api/integrations/patterns"],
  ["GET", "/api/therapist/consent"],
  ["PUT", "/api/therapist/consent"],
  ["POST", "/api/therapist/consent/revoke"],
  ["GET", "/api/therapist/reports"],
  ["POST", "/api/therapist/reports"],
];

/**
 * The community module on its own app instance. Each instance has its own
 * rate-limit bucket, and the limiter keys by IP in tests — so one app serving
 * every route twice would start answering 429 instead of 401.
 */
const COMMUNITY_PROTECTED: Array<[string, string]> = [
  ["GET", "/api/community/communities"],
  ["POST", "/api/community/communities"],
  ["GET", "/api/community/communities/c1"],
  ["DELETE", "/api/community/communities/c1/membership"],
  ["POST", "/api/community/communities/c1/invites"],
  ["GET", "/api/community/invites/t1"],
  ["POST", "/api/community/invites/t1/accept"],
  ["POST", "/api/community/communities/c1/join-requests"],
  ["GET", "/api/community/communities/c1/join-requests/mine"],
  ["GET", "/api/community/admissions/pending"],
  ["POST", "/api/community/admissions/r1/vote"],
  ["GET", "/api/community/communities/c1/fast-track"],
  ["POST", "/api/community/admissions/r1/fast-track"],
  ["GET", "/api/community/week"],
  ["PUT", "/api/community/week/active"],
  ["POST", "/api/community/cycles/c1/suggestions"],
  ["GET", "/api/community/cycles/c1/suggestions/mine"],
  ["GET", "/api/community/ballots/b1"],
  ["POST", "/api/community/ballots/b1/vote"],
  ["GET", "/api/community/communities/c1/ballots"],
  ["POST", "/api/community/communities/c1/closure"],
  ["POST", "/api/community/media/uploads"],
  ["POST", "/api/community/media/m1/complete"],
  ["GET", "/api/community/media/m1/playback"],
  ["GET", "/api/community/topics/t1"],
  ["POST", "/api/community/topics/t1/responses"],
  ["DELETE", "/api/community/responses/r1"],
  ["GET", "/api/community/topics/t1/room"],
  ["GET", "/api/community/responses/r1/playback"],
  ["PUT", "/api/community/responses/r1/reaction"],
  ["GET", "/api/community/responses/r1/comments"],
  ["POST", "/api/community/responses/r1/comments"],
  ["PUT", "/api/community/comments/x1/like"],
  ["DELETE", "/api/community/comments/x1/like"],
  ["DELETE", "/api/community/comments/x1"],
  ["POST", "/api/community/responses/r1/report"],
  ["POST", "/api/community/comments/x1/report"],
  ["GET", "/api/community/topics/t1/result"],
  ["GET", "/api/community/communities/c1/history"],
  ["GET", "/api/community/me/standing"],
  ["GET", "/api/community/communities/c1/chest"],
  ["POST", "/api/community/communities/c1/chest/proposals"],
  ["POST", "/api/community/communities/c1/chest/ballot"],
];

describe("community authentication", () => {
  let communityApp: Awaited<ReturnType<typeof buildApp>>["app"];

  beforeAll(async () => {
    signedInClerkId = null;
    ({ app: communityApp } = await buildApp());
    await communityApp.ready();
  });

  afterAll(async () => {
    await communityApp.close();
  });

  it.each(COMMUNITY_PROTECTED)("%s %s rejects an unauthenticated caller", async (method, url) => {
    const res = await communityApp.inject({ method: method as "GET", url });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ success: false, error: "Not authenticated" });
  });
});

describe("authentication", () => {
  beforeAll(() => {
    signedInClerkId = null;
  });

  it.each(PROTECTED)("%s %s rejects an unauthenticated caller", async (method, url) => {
    const res = await app.inject({ method: method as "GET", url });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ success: false, error: "Not authenticated" });
  });

  it("responds on every protected route rather than hanging", async () => {
    // `inject` resolving at all is the assertion — the greeting-route bug
    // showed a route can be registered and still never answer.
    const results = await Promise.all(
      PROTECTED.map(([method, url]) => app.inject({ method: method as "GET", url }))
    );
    expect(results).toHaveLength(PROTECTED.length);
    for (const res of results) expect(res.statusCode).toBeGreaterThan(0);
  });
});

describe("public routes", () => {
  beforeAll(() => {
    signedInClerkId = null;
  });

  it("serves health without auth", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  // The regression this whole file was written for.
  it.each(["kairo", "altheo"])("serves the %s greeting without auth", async (persona) => {
    const res = await app.inject({ method: "GET", url: `/api/chat/greeting/${persona}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.persona).toBe(persona);
    expect(body.data.message.length).toBeGreaterThan(0);
  });

  it("returns a consistent envelope for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ success: false, error: "Not found" });
  });
});

describe("validation", () => {
  beforeAll(() => {
    signedInClerkId = "clerk_1";
  });

  it("rejects a malformed chat message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/me/message",
      payload: { persona: "not-a-guide", content: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it("rejects a mood entry outside the allowed range", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/mood",
      payload: { mood: 99 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an unknown integration provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/integrations/myspace/connect",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Unknown provider");
  });

  it("rejects a check-in outside the allowed mood range", async () => {
    const res = await app.inject({ method: "POST", url: "/api/checkin", payload: { mood: 0 } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an empty habit edit rather than writing nothing", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/habits/h1", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/nothing to update/i);
  });

  it("404s when editing a habit that isn't yours", async () => {
    // The mock's updateMany reports 0 rows, which is what a scoped write
    // returns both for a missing habit and for someone else's — the route
    // must not distinguish them, or it confirms other users' habit ids.
    const res = await app.inject({
      method: "PATCH",
      url: "/api/habits/someone-elses",
      payload: { name: "Renamed" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Habit not found");
  });

  it("404s when archiving a habit that isn't yours", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/habits/someone-elses" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a recommendation outcome that isn't one of the two", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/r1/feedback",
      // "ignored" is not an outcome — silence is deliberately not recordable.
      payload: { outcome: "ignored" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("404s when giving feedback on a recommendation that isn't yours", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/someone-elses/feedback",
      payload: { outcome: "acted" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects habit discovery with no conversation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/discover",
      payload: { turns: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("refuses to generate a therapist report with nothing opted in", async () => {
    const res = await app.inject({ method: "POST", url: "/api/therapist/reports", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/opted in/i);
  });
});

describe("cross-origin requests from the web app", () => {
  /**
   * The browser is told which verbs it may use, and it believes the answer.
   * When PUT/PATCH/DELETE were missing, every write from the website failed
   * its preflight and surfaced as a network error rather than a refusal.
   */
  it("allows the write verbs the web app actually uses", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/community/week/active",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    expect(res.statusCode).toBe(204);
    const allowed = (res.headers["access-control-allow-methods"] as string)
      .split(",")
      .map((m) => m.trim().toUpperCase());
    expect(allowed).toEqual(expect.arrayContaining(["GET", "POST", "PUT", "PATCH", "DELETE"]));
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});

describe("security headers", () => {
  it("sets the hardening headers on responses", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
