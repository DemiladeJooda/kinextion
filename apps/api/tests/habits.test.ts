/**
 * Habit logging and the score, in the user's own day.
 *
 * Two bugs these pin down. Dates were UTC, so a Dallas user's 11:30pm log
 * landed on tomorrow's row; and schedules were never read, so a Mon/Wed/Fri
 * habit dragged down Tuesday's score. Prisma is mocked with real in-memory
 * state so a log followed by a score request is what's being tested.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-habit-tests";

interface StoredHabit {
  id: string;
  userId: string;
  name: string;
  frequency: string;
  targetDays: number[] | null;
  isActive: boolean;
  createdAt: Date;
}
interface StoredLog {
  id: string;
  habitId: string;
  userId: string;
  date: Date;
  completed: boolean;
  state?: string;
  source?: string;
}

const state: {
  habits: StoredHabit[];
  logs: StoredLog[];
  logQueries: number;
  workouts: Array<{ id: string; userId: string; type: string; createdAt: Date }>;
} = {
  habits: [],
  logs: [],
  logQueries: 0,
  workouts: [],
};

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));

vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "t@example.com" };
  type DateRange = { gte?: Date; lte?: Date };
  const inRange = (d: Date, r?: DateRange | Date) => {
    if (!r) return true;
    if (r instanceof Date) return d.getTime() === r.getTime();
    return (!r.gte || d >= r.gte) && (!r.lte || d <= r.lte);
  };
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      habit: {
        findMany: async ({ where }: { where: { userId: string; isActive?: boolean } }) =>
          state.habits.filter(
            (h) => h.userId === where.userId && (where.isActive === undefined || h.isActive === where.isActive)
          ),
        findUnique: async ({ where }: { where: { id: string } }) =>
          state.habits.find((h) => h.id === where.id) ?? null,
      },
      habitLog: {
        findMany: async ({ where }: { where: { userId: string; completed?: boolean; date?: DateRange } }) => {
          state.logQueries++;
          return state.logs.filter(
            (l) =>
              l.userId === where.userId &&
              (where.completed === undefined || l.completed === where.completed) &&
              inRange(l.date, where.date)
          );
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { habitId_date: { habitId: string; date: Date } };
          create: Omit<StoredLog, "id">;
          update: { completed: boolean };
        }) => {
          const { habitId, date } = where.habitId_date;
          const existing = state.logs.find((l) => l.habitId === habitId && l.date.getTime() === date.getTime());
          if (existing) {
            existing.completed = update.completed;
            return existing;
          }
          const row = { id: `log_${state.logs.length + 1}`, ...create };
          state.logs.push(row);
          return row;
        },
      },
      workoutLog: {
        findFirst: async ({ where }: { where: { userId: string; createdAt: { gte: Date } } }) =>
          state.workouts.find((w) => w.userId === where.userId && w.createdAt >= where.createdAt.gte) ??
          null,
        create: async ({ data }: { data: { userId: string; type: string } }) => {
          const row = { id: `w${state.workouts.length + 1}`, createdAt: new Date(), ...data };
          state.workouts.push(row);
          return row;
        },
      },
      moodEntry: { findMany: async () => [] },
      kinextionScore: {
        upsert: async ({ create }: { create: { overallScore: number; breakdown: unknown } }) => ({
          overallScore: create.overallScore,
          breakdown: create.breakdown,
        }),
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
  vi.useRealTimers();
  await app.close();
});

/** 23:30 on Tuesday 20 Oct 2026 in Dallas — already the 21st in UTC. */
const DALLAS_LATE_TUESDAY = new Date("2026-10-21T04:30:00Z");
const DALLAS = { "x-time-zone": "America/Chicago" };

function habit(id: string, frequency: string, targetDays: number[] | null = null): StoredHabit {
  return {
    id,
    userId: "user_1",
    name: id,
    frequency,
    targetDays,
    isActive: true,
    createdAt: new Date("2026-10-01T12:00:00Z"),
  };
}

beforeEach(() => {
  state.habits = [habit("ckdaily0000000000000000", "daily"), habit("ckmwf00000000000000000", "custom", [1, 3, 5])];
  state.logs = [];
  state.logQueries = 0;
  state.workouts = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DALLAS_LATE_TUESDAY);
});

describe("POST /api/habits/log", () => {
  it("saves a late-evening log on the user's own date and returns the new score", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: DALLAS,
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-20", completed: true },
    });

    expect(res.statusCode).toBe(200);
    expect(state.logs[0].date.toISOString().slice(0, 10)).toBe("2026-10-20");
    const body = res.json();
    expect(body.data.id).toBe("log_1");
    // One due habit today (the Mon/Wed/Fri one rests on Tuesday), and it's done.
    expect(body.meta.score.breakdown).toMatchObject({ habitsTotal: 1, habitsCompleted: 1 });
  });

  it("refuses a day that hasn't started yet", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: DALLAS,
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-22", completed: true },
    });
    expect(res.statusCode).toBe(400);
    expect(state.logs).toHaveLength(0);
  });

  it("lets a client with no time zone header log its local tomorrow-in-UTC", async () => {
    // Old builds fall back to UTC, where it's already the 21st; a user east
    // of Greenwich may already be on the 22nd.
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-22", completed: true },
    });
    expect(res.statusCode).toBe(200);
  });

  it("ignores a time zone header that isn't a real zone", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: { "x-time-zone": "Mars/Olympus" },
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-21", completed: true },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("log states", () => {
  it("stores a rest day as not completed, even if the client says completed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: DALLAS,
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-20", completed: true, state: "rest" },
    });
    expect(res.statusCode).toBe(200);
    expect(state.logs[0]).toMatchObject({ completed: false, state: "rest" });
    expect(res.json().meta.score.breakdown).toMatchObject({ habitsCompleted: 0 });
  });

  it("marks a log for an earlier day as a backfill", async () => {
    await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: DALLAS,
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-19", completed: true },
    });
    expect(state.logs[0]).toMatchObject({ source: "backfill", state: "done" });
  });

  it("rejects an unknown state", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/habits/log",
      headers: DALLAS,
      payload: { habitId: "ckdaily0000000000000000", date: "2026-10-20", completed: true, state: "skipped" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/score/today", () => {
  it("leaves a habit that isn't scheduled today out of the denominator", async () => {
    const res = await app.inject({ method: "GET", url: "/api/score/today", headers: DALLAS });
    expect(res.json().data.breakdown).toMatchObject({ habitsTotal: 1, habitsCompleted: 0 });
  });

  it("counts both habits on a day both are due", async () => {
    vi.setSystemTime(new Date("2026-10-21T15:00:00Z")); // Wednesday morning in Dallas
    const res = await app.inject({ method: "GET", url: "/api/score/today", headers: DALLAS });
    expect(res.json().data.breakdown).toMatchObject({ habitsTotal: 2 });
  });

  it("works out the streak from a single log query", async () => {
    for (const day of ["2026-10-17", "2026-10-18", "2026-10-19"]) {
      state.logs.push({
        id: day,
        habitId: "ckdaily0000000000000000",
        userId: "user_1",
        date: new Date(`${day}T00:00:00Z`),
        completed: true,
      });
    }
    const res = await app.inject({ method: "GET", url: "/api/score/today", headers: DALLAS });
    expect(res.json().data.breakdown.streakDays).toBe(3);
    expect(state.logQueries).toBe(1);
  });
});

describe("POST /api/workouts", () => {
  it("saves a quick log with no exercises and counts it toward today's score", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workouts",
      headers: DALLAS,
      payload: { name: "Cardio", type: "cardio", duration: 30 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().meta.score.breakdown.workoutLogged).toBe(true);
  });

  it("rejects an unknown workout type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workouts",
      headers: DALLAS,
      payload: { name: "Nap", type: "napping" },
    });
    expect(res.statusCode).toBe(400);
  });
});
