import { describe, expect, it } from "vitest";
import {
  admissionRule,
  drawPanel,
  evaluateAdmission,
  seededRng,
  slugifyCommunityName,
  type AdmissionVerdict,
  type SeatState,
} from "./admission.js";

const seats = (...verdicts: Array<AdmissionVerdict | null | "expired">): SeatState[] =>
  verdicts.map((v) =>
    v === "expired" ? { verdict: null, expired: true } : { verdict: v, expired: false }
  );

describe("admissionRule", () => {
  it.each([
    [6, "all", 6, 3, 0, false],
    [15, "all", 15, 3, 0, false],
    [16, "sample", 7, 5, 1, false],
    [50, "sample", 7, 5, 1, false],
    [51, "sample", 9, 7, 2, false],
    [150, "sample", 9, 7, 2, false],
    [151, "sample", 9, 7, 2, true],
    [5000, "sample", 9, 7, 2, true],
  ] as const)(
    "roster %i → %s panel of %i, ≥%i belongs, ≤%i objections, fast-track %s",
    (roster, panelMode, panelSize, minBelongs, maxObjections, stewardFastTrack) => {
      expect(admissionRule(roster)).toEqual({
        panelMode,
        panelSize,
        minBelongs,
        maxObjections,
        stewardFastTrack,
      });
    }
  );

  it("still admits in an active community that has shrunk below the founding quorum", () => {
    expect(admissionRule(5)).toMatchObject({ panelMode: "all", panelSize: 5, minBelongs: 3, maxObjections: 0 });
    expect(admissionRule(2)).toMatchObject({ panelSize: 2, minBelongs: 2 });
    expect(admissionRule(1)).toMatchObject({ panelSize: 1, minBelongs: 1 });
  });

  it("refuses a community with nobody left in it", () => {
    expect(() => admissionRule(0)).toThrow();
  });

  it("never offers a steward override at or below 150", () => {
    for (let n = 1; n <= 150; n++) expect(admissionRule(n).stewardFastTrack).toBe(false);
  });
});

describe("evaluateAdmission", () => {
  const small = admissionRule(12); // everyone, ≥3, zero objections
  const medium = admissionRule(60); // panel 9, ≥7, ≤2

  it("one objection blocks a 12-member community immediately", () => {
    expect(
      evaluateAdmission({
        rule: small,
        seats: seats("belongs", "belongs", "belongs", "belongs", "objects", ...Array(7).fill(null)),
        round: 1,
        deadlinePassed: false,
      })
    ).toBe("denied");
  });

  it("the same single objection does not block a 60-member community", () => {
    expect(
      evaluateAdmission({
        rule: medium,
        seats: seats(...Array(8).fill("belongs"), "objects"),
        round: 1,
        deadlinePassed: false,
      })
    ).toBe("admitted");
  });

  it("does not let a quick majority cut off anyone's chance to object in a small community", () => {
    // Eleven say belongs; one member hasn't answered and still could object.
    expect(
      evaluateAdmission({
        rule: small,
        seats: seats(...Array(11).fill("belongs"), null),
        round: 1,
        deadlinePassed: false,
      })
    ).toBe("pending");
  });

  it("admits early when no remaining silent seat could change the result", () => {
    // Panel of 9, 7 belongs, 0 objections, 2 silent: the most they can add is
    // 2 objections, which is still within the limit.
    expect(
      evaluateAdmission({
        rule: medium,
        seats: seats(...Array(7).fill("belongs"), null, null),
        round: 1,
        deadlinePassed: false,
      })
    ).toBe("admitted");
  });

  it("waits while three silent seats could still add a third objection", () => {
    expect(
      evaluateAdmission({
        rule: medium,
        seats: seats(...Array(7).fill("belongs"), "objects", null, null),
        round: 1,
        deadlinePassed: false,
      })
    ).toBe("pending");
  });

  it("treats silence at the deadline as not-an-objection when there's enough recognition", () => {
    expect(
      evaluateAdmission({
        rule: small,
        seats: seats("belongs", "belongs", "belongs", ...Array(9).fill(null)),
        round: 1,
        deadlinePassed: true,
      })
    ).toBe("admitted");
  });

  it("fails closed: silence redraws once, then denies", () => {
    const quiet = seats("belongs", ...Array(8).fill(null));
    expect(evaluateAdmission({ rule: medium, seats: quiet, round: 1, deadlinePassed: true })).toBe("redraw");
    expect(evaluateAdmission({ rule: medium, seats: quiet, round: 2, deadlinePassed: true })).toBe("denied");
  });

  it("keeps the verdicts of seats that voted before being replaced", () => {
    // Round 2: four belongs carried over from round 1, three more from the
    // redraw, and the expired silent seats don't count either way.
    expect(
      evaluateAdmission({
        rule: medium,
        seats: seats("belongs", "belongs", "belongs", "belongs", "expired", "expired", "belongs", "belongs", "belongs", null, null),
        round: 2,
        deadlinePassed: true,
      })
    ).toBe("admitted");
  });
});

describe("drawPanel", () => {
  const roster = (n: number, openSeats = () => 0) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, openSeats: openSeats() }));

  it("draws exactly the panel size, without repeats", () => {
    const panel = drawPanel(roster(40), 9, seededRng(1));
    expect(panel).toHaveLength(9);
    expect(new Set(panel).size).toBe(9);
  });

  it("is reproducible for a seed and varies across seeds", () => {
    expect(drawPanel(roster(40), 9, seededRng(7))).toEqual(drawPanel(roster(40), 9, seededRng(7)));
    expect(drawPanel(roster(40), 9, seededRng(7))).not.toEqual(drawPanel(roster(40), 9, seededRng(8)));
  });

  it("prefers members sitting on the fewest other panels", () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => ({ userId: `busy${i}`, openSeats: 2 })),
      ...Array.from({ length: 7 }, (_, i) => ({ userId: `free${i}`, openSeats: 0 })),
    ];
    const panel = drawPanel(candidates, 7, seededRng(3));
    expect(panel.every((id) => id.startsWith("free"))).toBe(true);
  });

  it("returns everyone when the roster is smaller than the panel", () => {
    expect(drawPanel(roster(4), 7, seededRng(1))).toHaveLength(4);
  });

  it("spreads draws across the roster over many applications", () => {
    const counts = new Map<string, number>();
    const rng = seededRng(42);
    for (let i = 0; i < 400; i++) {
      for (const id of drawPanel(roster(30), 7, rng)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Everyone gets drawn, and nobody is drawn wildly more than their share (~93).
    expect(counts.size).toBe(30);
    for (const n of counts.values()) expect(n).toBeGreaterThan(50);
  });
});

describe("slugifyCommunityName", () => {
  it("makes a URL-safe slug", () => {
    expect(slugifyCommunityName("Favour House Church")).toBe("favour-house-church");
    expect(slugifyCommunityName("OU Class of 2026!")).toBe("ou-class-of-2026");
    expect(slugifyCommunityName("  Café Hoopers  ")).toBe("cafe-hoopers");
  });

  it("never returns an empty slug", () => {
    expect(slugifyCommunityName("🔥🔥🔥")).toBe("community");
  });

  it("caps length without leaving a trailing hyphen", () => {
    const slug = slugifyCommunityName("a".repeat(39) + " bbbbbb");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});
