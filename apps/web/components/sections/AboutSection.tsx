"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/components/navigation/navigation-context";

const convictionStats = [
  { value: "80%",  label: "quit within 90 days",      color: "#EF4444" },
  { value: "5+",   label: "apps needed to feel whole", color: "#F59E0B" },
  { value: "4×",   label: "the average restart",       color: "#A855F7" },
  { value: "847",  label: "already building with us",  color: "#00C47A" },
];

const coreValues = [
  {
    n: "01", label: "Progress over perfection",
    color: "#00C47A",
    body: "We celebrate the 1% improvement. We track the streak that almost broke but didn't. The system never shames a slip — it absorbs it, learns from it, and adapts. The only way out is through.",
  },
  {
    n: "02", label: "Compounding consistency",
    color: "#0ABAB5",
    body: "The product is the accumulation of small, daily actions. One session doesn't change you. Three hundred sessions change who you are. We build for the long arc — not the impressive start.",
  },
  {
    n: "03", label: "Context is everything",
    color: "#3B82F6",
    body: "Generic advice is noise. A recommendation only means something when it fits the reality of someone's actual day — their calendar, their sleep, their pressure, their history. We build for that specificity.",
  },
  {
    n: "04", label: "Radical personalization",
    color: "#A855F7",
    body: "No two users should feel like they're using the same app. The system learns, adapts, and evolves with the individual. One-size-fits-all wellness is why wellness fails.",
  },
  {
    n: "05", label: "Accountability with grace",
    color: "#F59E0B",
    body: "Hold people to their commitments — but with empathy. Life happens. A missed day is data, not a verdict. The system bends without breaking. You are not your worst week.",
  },
  {
    n: "06", label: "Wholeness over fragmentation",
    color: "#34D399",
    body: "A workout plan that ignores sleep. A meditation app that ignores nutrition. A journal that ignores your heart rate. The human body doesn't fragment — neither should the system built for it.",
  },
  {
    n: "07", label: "Human dignity in AI",
    color: "#EC4899",
    body: "Althea and Kairo are trusted companions, not surveillance tools. Every data point exists to serve you — not to judge you. Guidance without judgment. Intelligence without arrogance.",
  },
];

export function AboutSection() {
  const navigate = useNavigate();
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  return (
    <section className="tab-section">
      <div className="section-container relative z-10">

        {/* ── Opening Manifesto ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="section-label" style={{ color: "#00C47A" }}>About Us</p>
          <h2
            className="font-bold mb-6 text-balance"
            style={{ fontSize: "clamp(2.2rem, 5.5vw, 4rem)", color: "#0F172A", lineHeight: 1.15 }}
          >
            We grew tired of{" "}
            <span style={{ color: "#64748B" }}>starting over.</span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto text-balance mb-4"
            style={{ color: "#475569" }}
          >
            Not from lack of motivation. Not from lack of trying. From the absence of a
            system that could handle the full, complicated, beautiful chaos of being human.
          </p>
          <p className="text-base max-w-xl mx-auto text-balance" style={{ color: "#64748B" }}>
            Kinextion exists because we lived the problem — and refused to accept that
            consistency had to feel this fragile.
          </p>
        </motion.div>

        {/* ── Conviction stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16"
        >
          {convictionStats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07 }}
              className="glass-card p-5 text-center"
              style={{ border: `1px solid ${s.color}18` }}
            >
              <div
                className="font-extrabold mb-1 leading-none"
                style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", color: s.color }}
              >
                {s.value}
              </div>
              <p className="text-[11px] leading-snug" style={{ color: "#64748B" }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Mission Manifesto Block ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative overflow-hidden mb-16 max-w-3xl mx-auto"
          style={{
            background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 50%, #A855F7 100%)",
            padding: "1.5px",
            borderRadius: 20,
          }}
        >
          <div
            className="rounded-[18px] px-10 sm:px-14 py-12 text-center relative"
            style={{ background: "#FFFFFF" }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-[18px]"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,196,122,0.04) 0%, transparent 70%)" }}
            />
            <p
              className="text-[10px] uppercase tracking-widest mb-5 relative z-10"
              style={{ color: "#94A3B8" }}
            >
              What we believe
            </p>
            <p
              className="font-bold leading-[1.25] text-balance relative z-10"
              style={{ fontSize: "clamp(1.3rem, 3vw, 2rem)", color: "#0F172A" }}
            >
              Consistency is not{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                a character trait.
              </span>
            </p>
            <p
              className="font-bold leading-[1.25] text-balance relative z-10 mt-1"
              style={{ fontSize: "clamp(1.3rem, 3vw, 2rem)", color: "#0F172A" }}
            >
              It&apos;s{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #A855F7 0%, #0ABAB5 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                a systematic problem.
              </span>
            </p>
            <div
              className="w-12 h-0.5 mx-auto mt-6 mb-6 relative z-10"
              style={{ background: "linear-gradient(90deg, #00C47A, #A855F7)" }}
            />
            <p className="text-base text-balance relative z-10 font-medium" style={{ color: "#475569" }}>
              To embed actionable, sustainable habits through personalized AI guidance,
              adaptive wellness systems, and shared community experiences — across physical,
              mental, emotional, and spiritual self-improvement.
            </p>
          </div>
        </motion.div>

        {/* ── Core Values ── */}
        <div className="border-t pt-16 mb-20" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
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
                style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)", color: "#0F172A" }}
              >
                Seven things we will{" "}
                <span style={{ color: "#64748B" }}>never compromise on.</span>
              </h3>
              <p className="text-sm shrink-0" style={{ color: "#94A3B8" }}>The foundation of every decision we make.</p>
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
                className="flex gap-6 py-7 transition-all duration-300 cursor-default group"
                style={{
                  borderBottom: i < coreValues.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                }}
              >
                {/* Number */}
                <div className="w-12 shrink-0 pt-1">
                  <span
                    className="font-extrabold text-lg leading-none transition-all duration-300"
                    style={{ color: "rgba(0,0,0,0.12)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {v.n}
                  </span>
                </div>

                {/* Color accent line */}
                <div
                  className="w-0.5 shrink-0 rounded-full transition-all duration-300"
                  style={{ background: `${v.color}30`, minHeight: 20 }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4
                    className="font-bold mb-2 transition-all duration-300"
                    style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", color: v.color }}
                  >
                    {v.label}
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
                    {v.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── "The Engineers" mini-band ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="glass-card p-8 mb-20 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
          style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        >
          <div className="flex gap-3 shrink-0">
            {[{ initial: "D", color: "#00C47A" }, { initial: "C", color: "#A855F7" }].map(m => (
              <div
                key={m.initial}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold"
                style={{ background: `${m.color}10`, border: `2px solid ${m.color}30`, color: m.color }}
              >
                {m.initial}
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="font-bold text-base mb-1" style={{ color: "#0F172A" }}>
              Built by two people who lived the problem.
            </p>
            <p className="text-sm" style={{ color: "#64748B" }}>
              Demi & Cecil — founders, obsessives, and the two people who refused to accept
              another restart. Their full story is one tab over.
            </p>
          </div>
          <button
            onClick={() => navigate("story")}
            className="shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1.5px solid rgba(0,0,0,0.10)",
              color: "#475569",
            }}
          >
            Our Story →
          </button>
        </motion.div>

        {/* ── "Your future self is calling" Waitlist CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 45%, #A855F7 100%)",
            padding: "3px",
          }}
        >
          <div
            className="rounded-3xl p-12 sm:p-16 text-center relative overflow-hidden"
            style={{ background: "#FFFFFF" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,196,122,0.05) 0%, transparent 70%)" }}
            />

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-xs uppercase tracking-widest mb-4 relative z-10"
              style={{ color: "#94A3B8" }}
            >
              Early Access · Free to join
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="font-semibold mb-4 text-balance relative z-10"
              style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", color: "#0F172A" }}
            >
              Your future self{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 50%, #A855F7 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                is calling.
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="text-base max-w-xl mx-auto mb-10 relative z-10"
              style={{ color: "#475569" }}
            >
              The version of you that moves every day, sleeps well, and never starts over
              again — it&apos;s not a fantasy. It&apos;s an engineering problem we&apos;ve
              already solved. Get in early.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="relative z-10 max-w-md mx-auto"
            >
              <AnimatePresence>
                {waitlistDone ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl py-5 px-6 text-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,196,122,0.08) 0%, rgba(168,85,247,0.06) 100%)",
                      border: "1.5px solid rgba(0,196,122,0.20)",
                    }}
                  >
                    <p className="text-2xl mb-2">✓</p>
                    <p className="font-bold text-base mb-1" style={{ color: "#0F172A" }}>You&apos;re in.</p>
                    <p className="text-sm" style={{ color: "#64748B" }}>
                      We&apos;ll reach out before we launch. Welcome to the movement.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={(e) => { e.preventDefault(); if (waitlistEmail.trim()) setWaitlistDone(true); }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <input
                      type="email"
                      required
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-5 py-3.5 rounded-full text-sm outline-none transition-all duration-200"
                      style={{
                        background: "rgba(0,0,0,0.04)",
                        border: "1.5px solid rgba(0,0,0,0.10)",
                        color: "#0F172A",
                      }}
                    />
                    <button
                      type="submit"
                      className="px-7 py-3.5 rounded-full font-bold text-sm text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] whitespace-nowrap"
                      style={{
                        background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                        boxShadow: "0 6px 24px rgba(0,196,122,0.30)",
                      }}
                    >
                      Join Early Access
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Social proof avatars */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.75 }}
              className="mt-8 flex items-center justify-center gap-3 relative z-10"
            >
              <div className="flex -space-x-2">
                {["#00C47A", "#0ABAB5", "#A855F7", "#3B82F6", "#F59E0B"].map((c, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold"
                    style={{ background: `${c}18`, color: c, borderColor: "#FFFFFF", zIndex: 5 - i }}
                  >
                    {["T", "A", "M", "J", "C"][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                <span style={{ color: "#0F172A", fontWeight: 600 }}>847 people</span> already building with us
              </p>
            </motion.div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
