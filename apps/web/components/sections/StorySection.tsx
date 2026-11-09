"use client";

import { motion } from "motion/react";
import { ScrollWords } from "@/components/motion/primitives";

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
    <section className="tab-section">
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

        {/* One line to sit with, until the founders' video exists to go here. */}
        <div className="max-w-4xl mx-auto mb-28">
          <ScrollWords
            text="People know what to do. Staying with it is the hard part. So we built the thing we kept wishing existed."
            className="font-semibold text-white"
            style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.12, letterSpacing: "-0.03em" }}
          />
        </div>

        {/* ── Core Values ── */}
        <div className="border-t pt-16 mb-16" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
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

      </div>
    </section>
  );
}
