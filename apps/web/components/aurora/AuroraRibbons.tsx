"use client";

import { motion, useReducedMotion } from "motion/react";

const RIBBONS = [
  { color: "#00C47A", d: "M-100 620 C 220 380, 420 700, 720 470 S 1160 300, 1560 520", duration: 15, width: 90, delay: 0 },
  { color: "#0ABAB5", d: "M-100 500 C 240 680, 520 320, 800 520 S 1220 640, 1560 380", duration: 19, width: 70, delay: 1.5 },
  { color: "#A855F7", d: "M-100 720 C 300 560, 480 820, 860 610 S 1280 430, 1560 650", duration: 23, width: 110, delay: 3 },
];

/** Slow-moving northern lights behind the opening. */
export function AuroraRibbons() {
  const reduced = useReducedMotion();

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 w-full h-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      style={{ filter: "blur(46px)", opacity: 0.75 }}
    >
      {RIBBONS.map((r) => (
        <motion.path
          key={r.color}
          d={r.d}
          fill="none"
          stroke={r.color}
          strokeWidth={r.width}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={
            reduced
              ? { pathLength: 1, opacity: 0.45 }
              : { pathLength: 1, opacity: [0.3, 0.7, 0.3], y: [0, -50, 0], x: [0, 40, 0] }
          }
          transition={{
            pathLength: { duration: 2.4, delay: r.delay * 0.15, ease: "easeOut" },
            opacity: { duration: r.duration, repeat: Infinity, ease: "easeInOut" },
            y: { duration: r.duration, repeat: Infinity, ease: "easeInOut" },
            x: { duration: r.duration * 1.3, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      ))}
    </svg>
  );
}
