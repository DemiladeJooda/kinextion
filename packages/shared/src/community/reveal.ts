/**
 * The reveal — pure.
 *
 * When a week closes, the room learns where it landed. The words matter as
 * much as the numbers: a community holds many views, so the result is never
 * "this community believes". That sentence is a product decision, which is why
 * it's a constant with a test rather than a string in a screen.
 */

export const REVEAL_HEADLINE = "Here's where the room landed this week.";

export interface ReactionCounts {
  agree: number;
  mixed: number;
  disagree: number;
}

/**
 * Whole percentages that always sum to 100 (or are all zero when nobody
 * reacted), using largest remainders — so 1/3, 1/3, 1/3 reads 34/33/33 rather
 * than an impossible 33/33/33.
 */
export function revealPercentages(counts: ReactionCounts): { agreePct: number; mixedPct: number; disagreePct: number } {
  const keys = ["agree", "mixed", "disagree"] as const;
  const total = keys.reduce((sum, k) => sum + counts[k], 0);
  if (total === 0) return { agreePct: 0, mixedPct: 0, disagreePct: 0 };

  const exact = keys.map((k) => (counts[k] * 100) / total);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, i) => ({ i, remainder: value - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i]++;
    remaining--;
  }
  return { agreePct: floors[0], mixedPct: floors[1], disagreePct: floors[2] };
}
