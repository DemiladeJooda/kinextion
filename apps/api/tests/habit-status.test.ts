/**
 * Pausing never counts as a run of misses: on restart, the scheduled days
 * spent paused are stored as neutral rest days.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const created: Array<{ data: Array<Record<string, unknown>>; skipDuplicates?: boolean }> = [];
vi.mock("@kinextion/database", () => ({
  prisma: {
    habitLog: {
      createMany: async (args: { data: Array<Record<string, unknown>>; skipDuplicates?: boolean }) => {
        created.push(args);
        return { count: args.data.length };
      },
    },
  },
}));

const { statusSideEffects } = await import("../src/lib/habit-status.js");

const base = {
  id: "h1",
  userId: "u1",
  status: "building",
  pausedOn: null as Date | null,
  frequency: "daily",
  targetDays: null as unknown,
  perWeekTarget: null,
};

beforeEach(() => {
  created.length = 0;
});

describe("statusSideEffects", () => {
  it("records the day a habit is paused", async () => {
    expect(await statusSideEffects(base, "paused", "2026-10-21")).toEqual({
      pausedOn: new Date("2026-10-21T00:00:00.000Z"),
    });
  });

  it("turns each paused scheduled day into a rest day on restart, keeping real logs", async () => {
    const paused = { ...base, status: "paused", pausedOn: new Date("2026-10-17T00:00:00Z") };
    const extra = await statusSideEffects(paused, "building", "2026-10-21");
    expect(extra).toEqual({ pausedOn: null });
    expect(created[0].skipDuplicates).toBe(true);
    expect(created[0].data.map((d) => (d.date as Date).toISOString().slice(0, 10))).toEqual([
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ]);
    expect(created[0].data[0]).toMatchObject({ completed: false, state: "rest", source: "pause" });
  });

  it("only fills days the habit was actually scheduled", async () => {
    const paused = {
      ...base,
      status: "paused",
      frequency: "custom",
      targetDays: [1, 3, 5],
      pausedOn: new Date("2026-10-17T00:00:00Z"),
    };
    await statusSideEffects(paused, "building", "2026-10-21");
    expect(created[0].data.map((d) => (d.date as Date).toISOString().slice(0, 10))).toEqual(["2026-10-19"]);
  });

  it("does nothing when the status isn't changing", async () => {
    expect(await statusSideEffects(base, "building", "2026-10-21")).toEqual({});
    expect(await statusSideEffects(base, undefined, "2026-10-21")).toEqual({});
    expect(created).toHaveLength(0);
  });
});
