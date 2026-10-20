/**
 * Circles — pure.
 *
 * A room is bounded by the listener's week: past CIRCLE_MAX responses people
 * stop finishing it. So a community with more speakers than that gets more
 * rooms, not a bigger one. Everyone speaks once and listens inside their
 * circle; the week's result always aggregates across every circle.
 *
 * People are placed as they speak, because nobody knows who'll speak until
 * they do. The number of circles is sized from how many people chose this
 * community for the week, so the first speakers are spread across the right
 * number of circles instead of filling one and stranding the next person
 * alone in another. Most communities never need more than one.
 */

import { CIRCLE_MAX } from "./constants.js";

export interface CircleState {
  id: string;
  ordinal: number;
  members: readonly string[];
}

export type CirclePlacement = { kind: "existing"; circleId: string } | { kind: "new"; ordinal: number };

/** FNV-1a, for turning a stable string into a seed. Not for anything secret. */
function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The order a listener hears a room in: shuffled by a seed from who's
 * listening and what topic, so it's stable when you come back, different for
 * every other member, and impossible to climb. Nobody is "first in the room"
 * for everyone.
 */
export function seededOrder<T>(items: readonly T[], seed: string): T[] {
  let a = hashSeed(seed);
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function circleCountFor(expectedSpeakers: number): number {
  return Math.max(1, Math.ceil(expectedSpeakers / CIRCLE_MAX));
}

/**
 * Where the next speaker sits.
 *
 * Keeps circles within one member of each other in size, and among those
 * picks the circle sharing the fewest members with circles this person has
 * sat in recently — so over a season you hear from more of your community,
 * and nobody can become the fixed voice of one.
 */
export function assignCircle(input: {
  circles: readonly CircleState[];
  expectedSpeakers: number;
  /** Member id → how many recent weeks they shared a circle with this speaker. */
  recentPartners: ReadonlyMap<string, number>;
}): CirclePlacement {
  const nextOrdinal = input.circles.reduce((max, c) => Math.max(max, c.ordinal + 1), 0);
  const desired = Math.max(circleCountFor(input.expectedSpeakers), input.circles.length);

  type Candidate = { placement: CirclePlacement; size: number; overlap: number; ordinal: number };
  const candidates: Candidate[] = input.circles
    .filter((c) => c.members.length < CIRCLE_MAX)
    .map((c) => ({
      placement: { kind: "existing", circleId: c.id },
      size: c.members.length,
      overlap: c.members.reduce((sum, m) => sum + (input.recentPartners.get(m) ?? 0), 0),
      ordinal: c.ordinal,
    }));

  if (input.circles.length < desired || candidates.length === 0) {
    candidates.push({ placement: { kind: "new", ordinal: nextOrdinal }, size: 0, overlap: 0, ordinal: nextOrdinal });
  }

  const smallest = Math.min(...candidates.map((c) => c.size));
  const balanced = candidates.filter((c) => c.size <= smallest + 1);
  balanced.sort((a, b) => a.overlap - b.overlap || a.size - b.size || a.ordinal - b.ordinal);
  return balanced[0].placement;
}
