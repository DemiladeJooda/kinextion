import { describe, expect, it } from "vitest";
import { checkDue, formationNote, heatmap, readyToGraduate, srbaiScore } from "./index.js";

describe("srbaiScore", () => {
  it("is the mean of four 1–7 answers", () => {
    expect(srbaiScore([7, 6, 6, 5])).toBe(6);
    expect(srbaiScore([1, 2, 2, 2])).toBe(1.8);
  });
  it("refuses anything that isn't four answers from 1 to 7", () => {
    expect(() => srbaiScore([7, 7, 7])).toThrow();
    expect(() => srbaiScore([0, 7, 7, 7])).toThrow();
    expect(() => srbaiScore([7, 7, 7, 8])).toThrow();
  });
});

describe("checkDue", () => {
  const base = { status: "building", startDate: "2026-10-01", doneToday: true, lastCheck: null };
  it("asks once a week, right after a tick, for a habit at least a week old", () => {
    expect(checkDue(base, "2026-10-21")).toBe(true);
    expect(checkDue({ ...base, lastCheck: "2026-10-18" }, "2026-10-21")).toBe(false);
    expect(checkDue({ ...base, lastCheck: "2026-10-14" }, "2026-10-21")).toBe(true);
  });
  it("doesn't ask too early, before a tick, or once it's graduated", () => {
    expect(checkDue({ ...base, startDate: "2026-10-18" }, "2026-10-21")).toBe(false);
    expect(checkDue({ ...base, doneToday: false }, "2026-10-21")).toBe(false);
    expect(checkDue({ ...base, status: "established" }, "2026-10-21")).toBe(false);
  });
});

describe("readyToGraduate", () => {
  const pts = (...scores: number[]) => scores.map((score, i) => ({ date: `2026-10-${10 + i}`, score }));
  it("needs it high and levelled off over three checks", () => {
    expect(readyToGraduate(pts(5.6, 5.8, 6))).toBe(true);
    expect(readyToGraduate(pts(4, 5.6, 6))).toBe(false); // still climbing
    expect(readyToGraduate(pts(5.5, 5.6, 5.2))).toBe(false); // last one dipped below
    expect(readyToGraduate(pts(6, 6))).toBe(false); // too few
  });
});

describe("formationNote", () => {
  it("sets expectations instead of a finish line", () => {
    expect(formationNote("2026-10-15", "2026-10-21", null)).toMatch(/^Day 7\. Early days/);
    expect(formationNote("2026-09-01", "2026-10-21", 4)).toMatch(/about two months/);
    expect(formationNote("2026-07-01", "2026-10-21", 4)).toMatch(/Past the two-month mark/);
    expect(formationNote("2026-09-01", "2026-10-21", 6)).toMatch(/feeling automatic/);
  });
});

describe("heatmap", () => {
  it("lays out weeks Monday to Sunday and says what each day was", () => {
    const weeks = heatmap(
      { startDate: "2026-10-14", isDue: () => true },
      { done: new Set(["2026-10-19"]), minimum: new Set(["2026-10-20"]), rest: new Set(["2026-10-18"]) },
      "2026-10-21",
      2
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[1].weekStart).toBe("2026-10-19");
    const cells = Object.fromEntries(weeks.flatMap((w) => w.days.map((d) => [d.day, d.cell])));
    expect(cells["2026-10-13"]).toBe("before");
    expect(cells["2026-10-17"]).toBe("missed");
    expect(cells["2026-10-18"]).toBe("rest");
    expect(cells["2026-10-19"]).toBe("done");
    expect(cells["2026-10-20"]).toBe("minimum");
    expect(cells["2026-10-21"]).toBe("future"); // today, still open
    expect(cells["2026-10-22"]).toBe("future");
  });
});
