"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

// Deterministic pseudo-random generator. The same input `n` always returns the
// same value in [0,1), so the star layout is identical on the server and the
// client — this prevents React hydration mismatches for the randomized field.
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 9.1) * 43758.5453;
  return x - Math.floor(x);
}

// Picks a star tint: mostly white, with occasional aurora accents
// (green / violet / teal) sprinkled deterministically by index.
function starColor(i: number): string {
  if (i % 6 === 0) return "rgba(0,255,140,0.95)"; // green accent
  if (i % 7 === 0) return "rgba(168,85,247,0.95)"; // violet accent
  if (i % 11 === 0) return "rgba(10,186,181,0.95)"; // teal accent
  return "rgba(255,255,255,0.95)"; // default white
}

// Reusable twinkling star layer for the dark "space" pages. Renders `count`
// softly pulsing dots at deterministic positions. It is purely decorative and
// disables pointer events so it never intercepts clicks on the content above.
export function StarField({ count = 80 }: { readonly count?: number }) {
  // Build the star list once per `count`. Each field (position, size, twinkle
  // timing) is derived from `seeded()` with a distinct offset so values differ.
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: seeded(i * 7 + 1) * 100, // horizontal position (% of viewport)
        y: seeded(i * 7 + 2) * 100, // vertical position (% of viewport)
        size: 0.8 + seeded(i * 7 + 3) * 2.4, // dot diameter in px
        opacity: 0.2 + seeded(i * 7 + 4) * 0.72, // peak brightness
        duration: 2.2 + seeded(i * 7 + 5) * 4.5, // twinkle cycle length (s)
        delay: seeded(i * 7 + 6) * 4, // staggered start so they don't pulse in sync
        color: starColor(i),
      })),
    [count]
  );

  return (
    // Full-bleed, non-interactive overlay that clips any stars near the edges.
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: star.color,
            filter: "blur(0.3px)", // soft edge so dots read as distant light, not hard circles
          }}
          // Twinkle: fade between a dim and bright state forever.
          animate={{ opacity: [star.opacity * 0.25, star.opacity, star.opacity * 0.25] }}
          transition={{ duration: star.duration, repeat: Infinity, ease: "easeInOut", delay: star.delay }}
        />
      ))}
    </div>
  );
}
