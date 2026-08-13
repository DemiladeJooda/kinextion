"use client";

import { motion } from "framer-motion";
import { NextPageButton } from "@/components/navigation/NextPageButton";

// The animated wordmark, rendered letter-by-letter.
const LETTERS = ["K","I","N","E","X","T","I","O","N"];

// Returns the glow colour for a given letter. The letters themselves are white;
// only their drop-shadow glow shifts across the aurora spectrum — green at the
// start, teal in the middle, violet at the end — interpolated by position.
function letterGlow(index: number, total: number): string {
  const t = index / (total - 1);
  if (t <= 0.5) {
    const s = t / 0.5;
    const r = Math.round(0  + (10  - 0  ) * s);
    const g = Math.round(220 + (186 - 220) * s);
    const b = Math.round(110 + (181 - 110) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) / 0.5;
    const r = Math.round(10  + (180 - 10 ) * s);
    const g = Math.round(186 + (60  - 186) * s);
    const b = Math.round(181 + (255 - 181) * s);
    return `rgb(${r},${g},${b})`;
  }
}

// Landing/home section. Sits on the shared dark SpaceBackground (stars are
// provided globally), and adds a one-time aurora "wave" rising from the bottom
// on entry, plus the glowing KINEXTION wordmark and taglines.
export function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{ minHeight: "calc(100vh - var(--nav-height, 56px))" }}
    >
      {/* ── Aurora wave entrance — green light sweeps up once on mount ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 90% at 50% 110%, rgba(0,196,122,0.55) 0%, rgba(10,186,181,0.25) 35%, transparent 68%)",
            filter: "blur(55px)",
          }}
          animate={{ y: [120, -60, 0], opacity: [0, 0.85, 0.22] }}
          transition={{ duration: 2.1, times: [0, 0.42, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 75% at 65% 105%, rgba(10,186,181,0.45) 0%, rgba(0,196,122,0.15) 40%, transparent 68%)",
            filter: "blur(70px)",
          }}
          animate={{ y: [160, -40, 10], opacity: [0, 0.7, 0.14] }}
          transition={{ duration: 2.1, delay: 0.18, times: [0, 0.42, 1], ease: "easeOut" }}
        />
        <motion.div
          className="absolute top-0 left-0 right-0"
          style={{
            height: "45%",
            background:
              "linear-gradient(180deg, rgba(0,196,122,0.14) 0%, rgba(10,186,181,0.07) 45%, rgba(168,85,247,0.05) 75%, transparent 100%)",
            filter: "blur(30px)",
          }}
          animate={{ opacity: [0, 0.9, 0.38] }}
          transition={{ duration: 1.8, delay: 0.35, times: [0, 0.48, 1], ease: "easeOut" }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">

        {/* Wordmark — white letters, aurora glow spectrum */}
        <div className="flex items-end justify-center mb-6 gap-[1px] sm:gap-0.5">
          {LETTERS.map((char, i) => {
            const glow = letterGlow(i, LETTERS.length);
            return (
              <motion.span
                key={char + i}
                initial={{ opacity: 0, y: 52, scale: 0.78 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay:    0.55 + i * 0.065,
                  duration: 0.55,
                  ease:     [0.22, 1, 0.36, 1],
                }}
                className="relative font-extrabold tracking-tight select-none"
                style={{
                  fontSize:   "clamp(3.5rem, 12vw, 8.5rem)",
                  lineHeight: 1,
                  color:      "#FFFFFF",
                  filter: `drop-shadow(0 0 16px ${glow}88)`,
                }}
              >
                {/* Ambient pulse behind each letter */}
                <motion.span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center font-extrabold"
                  style={{ fontSize: "clamp(3.5rem, 12vw, 8.5rem)", lineHeight: 1, color: "#FFFFFF" }}
                  animate={{
                    filter: [
                      `drop-shadow(0 0 8px ${glow}55)`,
                      `drop-shadow(0 0 26px ${glow}99)`,
                      `drop-shadow(0 0 8px ${glow}55)`,
                    ],
                  }}
                  transition={{
                    duration: 2.8 + i * 0.15,
                    repeat:   Infinity,
                    ease:     "easeInOut",
                    delay:    i * 0.22,
                  }}
                >
                  {char}
                </motion.span>
                {char}
              </motion.span>
            );
          })}
        </div>

        {/* Primary tagline */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.65, ease: "easeOut" }}
          className="text-xl sm:text-2xl font-light tracking-wide"
          style={{ color: "rgba(255,255,255,0.90)" }}
        >
          Your system for becoming.
        </motion.p>

        {/* Supporting line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.65, duration: 0.7 }}
          className="mt-3 text-sm sm:text-base max-w-sm"
          style={{ color: "rgba(255,255,255,0.62)" }}
        >
          The AI-powered health and wellness app designed for your everyday.
        </motion.p>

      </div>

      {/* Bottom nav hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <NextPageButton toTab="problem" label="See what we couldn't ignore" dark />
      </div>
    </section>
  );
}
