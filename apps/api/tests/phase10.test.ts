/**
 * Phase 10: away mode, measured habits, auto-logging and building together.
 *
 * What has to hold:
 *   - Going away pauses habits in one step; coming back restarts exactly
 *     those and the away days become neutral rest, never misses.
 *   - An amount decides a measured habit's day.
 *   - A connected service logs a linked habit, never over something the
 *     user logged or undid.
 *   - Shared habits are visible to members only, unranked.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-phase10";

type Row = Record<string, any> & { id: string };
const db = {
  habits: [] as Row[],
  logs: [] as Row[],
  away: [] as Row[],
  shares: [] as Row[],
  members: [] as Row[],
};
const day = (d: Date | string) => (typeof d === "string" ? d : d.toISOString().slice(0, 10));
const matches = (row: Row, where: Record<string, any> = {}): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === "NOT") return !matches(row, v);
    const val = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return v.in.some((x: any) => (x instanceof Date ? day(x) === day(val) : x === val));
      if ("not" in v) return val !== v.not;
      if ("gte" in v || "lte" in v) return (!v.gte || day(val) >= day(v.gte)) && (!v.lte || day(val) <= day(v.lte));
      if (k === "habit") return matches(db.habits.find((h) => h.id === row.habitId)!, v);
      return false;
    }
    return val instanceof Date && v instanceof Date ? day(val) === day(v) : (val ?? null) === v;
  });

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));
vi.mock("../src/modules/habits/polish.js", () => ({ schedulePolish: () => {} }));
vi.mock("../src/lib/score.js", async (orig) => ({
  ...(await orig<typeof import("../src/lib/score.js")>()),
  recomputeTodayScore: async () => null,
}));
vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "t@example.com" };
  const table = (rows: () => Row[], prefix: string) => ({
    findMany: async ({ where, include }: any = {}) =>
      rows()
        .filter((r) => matches(r, where))
        .map((r) =>
          include?.habit
            ? { ...r, habit: db.habits.find((h) => h.id === r.habitId), user: { profile: { displayName: r.userId === "user_1" ? "Demi" : "Sam" } } }
            : r
        ),
    findFirst: async ({ where }: any = {}) => [...rows()].reverse().find((r) => matches(r, where)) ?? null,
    findUnique: async ({ where }: any) => {
      if (where.habitId_date) {
        return rows().find((r) => r.habitId === where.habitId_date.habitId && day(r.date) === day(where.habitId_date.date)) ?? null;
      }
      return rows().find((r) => r.id === where.id) ?? null;
    },
    create: async ({ data }: any) => {
      const row = { id: `${prefix}${rows().length + 1}`, createdAt: new Date(), ...data };
      rows().push(row);
      return row;
    },
    createMany: async ({ data }: any) => {
      for (const d of data) {
        if (!rows().some((r) => r.habitId === d.habitId && day(r.date) === day(d.date))) rows().push({ id: `${prefix}x`, ...d });
      }
      return { count: data.length };
    },
    update: async ({ where, data }: any) => Object.assign(rows().find((r) => r.id === where.id)!, data),
    updateMany: async ({ where, data }: any) => {
      const hit = rows().filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    upsert: async ({ where, create, update }: any) => {
      const k = where.habitId_date ?? where.habitId_communityId;
      const found = rows().find((r) => Object.entries(k).every(([kk, vv]) => (vv instanceof Date ? day(r[kk]) === day(vv) : r[kk] === vv)));
      if (found) return Object.assign(found, update);
      const row = { id: `${prefix}${rows().length + 1}`, ...create };
      rows().push(row);
      return row;
    },
    deleteMany: async ({ where }: any) => {
      const before = rows().length;
      const keep = rows().filter((r) => !matches(r, where));
      rows().splice(0, rows().length, ...keep);
      return { count: before - keep.length };
    },
  });
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      habit: table(() => db.habits, "h"),
      habitLog: table(() => db.logs, "l"),
      awayPeriod: table(() => db.away, "a"),
      habitShare: table(() => db.shares, "s"),
      communityMembership: table(() => db.members, "m"),
    },
  };
});

const { buildApp } = await import("../src/server.js");
const { autoLogFromMetrics } = await import("../src/lib/auto-log.js");
let app: Awaited<ReturnType<typeof buildApp>>["app"];

beforeAll(async () => {
  ({ app } = await buildApp());
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

let nextHabit = 0;
const habit = (over: Partial<Row> = {}): Row => ({
  id: `h${++nextHabit}`,
  userId: "user_1",
  name: "Push-ups",
  category: "physical",
  frequency: "daily",
  targetDays: null,
  isActive: true,
  status: "building",
  pausedOn: null,
  startsOn: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  cue: "After I pour my coffee",
  response: "5 push-ups",
  polished: null,
  ...over,
});
const TZ = { "x-time-zone": "America/Chicago" };

beforeEach(() => {
  Object.values(db).forEach((rows) => rows.splice(0));
  nextHabit = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T15:00:00Z")); // Fri 23 Oct, 10am in Dallas
});

describe("away mode", () => {
  it("pauses everything active, and coming back restarts it with rest days in between", async () => {
    db.habits.push(habit(), habit({ name: "Water", status: "established" }), habit({ name: "Journal", status: "paused" }));
    const start = await app.inject({ method: "POST", url: "/api/habits/away", headers: TZ, payload: { reason: "travel", until: "2026-10-27" } });
    expect(start.statusCode).toBe(201);
    expect(db.habits.map((h) => h.status)).toEqual(["paused", "paused", "paused"]);
    expect(db.away[0].habits).toEqual([
      { id: "h1", status: "building" },
      { id: "h2", status: "established" },
    ]);

    vi.setSystemTime(new Date("2026-10-27T15:00:00Z"));
    const back = await app.inject({ method: "POST", url: "/api/habits/away/end", headers: TZ });
    expect(back.json().data.restarted.map((h: Row) => h.name)).toEqual(["Push-ups", "Water"]);
    // Each habit back to what it was; the one they paused themselves stays paused.
    expect(db.habits.map((h) => h.status)).toEqual(["building", "established", "paused"]);
    const rest = db.logs.filter((l) => l.habitId === "h1").map((l) => [day(l.date), l.state]);
    expect(rest).toEqual([
      ["2026-10-23", "rest"],
      ["2026-10-24", "rest"],
      ["2026-10-25", "rest"],
      ["2026-10-26", "rest"],
    ]);
    expect(db.away[0].endedAt).toBeTruthy();
  });

  it("won't start twice", async () => {
    db.habits.push(habit());
    await app.inject({ method: "POST", url: "/api/habits/away", headers: TZ, payload: { reason: "illness" } });
    const again = await app.inject({ method: "POST", url: "/api/habits/away", headers: TZ, payload: { reason: "illness" } });
    expect(again.statusCode).toBe(409);
  });
});

describe("measured habits", () => {
  it("lets the amount decide the day", async () => {
    // The log schema wants a cuid for habitId.
    db.habits.push(habit({ id: "cmh1water0000000000000000", name: "Water", measureTarget: 8, measureTiny: 2, measureUnit: "glasses" }));
    const send = (value: number) =>
      app.inject({
        method: "POST",
        url: "/api/habits/log",
        headers: TZ,
        payload: { habitId: "cmh1water0000000000000000", date: "2026-10-23", completed: true, value },
      });
    await send(3);
    expect(db.logs[0]).toMatchObject({ completed: true, state: "minimum", value: 3 });
    await send(8);
    expect(db.logs[0]).toMatchObject({ completed: true, state: "done", value: 8 });
    await send(1);
    expect(db.logs[0]).toMatchObject({ completed: false, value: 1 });
  });
});

describe("auto-logging", () => {
  it("logs a linked habit from today's Strava activity, and never over a day they already logged", async () => {
    db.habits.push(
      habit({ name: "Evening walk", autoLog: { provider: "strava", metric: "workout" } }),
      habit({ name: "Run", autoLog: { provider: "strava", metric: "workout" } }),
      habit({ name: "Steps", autoLog: { provider: "oura", metric: "steps" } })
    );
    db.logs.push({ id: "mine", habitId: "h2", userId: "user_1", date: new Date("2026-10-23"), completed: false, state: "done" });

    const logged = await autoLogFromMetrics("user_1", "America/Chicago", "strava", [
      { metricType: "workout", date: "2026-10-23", value: 32, unit: "min" },
      { metricType: "workout", date: "2026-10-10", value: 50, unit: "min" },
    ]);
    expect(logged).toEqual([
      { habitId: "h1", habitName: "Evening walk", date: "2026-10-23", state: "done", detail: "Strava: 32 min" },
    ]);
    expect(db.logs.find((l) => l.habitId === "h1")).toMatchObject({ source: "integration", notes: "Strava: 32 min" });
    // Their own row (an undo) wasn't touched, and old readings don't backfill.
    expect(db.logs.find((l) => l.id === "mine")).toMatchObject({ completed: false });
    expect(db.logs).toHaveLength(2);
  });
});

describe("building together", () => {
  beforeEach(() => {
    db.members.push(
      { id: "m1", userId: "user_1", communityId: "c1", leftAt: null },
      { id: "m2", userId: "user_2", communityId: "c1", leftAt: null }
    );
  });

  it("shares only into a community you're in", async () => {
    db.habits.push(habit());
    const ok = await app.inject({ method: "POST", url: "/api/habits/h1/share", payload: { communityId: "c1" } });
    const no = await app.inject({ method: "POST", url: "/api/habits/h1/share", payload: { communityId: "c9" } });
    expect(ok.statusCode).toBe(200);
    expect(no.statusCode).toBe(403);
    expect(db.shares).toHaveLength(1);
  });

  it("shows members a week of dots, yours first, nothing ranked", async () => {
    db.habits.push(habit({ name: "Water" }), habit({ userId: "user_2", name: "Read" }));
    db.shares.push(
      { id: "s1", habitId: "h2", userId: "user_2", communityId: "c1" },
      { id: "s2", habitId: "h1", userId: "user_1", communityId: "c1" }
    );
    db.logs.push({ id: "l1", habitId: "h2", userId: "user_2", date: new Date("2026-10-20"), completed: true, state: "minimum" });
    const res = await app.inject({ method: "GET", url: "/api/habits/shared/c1", headers: TZ });
    const { weekStart, rows } = res.json().data;
    expect(weekStart).toBe("2026-10-19");
    expect(rows.map((r: Row) => [r.member, r.habit, r.mine])).toEqual([
      ["Demi", "Water", true],
      ["Sam", "Read", false],
    ]);
    expect(rows[1].week).toEqual(["none", "minimum", "none", "none", "none", "future", "future"]);
    expect(JSON.stringify(rows)).not.toMatch(/streak|total|rank/i);
  });

  it("is members only", async () => {
    const res = await app.inject({ method: "GET", url: "/api/habits/shared/c9", headers: TZ });
    expect(res.statusCode).toBe(403);
  });
});
