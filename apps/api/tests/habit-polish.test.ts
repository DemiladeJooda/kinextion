/**
 * Tidying how a user's own words are shown back.
 *
 * What has to hold: their meaning survives, harsh self-talk never gets
 * quoted back, a why that reads like distress is flagged rather than
 * prettified, and a slow model never overwrites a newer edit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ANTHROPIC_API_KEY = "sk-ant-test";

const generateStructured = vi.fn();
vi.mock("../src/modules/ai/services/ai-service.js", () => ({
  generateStructured: (...args: unknown[]) => generateStructured(...args),
}));

interface Row {
  id: string;
  userId: string;
  name: string;
  cue: string | null;
  response: string | null;
  craving: string | null;
  backupPlan: string | null;
  polished: unknown;
}
const db: { habit: Row | null; writes: number } = { habit: null, writes: 0 };

vi.mock("@kinextion/database", () => ({
  prisma: {
    habit: {
      findUnique: async () => (db.habit ? { ...db.habit } : null),
      updateMany: async ({ where, data }: { where: Partial<Row>; data: { polished: unknown } }) => {
        const h = db.habit;
        const same =
          h &&
          h.id === where.id &&
          h.cue === where.cue &&
          h.response === where.response &&
          h.craving === where.craving &&
          h.backupPlan === where.backupPlan;
        if (!same) return { count: 0 };
        h!.polished = data.polished;
        db.writes++;
        return { count: 1 };
      },
    },
  },
}));

const { polishHabitText, schedulePolish } = await import("../src/modules/habits/polish.js");

const log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() } as never;
const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  generateStructured.mockReset();
  db.habit = null;
  db.writes = 0;
});

describe("polishHabitText", () => {
  it("sends only the fields that have text, and tells the model the rules", async () => {
    generateStructured.mockResolvedValue({ cue: "After I pour my coffee", craving: "To feel strong" });
    await polishHabitText("Push-ups", { cue: "after i get coffe", craving: "im so lazy", response: "" });

    const call = generateStructured.mock.calls[0][0];
    expect(call.inputSchema.required).toEqual(["cue", "craving"]);
    expect(call.system).toMatch(/Remove insults and self-criticism/);
    expect(call.system).toMatch(/Never add goals, numbers, claims or advice/);
    expect(call.system).toMatch(/set concern to true/);
  });

  it("returns the cleaned text with what it was cleaned from", async () => {
    generateStructured.mockResolvedValue({
      cue: "After I pour my coffee",
      craving: "To feel strong and good in my body",
    });
    const p = await polishHabitText("Push-ups", {
      cue: "after i get my coffe or whatever",
      craving: "because im lazy and i hate how i look",
    });
    expect(p).toMatchObject({
      source: "ai",
      cue: "After I pour my coffee",
      craving: "To feel strong and good in my body",
      of: { cue: "after i get my coffe or whatever", craving: "because im lazy and i hate how i look" },
    });
  });

  it("falls back to a basic tidy for a field the model left empty", async () => {
    generateStructured.mockResolvedValue({ cue: "" });
    const p = await polishHabitText("Walk", { cue: "after lunch lol" });
    expect(p.cue).toBe("After lunch");
  });

  it("keeps a why flagged as distress exactly as written", async () => {
    generateStructured.mockResolvedValue({ craving: "To feel better", concern: true });
    const raw = "i dont see the point of anything anymore";
    const p = await polishHabitText("Walk", { craving: raw });
    expect(p).toMatchObject({ concern: true, craving: raw });
  });

  it("makes no call when there's nothing to read", async () => {
    const p = await polishHabitText("Walk", { cue: "  " });
    expect(generateStructured).not.toHaveBeenCalled();
    expect(p.of).toEqual({});
  });
});

describe("schedulePolish", () => {
  const base: Row = {
    id: "h1",
    userId: "u1",
    name: "Push-ups",
    cue: "after coffee",
    response: null,
    craving: null,
    backupPlan: null,
    polished: null,
  };

  it("stores the reading in the background", async () => {
    db.habit = { ...base };
    generateStructured.mockResolvedValue({ cue: "After my coffee" });
    schedulePolish(log, "h1", "u1");
    await flush();
    expect(db.writes).toBe(1);
    expect(db.habit.polished).toMatchObject({ cue: "After my coffee", of: { cue: "after coffee" } });
  });

  it("doesn't overwrite an edit made while the model was thinking", async () => {
    db.habit = { ...base };
    generateStructured.mockImplementation(async () => {
      db.habit!.cue = "when i get home"; // the user edited it meanwhile
      return { cue: "After my coffee" };
    });
    schedulePolish(log, "h1", "u1");
    await flush();
    expect(db.writes).toBe(0);
  });

  it("never touches another user's habit", async () => {
    db.habit = { ...base, userId: "someone-else" };
    schedulePolish(log, "h1", "u1");
    await flush();
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("survives a failed model call", async () => {
    db.habit = { ...base };
    generateStructured.mockRejectedValue(new Error("overloaded"));
    schedulePolish(log, "h1", "u1");
    await flush();
    expect(db.writes).toBe(0);
  });

  it("skips a habit whose current text was already read", async () => {
    db.habit = { ...base, polished: { source: "ai", cue: "After coffee", of: { cue: "after coffee" } } };
    schedulePolish(log, "h1", "u1");
    await flush();
    expect(generateStructured).not.toHaveBeenCalled();
  });
});
