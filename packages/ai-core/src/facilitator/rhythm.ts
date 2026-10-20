/**
 * The facilitator's sense of a room's rhythm — pure.
 *
 * A community that has talked about relationships three weeks running gets
 * something else. A run of heavy weeks gets some air; a room that only ever
 * picks light questions gets offered something with more weight. The room
 * still votes. This only shapes what's on the ballot.
 *
 * Nothing here looks at what would travel, perform or earn. The conversation
 * chooses the money; the money never chooses the conversation.
 */

import { LIGHT_THEMES, TOPIC_THEMES, topicKeyFor, type TopicTheme } from "@kinextion/shared";

export interface RhythmGuidance {
  /** Themes the room has had enough of for now. */
  avoid: TopicTheme[];
  /** Which way to lean, if any. */
  lean: "lighter" | "deeper" | null;
}

const RUN = 3;

const isTheme = (t: string | null | undefined): t is TopicTheme =>
  !!t && (TOPIC_THEMES as readonly string[]).includes(t);

/** `recentThemes` newest first — one entry per past week, null where unknown. */
export function rhythmGuidance(recentThemes: readonly (string | null)[]): RhythmGuidance {
  const last = recentThemes.slice(0, RUN);
  const known = last.filter(isTheme);
  const avoid: TopicTheme[] = [];

  if (known.length === RUN && known.every((t) => t === known[0])) avoid.push(known[0]);

  let lean: RhythmGuidance["lean"] = null;
  if (known.length === RUN) {
    const light = known.filter((t) => LIGHT_THEMES.includes(t)).length;
    if (light === 0) lean = "lighter";
    else if (light === RUN) lean = "deeper";
  }
  return { avoid, lean };
}

export interface CandidateOption {
  text: string;
  theme: TopicTheme;
  rationale: string | null;
}

/**
 * Choose the ballot from candidates, in order of preference.
 *
 * Drops duplicates and anything that repeats a recent week's question, then
 * avoided themes — but only while there are enough options left, because an
 * honest ballot beats a short one. Finally honours the lean by making sure at
 * least one option goes that way.
 */
export function selectOptions(
  candidates: readonly CandidateOption[],
  input: { recentKeys: ReadonlySet<string>; guidance: RhythmGuidance; count: number }
): CandidateOption[] {
  const seen = new Set<string>();
  const fresh = candidates.filter((c) => {
    const key = topicKeyFor(c.text);
    if (seen.has(key) || input.recentKeys.has(key)) return false;
    seen.add(key);
    return true;
  });

  const preferred = fresh.filter((c) => !input.guidance.avoid.includes(c.theme));
  const pool = preferred.length >= input.count ? preferred : fresh;
  const chosen = pool.slice(0, input.count);

  const wantsLight = input.guidance.lean === "lighter";
  const wantsDeep = input.guidance.lean === "deeper";
  const matches = (c: CandidateOption) =>
    wantsLight ? LIGHT_THEMES.includes(c.theme) : wantsDeep ? !LIGHT_THEMES.includes(c.theme) : true;

  if ((wantsLight || wantsDeep) && chosen.length > 0 && !chosen.some(matches)) {
    const swap = pool.slice(input.count).find(matches);
    if (swap) chosen[chosen.length - 1] = swap;
  }
  return chosen;
}
