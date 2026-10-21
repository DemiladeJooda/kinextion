/**
 * The "What would it take?" loop, end to end.
 *
 * What has to hold: the answer and the one suggestion are stored; the model
 * can only suggest changes from the fixed menu; applying does exactly what
 * was shown and only once; a worrying answer never becomes a habit edit; and
 * precommitments only cover today and tomorrow.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-coach-tests";

const generateStructured = vi.fn();
vi.mock("../src/modules/ai/services/ai-service.js", () => ({
  generateStructured: (...args: unknown[]) => generateStructured(...args),
  sendToAI: async () => "",
  streamFromAI: async () => "",
}));

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));

interface Habit {
  id: string;
  userId: string;
  name: string;
  category: string;
  cue: string | null;
  response: string | null;
  craving: string | null;
  backupPlan: string | null;
  frequency: string;
  targetDays: number[] | null;
  perWeekTarget: number | null;
  timeWindow: string;
  status: string;
  polished: unknown;
}
type Row = Record<string, unknown> & { id: string };

const db: { habits: Habit[]; reflections: Row[]; precommits: Row[] } = {
  habits: [],
  reflections: [],
  precommits: [],
};

vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "t@example.com" };
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      habit: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          db.habits.find((h) => h.id === where.id) ?? null,
        updateMany: async ({ where, data }: { where: { id: string; userId: string }; data: Partial<Habit> }) => {
          const h = db.habits.find((x) => x.id === where.id && x.userId === where.userId);
          if (!h) return { count: 0 };
          Object.assign(h, data);
          return { count: 1 };
        },
      },
      habitReflection: {
        create: async ({ data }: { data: Row }) => {
          const row = { ...data, id: `ref${db.reflections.length + 1}` };
          db.reflections.push(row);
          return row;
        },
        findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
          db.reflections.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const r = db.reflections.find((x) => x.id === where.id)!;
          Object.assign(r, data);
          return r;
        },
        findMany: async () => db.reflections,
      },
      precommitment: {
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { habitId_forDate: { habitId: string; forDate: Date } };
          create: Row;
          update: Row;
        }) => {
          const key = where.habitId_forDate;
          const found = db.precommits.find(
            (p) => p.habitId === key.habitId && (p.forDate as Date).getTime() === key.forDate.getTime()
          );
          if (found) return Object.assign(found, update);
          const row = { ...create, id: `pc${db.precommits.length + 1}` };
          db.precommits.push(row);
          return row;
        },
        findMany: async () => db.precommits,
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

const DALLAS = { "x-time-zone": "America/Chicago" };

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: "ckpushups00000000000000",
    userId: "user_1",
    name: "Push-ups",
    category: "physical",
    cue: "After I pour my coffee",
    response: "10 push-ups",
    craving: "To feel strong",
    backupPlan: null,
    frequency: "daily",
    targetDays: null,
    perWeekTarget: null,
    timeWindow: "morning",
    status: "building",
    polished: null,
    ...over,
  };
}

beforeEach(() => {
  db.habits = [habit()];
  db.reflections = [];
  db.precommits = [];
  generateStructured.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T14:00:00Z")); // Wednesday morning in Dallas
});

const reflect = (body: Record<string, unknown>, id = "ckpushups00000000000000") =>
  app.inject({ method: "POST", url: `/api/habits/${id}/reflect`, headers: DALLAS, payload: body });
const apply = (id: string, body?: Record<string, unknown>) =>
  app.inject({ method: "POST", url: `/api/habits/reflections/${id}/apply`, headers: DALLAS, payload: body ?? {} });

describe("POST /api/habits/:id/reflect", () => {
  it("stores the answer and the one suggestion, and returns the reply", async () => {
    generateStructured.mockResolvedValue({
      reply: "Ten felt like a lot on a rushed morning. Want to try two?",
      change: { type: "shrink", response: "2 push-ups" },
      backupPlan: "If I'm rushed, I'll do 2 push-ups by the kettle.",
    });
    const res = await reflect({ missedOn: "2026-10-20", answer: "mornings are too rushed for 10" });

    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({
      reply: expect.stringContaining("Want to try"),
      change: { type: "shrink", response: "2 push-ups" },
    });
    expect(db.reflections[0]).toMatchObject({ answer: "mornings are too rushed for 10" });
  });

  it("drops a suggestion that isn't on the menu", async () => {
    generateStructured.mockResolvedValue({ reply: "Okay.", change: { type: "delete" } });
    const res = await reflect({ missedOn: "2026-10-20", answer: "just delete it" });
    expect(res.json().data.change).toEqual({ type: "none" });
  });

  it("never turns a worrying answer into a habit edit", async () => {
    generateStructured.mockResolvedValue({
      reply: "That sounds really heavy. I'm here.",
      change: { type: "pause" },
      backupPlan: "If…",
      concern: true,
    });
    const res = await reflect({ missedOn: "2026-10-20", answer: "whats even the point" });
    expect(res.json().data).toMatchObject({ concern: true, change: { type: "none" }, backupPlan: null });
  });

  it("records 'Not now' without asking the model", async () => {
    const res = await reflect({ missedOn: "2026-10-20", skipped: true });
    expect(res.statusCode).toBe(201);
    expect(generateStructured).not.toHaveBeenCalled();
    expect(db.reflections[0]).toMatchObject({ answer: "" });
  });

  it("tells the model to reflect back, invite, and never guilt — as Altheo for a Body habit", async () => {
    generateStructured.mockResolvedValue({ reply: "Fair.", change: { type: "none" } });
    await reflect({ missedOn: "2026-10-20", answer: "busy" });
    const system = generateStructured.mock.calls[0][0].system as string;
    expect(system).toMatch(/You are Altheo/);
    expect(system).toMatch(/Reflect back what they said first/);
    expect(system).toMatch(/Offer, don't instruct/);
    expect(system).toMatch(/Never guilt/);
  });

  it("is Kairo for a Mind or Heart habit", async () => {
    db.habits = [habit({ category: "emotional", name: "Journal" })];
    generateStructured.mockResolvedValue({ reply: "Fair.", change: { type: "none" } });
    await reflect({ missedOn: "2026-10-20", answer: "busy" });
    expect(generateStructured.mock.calls[0][0].system).toMatch(/You are Kairo/);
  });

  it("won't reflect on someone else's habit", async () => {
    db.habits = [habit({ userId: "someone-else" })];
    expect((await reflect({ missedOn: "2026-10-20", answer: "x" })).statusCode).toBe(404);
  });
});

describe("POST /api/habits/reflections/:id/apply", () => {
  beforeEach(async () => {
    generateStructured.mockResolvedValue({
      reply: "Want to try two?",
      change: { type: "shrink", response: "2 push-ups" },
      backupPlan: "If I'm rushed, I'll do 2 by the kettle.",
    });
    await reflect({ missedOn: "2026-10-20", answer: "too rushed" });
  });

  it("applies exactly the stored suggestion and backup plan", async () => {
    const res = await apply("ref1");
    expect(res.statusCode).toBe(200);
    expect(db.habits[0]).toMatchObject({
      response: "2 push-ups",
      backupPlan: "If I'm rushed, I'll do 2 by the kettle.",
    });
  });

  it("ignores anything in the request body", async () => {
    await apply("ref1", { response: "0 push-ups", status: "archived" });
    expect(db.habits[0]).toMatchObject({ response: "2 push-ups", status: "building" });
  });

  it("only applies once", async () => {
    await apply("ref1");
    db.habits[0].response = "edited since";
    await apply("ref1");
    expect(db.habits[0].response).toBe("edited since");
  });

  it("can pause, but never archives", async () => {
    generateStructured.mockResolvedValueOnce({ reply: "A break sounds fair.", change: { type: "pause" } });
    await reflect({ missedOn: "2026-10-20", answer: "I need a break" });
    await apply("ref2");
    expect(db.habits[0].status).toBe("paused");
  });
});

describe("precommitments", () => {
  const commit = (forDate: string) =>
    app.inject({
      method: "POST",
      url: "/api/habits/ckpushups00000000000000/precommit",
      headers: DALLAS,
      payload: { forDate, text: "After I pour my coffee, I'll do 2 push-ups." },
    });

  it("accepts tomorrow and replaces on a second save", async () => {
    expect((await commit("2026-10-22")).statusCode).toBe(201);
    expect((await commit("2026-10-22")).statusCode).toBe(201);
    expect(db.precommits).toHaveLength(1);
  });

  it("refuses the past and more than a day ahead", async () => {
    expect((await commit("2026-10-20")).statusCode).toBe(400);
    expect((await commit("2026-10-23")).statusCode).toBe(400);
  });
});
