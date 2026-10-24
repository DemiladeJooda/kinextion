import { describe, expect, it } from "vitest";
import {
  dismissConcern,
  emptyUsage,
  recordHabitLog,
  recordOpen,
  usageConcern,
  type UsageLog,
} from "./index.js";

const TODAY = "2026-10-21";
const times = (n: number, f: (l: UsageLog) => UsageLog, start: UsageLog) =>
  Array.from({ length: n }).reduce<UsageLog>((l) => f(l), start);

describe("usageConcern", () => {
  it("is quiet for ordinary use", () => {
    let log = times(8, (l) => recordOpen(l, TODAY), emptyUsage(TODAY));
    log = recordHabitLog(log, TODAY, 9, "h1");
    expect(usageConcern(log, TODAY)).toBeNull();
  });

  it("notices dozens of opens in a day", () => {
    const log = times(30, (l) => recordOpen(l, TODAY), emptyUsage(TODAY));
    expect(usageConcern(log, TODAY)?.kind).toBe("opens");
  });

  it("notices logging after midnight on three nights in a week", () => {
    let log = emptyUsage(TODAY);
    for (const d of ["2026-10-16", "2026-10-18", "2026-10-21"]) log = recordHabitLog(log, d, 1, "h1");
    expect(usageConcern(log, TODAY)?.kind).toBe("late");
  });

  it("doesn't count late nights from more than a week ago", () => {
    let log = emptyUsage(TODAY);
    for (const d of ["2026-10-10", "2026-10-12", "2026-10-21"]) log = recordHabitLog(log, d, 1, "h1");
    expect(usageConcern(log, TODAY)).toBeNull();
  });

  it("notices toggling one habit back and forth, by name", () => {
    const log = times(6, (l) => recordHabitLog(l, TODAY, 14, "h1"), emptyUsage(TODAY));
    expect(usageConcern(log, TODAY, () => "Push-ups")).toMatchObject({
      kind: "toggling",
      title: "Going back and forth on Push-ups?",
    });
  });

  it("stays quiet for the day once dismissed, and the week for late nights", () => {
    let log = times(30, (l) => recordOpen(l, TODAY), emptyUsage(TODAY));
    log = dismissConcern(log, "opens", TODAY);
    expect(usageConcern(log, TODAY)).toBeNull();

    let late = emptyUsage(TODAY);
    for (const d of ["2026-10-16", "2026-10-18", "2026-10-21"]) late = recordHabitLog(late, d, 2, "h1");
    late = dismissConcern(late, "late", "2026-10-19");
    expect(usageConcern(late, TODAY)).toBeNull();
  });

  it("never blocks or shames — every message is an invitation", () => {
    const log = times(30, (l) => recordOpen(l, TODAY), emptyUsage(TODAY));
    const c = usageConcern(log, TODAY)!;
    expect(c.body).not.toMatch(/too much|stop|limit|addict/i);
  });

  it("keeps the log small", () => {
    let log = emptyUsage("2026-09-01");
    log = recordOpen(log, "2026-09-01");
    log = recordOpen(log, TODAY);
    expect(Object.keys(log.opens)).toEqual([TODAY]);
  });
});
