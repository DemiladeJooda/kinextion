/**
 * How Kinextion shows a user's own words back to them.
 *
 * People type the way they think: "after i get my coffe or whatever",
 * "because honestly im so lazy and i hate how i look". Played back word for
 * word in a reminder, that's at best clumsy and at worst a daily dose of
 * their harshest self-talk. So every habit carries a polished reading of its
 * free-text fields, written by the AI in the background, and the app shows
 * that instead. The raw text is never thrown away: it's what the user edits,
 * and what the model reads for context.
 *
 * Until the AI's version arrives (or if it never does), `basicTidy` makes the
 * raw text presentable without changing what it says.
 */

export const POLISHED_FIELDS = ["cue", "response", "craving", "backupPlan"] as const;
export type PolishedField = (typeof POLISHED_FIELDS)[number];

export interface HabitPolish {
  cue?: string;
  response?: string;
  craving?: string;
  backupPlan?: string;
  /** The why read like distress. It's never shown back or quoted in a
   *  reminder, and Kairo can check in instead. */
  concern?: boolean;
  /** The raw text each field was polished from. A field whose raw text has
   *  changed since is stale and falls back to basicTidy. */
  of: Partial<Record<PolishedField, string>>;
  source: "ai" | "basic";
}

const EDGE_FILLER = /^(?:(?:um+|uh+|like|so|ok(?:ay)?|well|idk|honestly|basically|i guess),?\s+)+/i;
const TRAILING_FILLER =
  /(?:,?\s+(?:or whatever|and stuff|and that|lol|lmao|haha+|idk|i guess|ig|tbh|or something))+[.!]*$/i;

/**
 * Presentable without rewording: whitespace, filler at the edges, the first
 * letter, a lone lower-case "i", runs of punctuation. Never adds or removes
 * meaning — that's the AI's job, and only with the user's words as the brief.
 */
export function basicTidy(text: string | null | undefined): string {
  if (!text) return "";
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(EDGE_FILLER, "").replace(TRAILING_FILLER, "");
  t = t.replace(/\bi\b/g, "I").replace(/\bim\b/gi, "I'm").replace(/\bive\b/gi, "I've");
  t = t.replace(/([!?.]){2,}/g, "$1").replace(/\s+([,.!?])/g, "$1").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/** Read a stored `polished` value defensively — it's a Json column. */
export function parsePolish(value: unknown): HabitPolish | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: HabitPolish = {
    of: {},
    source: v.source === "ai" ? "ai" : "basic",
    concern: v.concern === true,
  };
  const of = (v.of && typeof v.of === "object" ? v.of : {}) as Record<string, unknown>;
  for (const f of POLISHED_FIELDS) {
    if (typeof v[f] === "string" && (v[f] as string).trim()) out[f] = (v[f] as string).trim();
    if (typeof of[f] === "string") out.of[f] = of[f] as string;
  }
  return out;
}

export interface DisplayFields {
  cue: string;
  response: string;
  /** Empty when there's nothing to show — or when the why was flagged. */
  craving: string;
  backupPlan: string;
  concern: boolean;
  /** Which fields are showing the AI's reading rather than a basic tidy. */
  polishedByAi: PolishedField[];
}

/**
 * What to show for each field: the AI's reading when it was made from the
 * text that's there now, otherwise a basic tidy of the raw text.
 */
export function displayFields(habit: {
  cue?: string | null;
  response?: string | null;
  craving?: string | null;
  backupPlan?: string | null;
  polished?: unknown;
}): DisplayFields {
  const polish = parsePolish(habit.polished);
  const polishedByAi: PolishedField[] = [];
  const pick = (field: PolishedField): string => {
    const raw = habit[field] ?? "";
    if (!raw.trim()) return "";
    const fresh = polish && polish.of[field] === raw ? polish[field] : undefined;
    if (fresh && polish?.source === "ai") polishedByAi.push(field);
    return fresh ?? basicTidy(raw);
  };

  const concern = polish?.concern === true && polish.of.craving === (habit.craving ?? "");
  const display = {
    cue: pick("cue"),
    response: pick("response"),
    craving: pick("craving"),
    backupPlan: pick("backupPlan"),
  };
  return {
    ...display,
    craving: concern ? "" : display.craving,
    concern,
    polishedByAi: concern ? polishedByAi.filter((f) => f !== "craving") : polishedByAi,
  };
}

/** Do any free-text fields differ from what was last polished? */
export function needsPolish(habit: {
  cue?: string | null;
  response?: string | null;
  craving?: string | null;
  backupPlan?: string | null;
  polished?: unknown;
}): boolean {
  const polish = parsePolish(habit.polished);
  return POLISHED_FIELDS.some((f) => {
    const raw = habit[f] ?? "";
    if (!raw.trim()) return false;
    return polish?.source !== "ai" || polish.of[f] !== raw;
  });
}
