/**
 * Admission — you join because the community recognises you belong.
 *
 * Recognition only means something where recognition is possible, so the rule
 * changes with roster size. Small communities ask everyone and one objection
 * blocks; larger ones draw a panel by lot, which bounds how many people get
 * asked, keeps panel membership itself secret, and scales to any size.
 *
 * Pure: no I/O, no clock, no randomness except the generator passed in. The
 * API supplies the roster, the seats and the time, and applies the outcome.
 */

import { FOUNDING_QUORUM, STEWARD_FAST_TRACK_ROSTER } from "./constants.js";

export const ADMISSION_VERDICTS = ["belongs", "objects"] as const;
export type AdmissionVerdict = (typeof ADMISSION_VERDICTS)[number];

export interface AdmissionRule {
  /** "all" asks every active member; "sample" draws `panelSize` by lot. */
  panelMode: "all" | "sample";
  panelSize: number;
  minBelongs: number;
  maxObjections: number;
  /**
   * Whether a steward may admit on external proof. Never below
   * STEWARD_FAST_TRACK_ROSTER: the anonymity exists so people can object
   * without damaging a friendship, and an override puts that pressure back.
   */
  stewardFastTrack: boolean;
}

/**
 * The rule for a community of `rosterSize` active members (the applicant is
 * not counted — they aren't a member yet).
 *
 *   6–15    everyone        ≥3 belongs, zero objections
 *   16–50   panel of 7      ≥5 belongs, ≤1 objection
 *   51–150  panel of 9      ≥7 belongs, ≤2 objections
 *   151+    panel of 9      ≥7 belongs, ≤2 objections, steward fast-track
 *
 * An active community can shrink below the founding quorum as people leave.
 * It isn't punished for that; it asks everyone who's left, and needs as many
 * "belongs" as it can reasonably give, up to three.
 */
export function admissionRule(rosterSize: number): AdmissionRule {
  if (!Number.isInteger(rosterSize) || rosterSize < 1) {
    throw new Error("A community with no active members can't admit anyone");
  }

  if (rosterSize < FOUNDING_QUORUM) {
    return {
      panelMode: "all",
      panelSize: rosterSize,
      minBelongs: Math.min(3, rosterSize),
      maxObjections: 0,
      stewardFastTrack: false,
    };
  }
  if (rosterSize <= 15) {
    return {
      panelMode: "all",
      panelSize: rosterSize,
      minBelongs: 3,
      maxObjections: 0,
      stewardFastTrack: false,
    };
  }
  if (rosterSize <= 50) {
    return { panelMode: "sample", panelSize: 7, minBelongs: 5, maxObjections: 1, stewardFastTrack: false };
  }
  return {
    panelMode: "sample",
    panelSize: 9,
    minBelongs: 7,
    maxObjections: 2,
    stewardFastTrack: rosterSize > STEWARD_FAST_TRACK_ROSTER,
  };
}

export type AdmissionOutcome = "pending" | "admitted" | "denied" | "redraw";

export interface SeatState {
  verdict: AdmissionVerdict | null;
  /** A seat whose holder never answered and was replaced, or who left. */
  expired: boolean;
}

/**
 * Decide a join request from its seats.
 *
 * Decides early only when the outcome is already certain: too many
 * objections is final at once, and admission is final once no remaining
 * silent seat could add enough objections to change it. In an all-member
 * panel that means everyone has answered — nobody's chance to object is ever
 * cut off by a quick majority.
 *
 * At the deadline, enough "belongs" admits (silence isn't an objection);
 * otherwise the first round redraws and the second denies. Silence is not
 * recognition, so the process fails closed.
 */
export function evaluateAdmission(input: {
  rule: Pick<AdmissionRule, "minBelongs" | "maxObjections">;
  seats: readonly SeatState[];
  round: number;
  deadlinePassed: boolean;
}): AdmissionOutcome {
  const { rule, seats, round, deadlinePassed } = input;

  let belongs = 0;
  let objections = 0;
  let silent = 0;
  for (const seat of seats) {
    if (seat.verdict === "belongs") belongs++;
    else if (seat.verdict === "objects") objections++;
    else if (!seat.expired) silent++;
  }

  if (objections > rule.maxObjections) return "denied";
  if (belongs >= rule.minBelongs && objections + silent <= rule.maxObjections) return "admitted";

  if (!deadlinePassed) return "pending";
  if (belongs >= rule.minBelongs) return "admitted";
  return round === 1 ? "redraw" : "denied";
}

export interface PanelCandidate {
  userId: string;
  /** Seats this member currently holds on other open requests. */
  openSeats: number;
}

/**
 * Draw a panel by lot.
 *
 * Shuffle first, then prefer members sitting on the fewest other panels, so
 * the load spreads and no one person ends up deciding every application.
 * Small rosters can't always avoid overlap, so this prefers rather than
 * forbids.
 *
 * `rng` returns a float in [0, 1). The API passes a cryptographic source;
 * tests pass a seeded one so draws are reproducible.
 */
export function drawPanel(
  candidates: readonly PanelCandidate[],
  size: number,
  rng: () => number
): string[] {
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Array.prototype.sort is stable, so the shuffle breaks ties.
  pool.sort((a, b) => a.openSeats - b.openSeats);
  return pool.slice(0, Math.max(0, size)).map((c) => c.userId);
}

/** Deterministic [0, 1) generator for tests and reproducible draws. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * URL-safe slug from a community name. Uniqueness is the caller's job — it
 * appends a suffix on collision.
 */
export function slugifyCommunityName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "community";
}
