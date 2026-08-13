/**
 * The signal taxonomy — one shared vocabulary for everything Kinextion reads.
 *
 * Two independent axes, and keeping them independent is the whole point:
 *
 *   CATEGORY (below) — what *kind* of signal it is. Body, mind, habits, life,
 *   world. Carried by colour everywhere it appears.
 *
 *   TIER (further down) — how much of Kinextion's finite attention that signal
 *   earns: how long it's held, at what resolution, and whether it's loaded into
 *   every reply or fetched only when something asks for it. Carried by
 *   position — closer to the centre means held closer.
 *
 * Both pages read from here, so the Solution page's orbit, the chat sidebar,
 * and the How It Works taxonomy can never drift into three vocabularies.
 */

export const SIGNAL_CATEGORIES = [
  {
    id: "body",
    label: "Body",
    icon: "⚡",
    color: "#00C47A",
    /** One line, used as the ring caption and the sidebar subtitle. */
    blurb: "What your body is doing right now.",
    /** Longer form, used on How It Works. */
    detail:
      "Wearables, sleep, fuel, and the physiological baselines that decide what today can actually hold.",
  },
  {
    id: "mind",
    label: "Mind & Mood",
    icon: "🌊",
    color: "#A855F7",
    blurb: "How you're feeling — and what you're not saying.",
    detail:
      "Mood, behaviour drift, and the long memory of what you've told us. This is where Kairo lives.",
  },
  {
    id: "habits",
    label: "Habits & History",
    icon: "🔄",
    color: "#EC4899",
    blurb: "What you've done before, and what usually happens next.",
    detail:
      "Streaks, training load, and three years of pattern memory — so the system recognises a spiral before you name it.",
  },
  {
    id: "context",
    label: "Life Context",
    icon: "📅",
    color: "#3B82F6",
    blurb: "The week you're actually living in.",
    detail:
      "Calendar, family, travel, and constraints. A plan that ignores your Thursday was never built for your life.",
  },
  {
    id: "world",
    label: "World & Pod",
    icon: "🫂",
    color: "#0ABAB5",
    blurb: "Your environment and the people around you.",
    detail:
      "Air quality, daylight, green space, and your pod. The conditions you move through, and who notices when you go quiet.",
  },
] as const;

export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];
export type CategoryId = SignalCategory["id"];

/**
 * Attention tiers — ordered innermost (most held) → outermost (most disposable).
 *
 * Kinextion does not have unlimited context, unlimited storage, or unlimited
 * inference budget, and pretending otherwise is how systems end up treating a
 * disclosed eating-disorder history with the same weight as yesterday's air
 * quality. So every signal is assigned a tier, and the tier decides three
 * things: how long the raw value survives, what resolution it survives at, and
 * whether it is resident in every single reply or fetched on demand.
 *
 * The rule for placement is deliberately simple — the more a signal would hurt
 * to be forgotten, the closer in it sits.
 */
export const SIGNAL_TIERS = [
  {
    id: "core",
    label: "Core",
    /** Sub-heading on the tier rail. */
    kicker: "Never forgotten",
    /** Orbit radius in px, and the size of the orbs on that ring. */
    radius: 92,
    orbSize: 54,
    /** 0–1. Drives ring brightness, orb glow, and the weight bar. */
    weight: 1,
    retention: "Held permanently · resident in every reply",
    detail:
      "Constraints and identity. An injury, a diagnosis, a cycle phase, three years of your own history — things that change what is safe or true for you. These are loaded before Kinextion says a single word, every time.",
  },
  {
    id: "daily",
    label: "Daily",
    kicker: "Read fresh every morning",
    radius: 150,
    orbSize: 46,
    weight: 0.72,
    retention: "Full resolution for 14 days, then summarised",
    detail:
      "The state of today. Last night's sleep, this morning's HRV, what your Thursday actually looks like. Kept at full fidelity while it can still change a decision, then compressed into a trend line rather than kept forever.",
  },
  {
    id: "pattern",
    label: "Pattern",
    kicker: "Kept as shape, not as points",
    radius: 210,
    orbSize: 38,
    weight: 0.46,
    retention: "Rolling trends · raw points age out at 90 days",
    detail:
      "Signals that only mean something in aggregate. One 4,800-step day says nothing; a fortnight of them says a lot. Kinextion stores the slope and drops the individual readings — cheaper to hold, and closer to what actually matters.",
  },
  {
    id: "ambient",
    label: "Ambient",
    kicker: "Fetched, used, released",
    radius: 268,
    orbSize: 32,
    weight: 0.24,
    retention: "Read on demand · nothing stored",
    detail:
      "Conditions rather than history. Today's air quality, the daylight, which city you're in. Cheap to look up the moment it's relevant, and pointless to keep — so it is never written down at all.",
  },
] as const;

export type SignalTier = (typeof SIGNAL_TIERS)[number];
export type TierId = SignalTier["id"];

const TIER_BY_ID = Object.fromEntries(
  SIGNAL_TIERS.map((t) => [t.id, t])
) as Record<TierId, SignalTier>;

export function tier(id: TierId): SignalTier {
  return TIER_BY_ID[id];
}

const BY_ID = Object.fromEntries(
  SIGNAL_CATEGORIES.map((c) => [c.id, c])
) as Record<CategoryId, SignalCategory>;

export function category(id: CategoryId): SignalCategory {
  return BY_ID[id];
}

/** Convenience for styling — avoids `category(id).color` noise at call sites. */
export function categoryColor(id: CategoryId): string {
  return BY_ID[id].color;
}
