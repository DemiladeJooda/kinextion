"use client";

/**
 * The site's motion vocabulary.
 *
 * Two kinds of movement, used for different jobs:
 *   Scroll-linked (useScroll): the reader drives it, for telling a story.
 *   Scroll-triggered (whileInView): plays once on arrival, for small reveals.
 *
 * Everything animates transform and opacity so it stays on the compositor.
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const AURORA = "linear-gradient(120deg, #00C47A 0%, #0ABAB5 50%, #A855F7 100%)";

/**
 * The page's backgrounds. One theme, several rooms: a page moves between them
 * as it scrolls rather than sitting on one night sky from top to bottom.
 *
 *   night   the star field behind everything (transparent band)
 *   ink     flat near-black, for things that should glow
 *   dusk    deep violet, Kairo's room
 *   forest  deep green-teal, Althea's room
 *   dawn    cool pale mint, daylight
 *   sand    warm paper, for people and photographs
 */
export const TONES = {
  night: { background: "transparent", light: false },
  ink: { background: "#04050B", light: false },
  dusk: { background: "linear-gradient(168deg, #1B0F3D 0%, #100B2C 48%, #070818 100%)", light: false },
  forest: { background: "linear-gradient(168deg, #05291F 0%, #062629 50%, #06111C 100%)", light: false },
  dawn: { background: "linear-gradient(175deg, #F5F8F4 0%, #E6F2EC 100%)", light: true },
  sand: { background: "linear-gradient(175deg, #F8F3EA 0%, #F1E9DB 100%)", light: true },
} as const;

export type Tone = keyof typeof TONES;

/** Text colours for a tone, so sections don't hand-pick greys. */
export function inkFor(tone: Tone) {
  return TONES[tone].light
    ? { strong: "#0C1512", body: "rgba(12,21,18,0.72)", muted: "rgba(12,21,18,0.52)", faint: "rgba(12,21,18,0.4)", line: "rgba(12,21,18,0.12)" }
    : { strong: "#FFFFFF", body: "rgba(255,255,255,0.75)", muted: "rgba(255,255,255,0.55)", faint: "rgba(255,255,255,0.4)", line: "rgba(255,255,255,0.1)" };
}

/** Aurora accents darkened enough to read as text on the light tones. */
export const ON_LIGHT: Record<string, string> = {
  "#00C47A": "#00875A",
  "#0ABAB5": "#087F7B",
  "#A855F7": "#7B2FBE",
  "#3B82F6": "#2563EB",
  "#F59E0B": "#B45309",
  "#EC4899": "#BE185D",
};

export function accentFor(tone: Tone, color: string): string {
  return TONES[tone].light ? (ON_LIGHT[color] ?? color) : color;
}

/**
 * A full-width room. Rooms meet at a clean edge. `lift` rounds the top so the
 * room slides over the one before it.
 */
export function Band({
  tone,
  lift = false,
  className,
  children,
  id,
}: {
  readonly tone: Tone;
  readonly lift?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
  readonly id?: string;
}) {
  return (
    <div
      id={id}
      className={`relative ${lift ? "rounded-t-[2rem] sm:rounded-t-[3rem] -mt-8 sm:-mt-12 z-[1]" : ""} ${className ?? ""}`}
      style={{ background: TONES[tone].background, color: inkFor(tone).strong }}
    >
      {children}
    </div>
  );
}

/** Fades and rises once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly y?: number;
  readonly className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** A display heading whose words light up as the reader scrolls past. */
export function ScrollWords({
  text,
  className,
  style,
}: {
  readonly text: string;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "start 35%"] });
  const words = text.split(" ");

  return (
    <p ref={ref} className={className} style={style}>
      {words.map((word, i) => (
        <ScrollWord key={`${word}-${i}`} progress={scrollYProgress} index={i} total={words.length}>
          {word}
        </ScrollWord>
      ))}
    </p>
  );
}

function ScrollWord({
  progress,
  index,
  total,
  children,
}: {
  readonly progress: MotionValue<number>;
  readonly index: number;
  readonly total: number;
  readonly children: string;
}) {
  const start = index / total;
  const opacity = useTransform(progress, [start, Math.min(1, start + 2 / total)], [0.14, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.26em]">
      {children}
    </motion.span>
  );
}

/** Counts up to a number when it enters the viewport. */
export function CountUp({
  to,
  suffix = "",
  duration = 1.6,
  className,
  style,
}: {
  readonly to: number;
  readonly suffix?: string;
  readonly duration?: number;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration, ease: EASE });
    return () => controls.stop();
  }, [inView, reduced, to, duration, value]);

  return (
    <motion.span ref={ref} className={className} style={style}>
      {text}
    </motion.span>
  );
}

/**
 * A tall scroll track with a pinned stage.
 * The stage receives 0–1 progress through the track.
 */
export function ScrollStage({
  length = 3,
  children,
  className,
  tone = "night",
}: {
  /** Track height in viewport heights. */
  readonly length?: number;
  readonly children: (progress: MotionValue<number>) => ReactNode;
  readonly className?: string;
  readonly tone?: Tone;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className="relative" style={{ height: `${length * 100}vh`, background: TONES[tone].background }}>
      <div
        className={`sticky overflow-hidden ${className ?? ""}`}
        style={{ top: "var(--nav-height, 56px)", height: "calc(100vh - var(--nav-height, 56px))" }}
      >
        {children(scrollYProgress)}
      </div>
    </div>
  );
}

/** Eyebrow plus large heading; the only section header on the site. */
export function Heading({
  label,
  color = "#0ABAB5",
  title,
  muted,
  center = true,
  tone = "night",
}: {
  readonly label?: string;
  readonly color?: string;
  readonly title: string;
  readonly muted?: string;
  readonly center?: boolean;
  readonly tone?: Tone;
}) {
  const ink = inkFor(tone);
  const accent = accentFor(tone, color);
  return (
    <Reveal className={center ? "text-center" : undefined}>
      {label ? (
        <p className="section-label" style={{ color: accent, WebkitTextFillColor: accent }}>
          {label}
        </p>
      ) : null}
      <h2 className="font-semibold text-balance" style={{ fontSize: "clamp(2.2rem, 5.2vw, 4.2rem)", color: ink.strong }}>
        {title}
        {muted ? (
          <>
            {" "}
            <span style={{ color: ink.faint }}>{muted}</span>
          </>
        ) : null}
      </h2>
    </Reveal>
  );
}
