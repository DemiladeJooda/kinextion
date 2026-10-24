/**
 * The guides acting in the app.
 *
 * What has to hold: each action does what its card says, follows the same
 * rules as the app's buttons, refuses bad or foreign input, and can be
 * undone from its card.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any> & { id: string };
const db: { habits: Row[]; logs: Row[]; facts: Row[]; promises: Row[]; moods: Row[]; away: Row[] } = {
  away: [],
  habits: [],
  logs: [],
  facts: [],
  promises: [],
  moods: [],
};
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

vi.mock("@kinextion/database", () => ({
  prisma: {
    habit: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `h${db.habits.length + 1}`, isActive: true, status: "building", pausedOn: null, createdAt: new Date(), ...data };
        db.habits.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => db.habits.find((h) => h.id === where.id) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        db.habits.filter((h) => h.userId === where.userId && h.isActive && h.status !== "paused"),
      update: async ({ where, data }: { where: Row; data: Row }) =>
        ({ ...Object.assign(db.habits.find((h) => h.id === where.id)!, data) }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const h = db.habits.find((x) => x.id === where.id && x.userId === where.userId);
        if (!h) return { count: 0 };
        Object.assign(h, data);
        return { count: 1 };
      },
    },
    habitLog: {
      findUnique: async ({ where }: { where: { habitId_date: { habitId: string; date: Date } } }) =>
        db.logs.find((l) => l.habitId === where.habitId_date.habitId && sameDay(l.date, where.habitId_date.date)) ?? null,
      findMany: async () => [],
      upsert: async ({ where, create, update }: { where: any; create: Row; update: Row }) => {
        const k = where.habitId_date;
        const found = db.logs.find((l) => l.habitId === k.habitId && sameDay(l.date, k.date));
        if (found) return Object.assign(found, update);
        const row = { id: `l${db.logs.length + 1}`, ...create };
        db.logs.push(row);
        return row;
      },
      update: async ({ where, data }: { where: any; data: Row }) => {
        const k = where.habitId_date;
        return Object.assign(db.logs.find((l) => l.habitId === k.habitId && sameDay(l.date, k.date))!, data);
      },
      deleteMany: async ({ where }: { where: Row }) => {
        const before = db.logs.length;
        db.logs = db.logs.filter((l) => !(l.habitId === where.habitId && sameDay(l.date, where.date)));
        return { count: before - db.logs.length };
      },
      createMany: async () => ({ count: 0 }),
    },
    memoryFact: {
      findUnique: async ({ where }: { where: any }) =>
        db.facts.find((f) => f.userId === where.userId_key.userId && f.key === where.userId_key.key) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `f${db.facts.length + 1}`, ...data };
        db.facts.push(row);
        return row;
      },
      update: async () => ({}),
      deleteMany: async ({ where }: { where: Row }) => {
        const before = db.facts.length;
        db.facts = db.facts.filter((f) => !(f.id === where.id && f.userId === where.userId));
        return { count: before - db.facts.length };
      },
    },
    precommitment: {
      upsert: async ({ create }: { create: Row }) => {
        const row = { id: `p${db.promises.length + 1}`, ...create };
        db.promises.push(row);
        return row;
      },
      deleteMany: async ({ where }: { where: Row }) => {
        const before = db.promises.length;
        db.promises = db.promises.filter((p) => !(p.habitId === where.habitId && p.userId === where.userId));
        return { count: before - db.promises.length };
      },
    },
    awayPeriod: {
      findFirst: async () => db.away.find((a) => !a.endedAt) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: "a1", ...data };
        db.away.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => Object.assign(db.away.find((a) => a.id === where.id)!, data),
    },
    moodEntry: {
      findFirst: async () => db.moods[0] ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: "m1", ...data };
        db.moods.push(row);
        return row;
      },
      update: async ({ data }: { data: Row }) => Object.assign(db.moods[0], data),
    },
  },
}));
vi.mock("../src/modules/habits/polish.js", () => ({ schedulePolish: () => {} }));

const { runChatTool, undoChatAction } = await import("../src/modules/ai/chat-tools.js");

const log = { info: () => {}, warn: () => {}, error: () => {} } as never;
const TZ = "America/Chicago";
const ctx = () => ({ userId: "u1", timeZone: TZ, log, created: 0 });

const PUSHUPS = {
  name: "Push-ups",
  category: "physical",
  anchor: "After I pour my coffee",
  tiny_version: "5 push-ups on your knees",
  usual_version: "10 push-ups",
  frequency: "daily",
  part_of_day: "morning",
};

beforeEach(() => {
  db.habits = [];
  db.logs = [];
  db.facts = [];
  db.promises = [];
  db.moods = [];
  db.away = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T15:00:00Z")); // Friday, 10am in Dallas
});

describe("create_habit", () => {
  it("creates the habit with its anchor and tiny version, and offers Undo", async () => {
    const out = await runChatTool("create_habit", PUSHUPS, ctx());
    expect(out.isError).toBeFalsy();
    expect(db.habits[0]).toMatchObject({
      userId: "u1",
      name: "Push-ups",
      cue: "After I pour my coffee",
      response: "5 push-ups on your knees",
      fullVersion: "10 push-ups",
      timeWindow: "morning",
    });
    expect(out.action).toMatchObject({
      kind: "habit_created",
      title: "Added: Push-ups",
      detail: "After I pour my coffee, I'll do 5 push-ups on your knees.",
    });

    expect(await undoChatAction("u1", TZ, out.action!.undo!, log)).toBe(true);
    expect(db.habits[0].isActive).toBe(false);
  });

  it("refuses a habit without a tiny version", async () => {
    const out = await runChatTool("create_habit", { ...PUSHUPS, tiny_version: "" }, ctx());
    expect(out.isError).toBe(true);
    expect(db.habits).toHaveLength(0);
  });

  it("creates at most three in one reply", async () => {
    const c = ctx();
    for (let i = 0; i < 3; i++) await runChatTool("create_habit", { ...PUSHUPS, name: `H${i}` }, c);
    const fourth = await runChatTool("create_habit", { ...PUSHUPS, name: "H4" }, c);
    expect(fourth.isError).toBe(true);
    expect(db.habits).toHaveLength(3);
  });

  it("can start on Monday", async () => {
    await runChatTool("create_habit", { ...PUSHUPS, start: "monday" }, ctx());
    expect(db.habits[0].startsOn.toISOString().slice(0, 10)).toBe("2026-10-26");
  });
});

describe("log_habit", () => {
  beforeEach(async () => {
    await runChatTool("create_habit", PUSHUPS, ctx());
  });

  it("logs the tiny version as coming from chat, and Undo removes it", async () => {
    const out = await runChatTool("log_habit", { habit_id: "h1", how: "tiny" }, ctx());
    expect(db.logs[0]).toMatchObject({ habitId: "h1", completed: true, state: "minimum", source: "chat" });
    expect(out.action?.title).toBe("Push-ups: tiny version");
    await undoChatAction("u1", TZ, out.action!.undo!, log);
    expect(db.logs).toHaveLength(0);
  });

  it("logs an amount for a counted habit, and the habit decides what it counts as", async () => {
    Object.assign(db.habits[0], { measureTarget: 8, measureTiny: 2, measureUnit: "glasses" });
    const out = await runChatTool("log_habit", { habit_id: "h1", how: "done", amount: 3 }, ctx());
    expect(db.logs[0]).toMatchObject({ completed: true, state: "minimum", value: 3, source: "chat" });
    expect(out.action?.title).toBe("Push-ups: 3");
  });

  it("follows the app's rules: yesterday is locked after noon", async () => {
    vi.setSystemTime(new Date("2026-10-23T19:00:00Z")); // 2pm in Dallas
    const out = await runChatTool("log_habit", { habit_id: "h1", how: "done", day: "yesterday" }, ctx());
    expect(out.isError).toBe(true);
    expect(out.result).toMatch(/until noon/);
  });

  it("won't touch someone else's habit", async () => {
    db.habits[0].userId = "someone-else";
    const out = await runChatTool("log_habit", { habit_id: "h1", how: "done" }, ctx());
    expect(out.isError).toBe(true);
    expect(db.logs).toHaveLength(0);
  });
});

describe("change_habit", () => {
  it("applies one change and Undo puts it back", async () => {
    await runChatTool("create_habit", PUSHUPS, ctx());
    const out = await runChatTool(
      "change_habit",
      { habit_id: "h1", change: { type: "shrink", response: "2 push-ups on your knees" } },
      ctx()
    );
    expect(db.habits[0].response).toBe("2 push-ups on your knees");
    await undoChatAction("u1", TZ, out.action!.undo!, log);
    expect(db.habits[0].response).toBe("5 push-ups on your knees");
  });

  it("refuses a change that isn't on the menu", async () => {
    await runChatTool("create_habit", PUSHUPS, ctx());
    const out = await runChatTool("change_habit", { habit_id: "h1", change: { type: "delete" } }, ctx());
    expect(out.isError).toBe(true);
  });
});

describe("save_check_in, promise_tomorrow and remember", () => {
  it("saves today's check-in", async () => {
    const out = await runChatTool("save_check_in", { mood: 4, stress: 8 }, ctx());
    expect(db.moods[0]).toMatchObject({ userId: "u1", mood: 4, stress: 8 });
    expect(out.action?.kind).toBe("checkin_saved");
  });

  it("records tomorrow's promise from the habit's own plan", async () => {
    await runChatTool("create_habit", PUSHUPS, ctx());
    const out = await runChatTool("promise_tomorrow", { habit_ids: ["h1"] }, ctx());
    expect(db.promises[0]).toMatchObject({ habitId: "h1", text: "After I pour my coffee, I'll do 5 push-ups on your knees." });
    await undoChatAction("u1", TZ, out.action!.undo!, log);
    expect(db.promises).toHaveLength(0);
  });

  it("remembers a fact, and Undo forgets it", async () => {
    const out = await runChatTool(
      "remember",
      { fact: "Has a sore left knee; avoids running.", kind: "constraint", lasting: true },
      ctx()
    );
    expect(db.facts[0]).toMatchObject({ tier: "core", category: "constraint", content: "Has a sore left knee; avoids running." });
    await undoChatAction("u1", TZ, out.action!.undo!, log);
    expect(db.facts).toHaveLength(0);
  });

  it("pauses everything when they're going away, and Undo brings it back", async () => {
    await runChatTool("create_habit", PUSHUPS, ctx());
    const out = await runChatTool("going_away", { reason: "travel", until: "2026-10-30" }, ctx());
    expect(db.habits[0].status).toBe("paused");
    expect(out.action).toMatchObject({ kind: "away_started", title: "Away, back Fri, Oct 30", undo: { kind: "end_away" } });
    expect(await undoChatAction("u1", TZ, out.action!.undo!, log)).toBe(true);
    expect(db.habits[0].status).toBe("building");
  });

  it("rejects an unknown tool", async () => {
    expect((await runChatTool("delete_account", {}, ctx())).isError).toBe(true);
  });
});
