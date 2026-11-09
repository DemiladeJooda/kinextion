/**
 * The signal taxonomy: one vocabulary for everything Kinextion reads.
 *
 * The rule for being on this list is that a signal has a real source: an
 * integration in apps/api/src/modules/integrations, or something the person
 * tells the app. If nothing can supply it, it doesn't belong here, however
 * good it would sound on the website.
 *
 * `status` keeps the website honest about timing:
 *   live  the app reads this today
 *   next  an integration can supply it and it's on the list in
 *         docs/website-to-mobile.md, but the app doesn't read it yet
 *
 * Colour says what kind of signal it is. Distance from the centre says how
 * much of Kinextion's finite attention it earns.
 */

export const SIGNAL_CATEGORIES = [
  { id: "body", label: "Body", color: "#00C47A" },
  { id: "mind", label: "Mind & mood", color: "#A855F7" },
  { id: "habits", label: "Habits & history", color: "#EC4899" },
  { id: "context", label: "Your life", color: "#3B82F6" },
  { id: "people", label: "People", color: "#0ABAB5" },
] as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];
export type CategoryId = SignalCategory["id"];

export const SIGNAL_TIERS = [
  { id: "core", label: "Core", kicker: "Never forgotten", radius: 92, orbSize: 52, weight: 1, speed: 132 },
  { id: "daily", label: "Daily", kicker: "Read fresh each day", radius: 150, orbSize: 44, weight: 0.72, speed: 96 },
  { id: "pattern", label: "Pattern", kicker: "Kept as a trend", radius: 208, orbSize: 38, weight: 0.46, speed: 68 },
  { id: "ambient", label: "Ambient", kicker: "Read when it matters", radius: 262, orbSize: 34, weight: 0.24, speed: 44 },
] as const;

export type SignalTier = (typeof SIGNAL_TIERS)[number];
export type TierId = SignalTier["id"];

/** Where a signal's data actually comes from. */
export const SIGNAL_SOURCES = [
  { id: "you", label: "You, in the app" },
  { id: "guides", label: "Your guides" },
  { id: "habits", label: "Your habits" },
  { id: "community", label: "Community" },
  { id: "whoop", label: "Whoop" },
  { id: "oura", label: "Oura" },
  { id: "strava", label: "Strava" },
  { id: "health", label: "Apple Health / Health Connect" },
  { id: "calendar", label: "Google / Outlook Calendar" },
] as const;

export type SourceId = (typeof SIGNAL_SOURCES)[number]["id"];

export type SignalStatus = "live" | "next";

export interface SignalDef {
  readonly id: string;
  readonly label: string;
  /** Sample reading, shown as an example member. Never real data. */
  readonly example: string;
  /** One line on what it changes. */
  readonly does: string;
  readonly category: CategoryId;
  readonly tier: TierId;
  readonly sources: readonly SourceId[];
  readonly status: SignalStatus;
}

export const SIGNALS: readonly SignalDef[] = [
  // Core: constraints and identity.
  { id: "limits", label: "Injuries & limits", example: "Left knee · no deep squats", does: "Every suggestion passes through it first.", category: "context", tier: "core", sources: ["guides", "you"], status: "live" },
  { id: "becoming", label: "Who you're becoming", example: "Someone who moves every day", does: "Your habits and progress are told in these terms.", category: "mind", tier: "core", sources: ["you"], status: "live" },
  { id: "memory", label: "What worked before", example: "Morning walks stuck. 6am gym didn't.", does: "It starts from your history, not day one.", category: "habits", tier: "core", sources: ["guides", "habits"], status: "live" },
  { id: "conversations", label: "What you've said", example: "You never re-explain yourself", does: "Althea and Kairo share one memory of you.", category: "mind", tier: "core", sources: ["guides"], status: "live" },
  { id: "cycle", label: "Cycle phase", example: "Luteal · lighter week", does: "It affects people differently, so it learns your pattern.", category: "body", tier: "core", sources: ["health"], status: "next" },

  // Daily: the state of today.
  { id: "oura", label: "Oura sleep", example: "Sleep 71 · readiness 64", does: "Last night reshapes today's plan.", category: "body", tier: "daily", sources: ["oura"], status: "live" },
  { id: "whoop", label: "Whoop recovery", example: "Recovery 62% · HRV 41 ms", does: "Today's effort moves with your recovery.", category: "body", tier: "daily", sources: ["whoop"], status: "live" },
  { id: "checkin", label: "Mood check-in", example: "Mood 4 · stress up · slept badly", does: "Kairo sees a hard week while it's still this week.", category: "mind", tier: "daily", sources: ["you"], status: "live" },
  { id: "people", label: "Your days & people", example: "Night shifts · two kids", does: "Advice fits the life you actually have.", category: "context", tier: "daily", sources: ["you"], status: "live" },
  { id: "watch", label: "Apple Watch", example: "Resting HR 58 · 42 active min", does: "Heart and workout data with no manual logging.", category: "body", tier: "daily", sources: ["health"], status: "next" },
  { id: "calendar", label: "Calendar", example: "Packed Thursday · free 7am", does: "The habit lands where your week has room.", category: "context", tier: "daily", sources: ["calendar"], status: "next" },
  { id: "temperature", label: "Skin temperature", example: "+0.4°C above your baseline", does: "A nudge to ease off before you feel run down.", category: "body", tier: "daily", sources: ["oura", "health"], status: "next" },

  // Pattern: only meaningful in aggregate.
  { id: "momentum", label: "Habit momentum", example: "18 of 21 days · miss forgiven", does: "One slip never resets you to zero.", category: "habits", tier: "pattern", sources: ["habits"], status: "live" },
  { id: "strava", label: "Strava", example: "94 workout minutes this week", does: "Logs your habit for you when the run happens.", category: "habits", tier: "pattern", sources: ["strava"], status: "live" },
  { id: "steps", label: "Steps", example: "4,820 today · 6,000 usual", does: "The walk with the dog counts.", category: "habits", tier: "pattern", sources: ["oura", "health"], status: "live" },
  { id: "sleep-rhythm", label: "Sleep rhythm", example: "Bedtime drifts 43 minutes", does: "Regularity, not just hours slept.", category: "habits", tier: "pattern", sources: ["oura", "health"], status: "next" },
  { id: "mindful", label: "Mindful minutes", example: "Last session 6 days ago", does: "Surfaces the reset you've been skipping.", category: "mind", tier: "pattern", sources: ["health"], status: "next" },
  { id: "nutrition", label: "Nutrition", example: "Protein 64 g · 1,842 kcal", does: "Read from the food app you already use.", category: "body", tier: "pattern", sources: ["health"], status: "next" },

  // Ambient: read when it's relevant.
  { id: "community", label: "Your community", example: "This week's room is open", does: "Connects your room to your week.", category: "people", tier: "ambient", sources: ["community"], status: "live" },
  { id: "away", label: "Away mode", example: "Travelling Tue–Thu", does: "Life happens. Your streak waits.", category: "context", tier: "ambient", sources: ["you"], status: "live" },
  { id: "hydration", label: "Water", example: "48 oz logged today", does: "Read from whatever already logs it.", category: "body", tier: "ambient", sources: ["health"], status: "next" },
  { id: "daylight", label: "Time in daylight", example: "22 minutes today", does: "Apple Watch only. A simple anchor for sleep.", category: "context", tier: "ambient", sources: ["health"], status: "next" },
];

const CATEGORY_BY_ID = Object.fromEntries(SIGNAL_CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, SignalCategory>;
const TIER_BY_ID = Object.fromEntries(SIGNAL_TIERS.map((t) => [t.id, t])) as Record<TierId, SignalTier>;
const SOURCE_LABEL = Object.fromEntries(SIGNAL_SOURCES.map((s) => [s.id, s.label])) as Record<SourceId, string>;

export function category(id: CategoryId): SignalCategory {
  return CATEGORY_BY_ID[id];
}

export function categoryColor(id: CategoryId): string {
  return CATEGORY_BY_ID[id].color;
}

export function tier(id: TierId): SignalTier {
  return TIER_BY_ID[id];
}

export function sourceLabel(id: SourceId): string {
  return SOURCE_LABEL[id];
}

export function signalsIn(id: TierId): readonly SignalDef[] {
  return SIGNALS.filter((s) => s.tier === id);
}
