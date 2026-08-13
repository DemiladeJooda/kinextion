/**
 * Kinextion mobile design system.
 *
 * The app shares the website's Aurora Borealis palette but is tuned for a
 * hand-held, low-light, one-thumb context: deeper backgrounds, larger touch
 * targets, and a tighter type scale. Every screen pulls from here — no ad-hoc
 * hex values in components, so a palette change is a one-file change.
 */

import { GUIDES } from "@kinextion/ai-core";

// ─── Colour ───────────────────────────────────────────────────────────────────
export const color = {
  /** App background — near-black with a blue cast, easy on the eyes at night. */
  bg: "#070B14",
  /** Raised surface: cards, sheets, the tab bar. */
  surface: "#0E1524",
  surfaceAlt: "#141C2E",
  /** Hairline borders. Deliberately low contrast; elevation carries hierarchy. */
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",

  text: "#F5F8FC",
  textMuted: "#94A3B8",
  textFaint: "#5A6B85",

  // Aurora accents, shared with the web app.
  green: GUIDES.altheo.color, // #00C47A — Althea, physical, progress
  teal: "#0ABAB5", //              community, pods
  purple: GUIDES.kairo.color, // #A855F7 — Kairo, emotional
  blue: "#3B82F6", //              life context, focus
  amber: "#F59E0B", //             habits, energy
  pink: "#EC4899", //              patterns, memory
  red: "#EF4444", //               warnings, high load

  /** Overlay scrim for modals and camera UI. */
  scrim: "rgba(4,7,13,0.82)",
} as const;

/** The four wellness dimensions, matched to the website's signal categories. */
export const categoryColor = {
  physical: color.green,
  mental: color.blue,
  emotional: color.purple,
  spiritual: color.teal,
} as const;

export type Category = keyof typeof categoryColor;

// ─── Spacing ──────────────────────────────────────────────────────────────────
/** 4pt grid. Use these instead of raw numbers so rhythm stays consistent. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// ─── Type scale ───────────────────────────────────────────────────────────────
/**
 * Deliberately few sizes. Mobile copy should be scannable, not dense — the
 * website carries the detail, the app carries the moment.
 */
export const type = {
  display: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8, lineHeight: 40 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, lineHeight: 32 },
  heading: { fontSize: 19, fontWeight: "700", letterSpacing: -0.2, lineHeight: 25 },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  small: { fontSize: 13, fontWeight: "400", lineHeight: 19 },
  /** Section eyebrows: uppercase, tracked out. */
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, lineHeight: 15 },
  mono: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
} as const;

// ─── Elevation ────────────────────────────────────────────────────────────────
/** iOS shadow + Android elevation in one object. */
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lifted: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
} as const;

/** Coloured glow, for accent surfaces that should feel lit from within. */
export function glow(hex: string, opacity = 0.35) {
  return {
    shadowColor: hex,
    shadowOpacity: opacity,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };
}

/** Translucent tint of an accent colour, for card fills and chips. */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// ─── Motion ───────────────────────────────────────────────────────────────────
export const motion = {
  /** Standard ease for entrances — slight overshoot reads as alive. */
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 120, mass: 1 },
  fast: 180,
  normal: 280,
  slow: 460,
} as const;
