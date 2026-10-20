/**
 * Ballots and topics — pure.
 *
 * One decision machine for everything a community chooses together: the
 * week's topic, whether to close, what the chest is for. Tallies are computed
 * here and applied by the API; they're never sent to anyone while a ballot is
 * open, and topic ballots never reveal them at all — only what won.
 */

import { CLOSURE_MIN_TURNOUT, CLOSURE_SUPERMAJORITY } from "./constants.js";

export interface BallotOptionLike {
  id: string;
  ordinal: number;
}

/**
 * The winning option. Most votes wins; a tie goes to the lowest ordinal, and
 * so does a ballot nobody voted on — the facilitator orders options by how
 * strongly the room pointed at them, so the first is the honest default.
 * Deterministic: the same votes always produce the same topic, however many
 * times the page is refreshed or the job re-runs.
 */
export function tallyBallot(
  options: readonly BallotOptionLike[],
  votes: readonly { optionId: string }[]
): { winnerId: string | null; counts: Map<string, number> } {
  const counts = new Map<string, number>(options.map((o) => [o.id, 0]));
  for (const v of votes) {
    if (counts.has(v.optionId)) counts.set(v.optionId, counts.get(v.optionId)! + 1);
  }
  let winner: BallotOptionLike | null = null;
  for (const option of [...options].sort((a, b) => a.ordinal - b.ordinal)) {
    if (!winner || counts.get(option.id)! > counts.get(winner.id)!) winner = option;
  }
  return { winnerId: winner?.id ?? null, counts };
}

/**
 * Whether a closure vote closes the community.
 *
 * Needs both enough people to have voted and a supermajority of those who
 * did. A community a handful of people want gone, while most never showed up,
 * stays.
 */
export function decideClosure(input: {
  closeVotes: number;
  keepVotes: number;
  activeMembers: number;
}): "close" | "keep" {
  const cast = input.closeVotes + input.keepVotes;
  if (input.activeMembers <= 0 || cast === 0) return "keep";
  if (cast / input.activeMembers < CLOSURE_MIN_TURNOUT) return "keep";
  return input.closeVotes / cast >= CLOSURE_SUPERMAJORITY ? "close" : "keep";
}

const STOPWORDS = new Set(
  (
    "a an the is are was were be been being to of in on for and or but it its do does did " +
    "should would could can will shall may might must you we our your i me my us they them " +
    "their he she his her what how why when where who which about with by at from as that " +
    "this these those than then there here more less most so if not no yes just really " +
    "ever still any some all into out up down over under"
  ).split(" ")
);

/**
 * A normalised key for a question, so the same question asked years apart can
 * be compared: "Would you leave Oklahoma for your dream job?" and "Would you
 * leave Oklahoma for a dream job?" share a key. Word order is ignored and
 * filler words dropped; this is deliberately coarse.
 */
export function topicKeyFor(text: string): string {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const key = [...new Set(words)].sort().join("-").slice(0, 80);
  return key || "untitled";
}
