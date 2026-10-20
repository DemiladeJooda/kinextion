/**
 * The public marketing endpoints.
 *
 * These are the only two routes in the API that answer without a session, so
 * they get the most adversarial tests in the suite. Three properties matter:
 *
 *   1. They work signed out — the whole point.
 *   2. Waitlist signup can't be used to find out whether an address is already
 *      on the list. Same response either way, always.
 *   3. Analytics ingest can't be used as free storage: names are a fixed
 *      enum, batches are bounded, and a malformed payload is dropped rather
 *      than argued with.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-marketing";

interface StoredWaitlist {
  email: string;
  source?: string | null;
  sessionId?: string | null;
}

const state: { waitlist: StoredWaitlist[]; events: unknown[] } = { waitlist: [], events: [] };

/** Signed out for every test in this file — that's the point of these routes. */
vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => ({}) } },
}));

vi.mock("@kinextion/database", () => ({
  Prisma: { DbNull: null },
  prisma: {
    user: { findUnique: async () => null },
    waitlistEntry: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { email: string };
        create: StoredWaitlist;
        update: Partial<StoredWaitlist>;
      }) => {
        const existing = state.waitlist.find((w) => w.email === where.email);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        state.waitlist.push(create);
        return create;
      },
    },
    analyticsEvent: {
      createMany: async ({ data }: { data: unknown[] }) => {
        state.events.push(...data);
        return { count: data.length };
      },
    },
  },
}));

const { buildApp } = await import("../src/server.js");

let app: Awaited<ReturnType<typeof buildApp>>["app"];

/**
 * A fresh app per test.
 *
 * Waitlist signup is capped at 5 per 10 minutes and, for a signed-out caller,
 * keys on IP — and every request in this file comes from the same loopback
 * address. A shared instance runs out of budget partway through and later
 * tests get a 429 instead of the behaviour they're asserting on. Rebuilding
 * resets the limiter without weakening the cap that ships, which on a public
 * endpoint is doing real work.
 */
beforeEach(async () => {
  ({ app } = await buildApp());
  await app.ready();

  state.waitlist = [];
  state.events = [];
});

afterEach(async () => {
  await app.close();
});

const join = (payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/waitlist", payload });

const send = (payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/events", payload });

describe("POST /api/waitlist", () => {
  it("stores an address from a signed-out visitor", async () => {
    const res = await join({ email: "someone@example.com", source: "home" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: { joined: true } });
    expect(state.waitlist).toHaveLength(1);
    expect(state.waitlist[0].source).toBe("home");
  });

  it("lowercases the address so the same person can't be stored twice", async () => {
    await join({ email: "Someone@Example.COM" });
    await join({ email: "someone@example.com" });

    expect(state.waitlist).toHaveLength(1);
    expect(state.waitlist[0].email).toBe("someone@example.com");
  });

  // The property that stops this becoming an enumeration oracle.
  it("answers identically whether or not the address is already on the list", async () => {
    const first = await join({ email: "twice@example.com", source: "home" });
    const second = await join({ email: "twice@example.com", source: "story" });

    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());
    expect(state.waitlist).toHaveLength(1);
    // The later visit still updates where they came from.
    expect(state.waitlist[0].source).toBe("story");
  });

  it("rejects something that isn't an email", async () => {
    const res = await join({ email: "not-an-email" });

    expect(res.statusCode).toBe(400);
    expect(state.waitlist).toHaveLength(0);
  });

  it("never echoes the stored list back", async () => {
    await join({ email: "private@example.com" });
    const res = await join({ email: "other@example.com" });

    expect(res.body).not.toContain("private@example.com");
  });
});

describe("POST /api/events", () => {
  it("accepts a batch from a signed-out visitor", async () => {
    const res = await send({
      sessionId: "session-abcdefgh",
      events: [
        { name: "tab_view", tab: "home" },
        { name: "tab_dwell", tab: "home", props: { seconds: 12 } },
      ],
    });

    expect(res.statusCode).toBe(202);
    expect(state.events).toHaveLength(2);
  });

  it("drops an unknown event name instead of storing it", async () => {
    const res = await send({
      sessionId: "session-abcdefgh",
      // An open string field here would be free storage for anyone who found it.
      events: [{ name: "arbitrary_thing_i_made_up" }],
    });

    expect(res.statusCode).toBe(202);
    expect(state.events).toHaveLength(0);
  });

  it("refuses an oversized batch", async () => {
    const res = await send({
      sessionId: "session-abcdefgh",
      events: Array.from({ length: 200 }, () => ({ name: "tab_view", tab: "home" })),
    });

    expect(res.statusCode).toBe(202);
    expect(state.events).toHaveLength(0);
  });

  it("refuses a batch with no session id", async () => {
    const res = await send({ events: [{ name: "tab_view" }] });

    expect(res.statusCode).toBe(202);
    expect(state.events).toHaveLength(0);
  });

  it("answers 202 for garbage rather than erroring at the visitor", async () => {
    const res = await send({ nonsense: true });

    expect(res.statusCode).toBe(202);
    expect(res.json().success).toBe(true);
  });
});

describe("the rest of the API is still closed", () => {
  it("still rejects a signed-out caller on a data route", async () => {
    // Registering public routes must not have loosened anything else.
    const res = await app.inject({ method: "GET", url: "/api/habits" });
    expect(res.statusCode).toBe(401);
  });
});
