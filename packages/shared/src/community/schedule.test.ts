import { describe, expect, it } from "vitest";
import { CYCLE_SCHEDULE } from "./constants.js";
import {
  cycleBoundaries,
  isWeekKey,
  mondayOfWeek,
  shiftWeekKey,
  stageFor,
  weekKeyFor,
  zonedParts,
  zonedTimeToUtc,
} from "./schedule.js";

const iso = (s: string) => new Date(s);

describe("zonedTimeToUtc (America/Chicago)", () => {
  it("converts a CDT wall time (UTC−5)", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 9, day: 14 }, 0, 0).toISOString()).toBe(
      "2026-09-14T05:00:00.000Z"
    );
  });

  it("converts a CST wall time (UTC−6)", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 12, day: 7 }, 0, 0).toISOString()).toBe(
      "2026-12-07T06:00:00.000Z"
    );
  });

  it("round-trips through zonedParts", () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 3, day: 8 }, 21, 0);
    expect(zonedParts(utc)).toMatchObject({ year: 2026, month: 3, day: 8, hour: 21, minute: 0 });
  });
});

describe("weekKeyFor", () => {
  it("names the ISO week on Central calendars", () => {
    // Monday 14 September 2026, midday Dallas.
    expect(weekKeyFor(iso("2026-09-14T17:00:00Z"))).toBe("2026-W38");
  });

  it("turns over at Central midnight, not UTC midnight", () => {
    // 23:59:59 Sunday in Dallas is already Monday in UTC.
    expect(weekKeyFor(iso("2026-09-14T04:59:59Z"))).toBe("2026-W37");
    expect(weekKeyFor(iso("2026-09-14T05:00:00Z"))).toBe("2026-W38");
  });

  it("handles a 53-week ISO year across the new year", () => {
    // 2026 starts on a Thursday, so it has a week 53 that runs into 2027.
    expect(weekKeyFor(iso("2026-12-31T18:00:00Z"))).toBe("2026-W53");
    // New Year's Eve 21:00 in Dallas — already 1 January in UTC.
    expect(weekKeyFor(iso("2027-01-01T03:00:00Z"))).toBe("2026-W53");
    expect(weekKeyFor(iso("2027-01-04T12:00:00Z"))).toBe("2027-W01");
  });

  it("assigns early-January days to the previous ISO year when they belong there", () => {
    // 1 January 2027 is a Friday, so it's in 2026-W53.
    expect(weekKeyFor(iso("2027-01-02T18:00:00Z"))).toBe("2026-W53");
  });
});

describe("week keys", () => {
  it("finds the Monday a week starts on", () => {
    expect(mondayOfWeek("2026-W38")).toEqual({ year: 2026, month: 9, day: 14 });
    expect(mondayOfWeek("2027-W01")).toEqual({ year: 2027, month: 1, day: 4 });
    expect(mondayOfWeek("2026-W01")).toEqual({ year: 2025, month: 12, day: 29 });
  });

  it("rejects malformed and impossible keys rather than rolling over", () => {
    expect(isWeekKey("2026-W38")).toBe(true);
    expect(isWeekKey("2026-W53")).toBe(true);
    expect(isWeekKey("2027-W53")).toBe(false); // 2027 has 52 weeks
    expect(isWeekKey("2026-W60")).toBe(false);
    expect(isWeekKey("2026-38")).toBe(false);
    expect(isWeekKey("")).toBe(false);
  });

  it("shifts across year boundaries", () => {
    expect(shiftWeekKey("2026-W53", 1)).toBe("2027-W01");
    expect(shiftWeekKey("2027-W01", -1)).toBe("2026-W53");
    expect(shiftWeekKey("2026-W38", -1)).toBe("2026-W37");
  });
});

describe("cycleBoundaries", () => {
  it("lays out a week in Dallas time", () => {
    const b = cycleBoundaries("2026-W38");
    // Gathering: Wednesday 9 Sep 00:00 CDT. Voting: Friday 11 Sep 18:00 CDT.
    expect(b.gatheringOpensAt.toISOString()).toBe("2026-09-09T05:00:00.000Z");
    expect(b.votingOpensAt.toISOString()).toBe("2026-09-11T23:00:00.000Z");
    // Room: Monday 14 Sep 00:00 CDT to Sunday 20 Sep 21:00 CDT.
    expect(b.opensAt.toISOString()).toBe("2026-09-14T05:00:00.000Z");
    expect(b.closesAt.toISOString()).toBe("2026-09-21T02:00:00.000Z");
  });

  it("keeps wall times fixed through spring-forward (8 March 2026)", () => {
    const b = cycleBoundaries("2026-W10");
    // Opens Monday 2 March in CST, closes Sunday 8 March in CDT.
    expect(b.opensAt.toISOString()).toBe("2026-03-02T06:00:00.000Z");
    expect(b.closesAt.toISOString()).toBe("2026-03-09T02:00:00.000Z");
    expect(zonedParts(b.closesAt).hour).toBe(21);
  });

  it("keeps wall times fixed through fall-back (1 November 2026)", () => {
    const b = cycleBoundaries("2026-W44");
    expect(b.opensAt.toISOString()).toBe("2026-10-26T05:00:00.000Z");
    expect(b.closesAt.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(zonedParts(b.closesAt).hour).toBe(21);
  });

  it("puts every boundary in order", () => {
    for (const key of ["2026-W10", "2026-W38", "2026-W44", "2026-W53", "2027-W01"]) {
      const b = cycleBoundaries(key);
      expect(b.gatheringOpensAt < b.votingOpensAt).toBe(true);
      expect(b.votingOpensAt < b.opensAt).toBe(true);
      expect(b.opensAt < b.closesAt).toBe(true);
    }
  });

  it("chains weeks: one room closes before the next one opens", () => {
    const a = cycleBoundaries("2026-W38");
    const b = cycleBoundaries("2026-W39");
    expect(a.closesAt < b.opensAt).toBe(true);
    // The next week's topic vote is already settled by the time its room opens.
    expect(b.votingOpensAt < a.closesAt).toBe(true);
  });

  it("never schedules a boundary inside the DST transition hours", () => {
    for (const b of Object.values(CYCLE_SCHEDULE)) {
      expect(b.hour < 1 || b.hour >= 3).toBe(true);
    }
  });
});

describe("stageFor", () => {
  const cycle = cycleBoundaries("2026-W38");
  const ms = (d: Date, delta: number) => new Date(d.getTime() + delta);

  it("resolves every stage at the exact millisecond of each boundary", () => {
    expect(stageFor(cycle, ms(cycle.gatheringOpensAt, -1))).toBe("scheduled");
    expect(stageFor(cycle, cycle.gatheringOpensAt)).toBe("gathering");
    expect(stageFor(cycle, ms(cycle.votingOpensAt, -1))).toBe("gathering");
    expect(stageFor(cycle, cycle.votingOpensAt)).toBe("voting");
    expect(stageFor(cycle, ms(cycle.opensAt, -1))).toBe("voting");
    expect(stageFor(cycle, cycle.opensAt)).toBe("open");
    expect(stageFor(cycle, ms(cycle.closesAt, -1))).toBe("open");
    expect(stageFor(cycle, cycle.closesAt)).toBe("closed");
  });

  it("reports settled only when settlement has actually happened", () => {
    const later = ms(cycle.closesAt, 3_600_000);
    expect(stageFor({ ...cycle, settledAt: null }, later)).toBe("closed");
    expect(stageFor({ ...cycle, settledAt: later }, later)).toBe("settled");
  });

  it("walks a full week without touching the real clock", () => {
    const seen = new Set<string>();
    for (let t = cycle.gatheringOpensAt.getTime() - 1; t <= cycle.closesAt.getTime(); t += 3_600_000) {
      seen.add(stageFor(cycle, new Date(t)));
    }
    seen.add(stageFor(cycle, cycle.closesAt));
    expect([...seen]).toEqual(["scheduled", "gathering", "voting", "open", "closed"]);
  });
});
