"use client";

import { motion } from "motion/react";
import { Play } from "lucide-react";
import { Band } from "@/components/motion/primitives";

// ─── Core values ─────────────────────────────────────────────────────────────
const coreValues = [
  {
    n: "01", label: "Progress over perfection", color: "#00C47A",
    body: "We celebrate the 1% improvement. We track the streak that almost broke but didn't. The system never shames a slip — it absorbs it, learns from it, and adapts. The only way out is through.",
  },
  {
    n: "02", label: "Compounding consistency", color: "#0ABAB5",
    body: "The product is the accumulation of small, daily actions. One session doesn't change you. Three hundred sessions change who you are. We build for the long arc — not the impressive start.",
  },
  {
    n: "03", label: "Context is everything", color: "#3B82F6",
    body: "Generic advice is noise. A recommendation only means something when it fits the reality of someone's actual day — their calendar, their sleep, their pressure, their history. We build for that specificity.",
  },
  {
    n: "04", label: "Radical personalization", color: "#A855F7",
    body: "No two users should feel like they're using the same app. The system learns, adapts, and evolves with the individual. One-size-fits-all wellness is why wellness fails.",
  },
  {
    n: "05", label: "Accountability with grace", color: "#F59E0B",
    body: "Hold people to their commitments — but with empathy. Life happens. A missed day is data, not a verdict. The system bends without breaking. You are not your worst week.",
  },
  {
    n: "06", label: "Wholeness over fragmentation", color: "#34D399",
    body: "A workout plan that ignores sleep. A meditation app that ignores nutrition. A journal that ignores your heart rate. The human body doesn't fragment — neither should the system built for it.",
  },
  {
    n: "07", label: "Human dignity in AI", color: "#EC4899",
    body: "Althea and Kairo are trusted companions, not surveillance tools. Every data point exists to serve you — not to judge you. Guidance without judgment. Intelligence without arrogance.",
  },
];

export function StorySection() {
  return (
    <section className="relative pt-16 sm:pt-20">
      <div className="section-container relative z-10">

        {/* ── Title block — white heading on dark backdrop ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="section-label" style={{ color: "#A855F7" }}>Our Story</p>
          {/* Dark-theme heading: #FFFFFF instead of the original near-black #0F172A */}
          <h2
            className="font-semibold mb-4 text-balance"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#FFFFFF" }}
          >
            From our journey to yours.
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.50)" }}>
            We got tired of starting over — and refused to accept that consistency had to be this fragile.
          </p>
        </motion.div>

        {/* The founders' video. A labelled placeholder until it's filmed. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="max-w-5xl mx-auto mb-24 sm:mb-32"
        >
          <div
            className="relative aspect-video rounded-[2rem] overflow-hidden flex flex-col items-center justify-center text-center px-6"
            style={{
              background: "radial-gradient(ellipse 70% 80% at 50% 45%, rgba(168,85,247,0.22) 0%, rgba(10,186,181,0.1) 45%, rgba(255,255,255,0.03) 75%)",
              border: "1px dashed rgba(255,255,255,0.22)",
            }}
          >
            <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <Play size={26} color="#FFFFFF" fill="#FFFFFF" className="ml-1" />
            </span>
            <p className="mt-5 font-semibold text-white" style={{ fontSize: "clamp(1.2rem, 2.6vw, 1.9rem)", letterSpacing: "-0.02em" }}>
              A message from the founders
            </p>
            <p className="mt-1 text-sm text-white/55">Placeholder. The video goes here once it&apos;s filmed.</p>
          </div>
        </motion.div>
      </div>

      {/* ── Core Values ── */}
      <Band tone="dusk">
        <div className="section-container pt-24 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14"
          >
            <p className="section-label mb-3" style={{ color: "#A855F7" }}>Our Principles</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h3
                className="font-semibold text-balance"
                style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)", color: "#FFFFFF" }}
              >
                Seven things we will{" "}
                <span style={{ color: "rgba(255,255,255,0.28)" }}>never compromise on.</span>
              </h3>
              <p className="text-sm shrink-0" style={{ color: "rgba(255,255,255,0.32)" }}>
                The foundation of every decision we make.
              </p>
            </div>
          </motion.div>

          <div className="space-y-0">
            {coreValues.map((v, i) => (
              <motion.div
                key={v.n}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                whileHover={{ x: 4 }}
                className="flex gap-6 py-7 transition-all duration-300 cursor-default"
                style={{ borderBottom: i < coreValues.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div className="w-12 shrink-0 pt-1">
                  <span className="font-extrabold text-lg leading-none" style={{ color: "rgba(255,255,255,0.14)", fontVariantNumeric: "tabular-nums" }}>
                    {v.n}
                  </span>
                </div>
                <div className="w-0.5 shrink-0 rounded-full" style={{ background: `${v.color}55`, minHeight: 20 }} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold mb-2" style={{ fontSize: "clamp(1rem, 2vw, 1.15rem)", color: v.color }}>
                    {v.label}
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.58)" }}>
                    {v.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Band>
    </section>
  );
}
