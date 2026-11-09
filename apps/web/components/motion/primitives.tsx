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
}: {
  /** Track height in viewport heights. */
  readonly length?: number;
  readonly children: (progress: MotionValue<number>) => ReactNode;
  readonly className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className="relative" style={{ height: `${length * 100}vh` }}>
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
}: {
  readonly label?: string;
  readonly color?: string;
  readonly title: string;
  readonly muted?: string;
  readonly center?: boolean;
}) {
  return (
    <Reveal className={center ? "text-center" : undefined}>
      {label ? (
        <p className="section-label" style={{ color, WebkitTextFillColor: color }}>
          {label}
        </p>
      ) : null}
      <h2
        className="font-semibold text-balance"
        style={{ fontSize: "clamp(2.2rem, 5.2vw, 4.2rem)", color: "#FFFFFF" }}
      >
        {title}
        {muted ? (
          <>
            {" "}
            <span style={{ color: "rgba(255,255,255,0.38)" }}>{muted}</span>
          </>
        ) : null}
      </h2>
    </Reveal>
  );
}
