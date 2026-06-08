"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NextPageButton } from "@/components/navigation/NextPageButton";
import { GuideChatDemo, guideConfig, type Guide } from "@/components/sections/GuideChatDemo";

// ─── Guide personality data ───────────────────────────────────────────────────
const altheaTraits = [
  { label: "Direct",     desc: "No fluff. Tells you what you need to hear." },
  { label: "Data-first", desc: "Every recommendation comes from your real numbers." },
  { label: "Adaptive",   desc: "Changes your plan when life changes." },
  { label: "Relentless", desc: "Finds a way to keep you moving, even on bad days." },
];

const kairoTraits = [
  { label: "Patient",    desc: "Never rushes you. Meets you where you are." },
  { label: "Perceptive", desc: "Notices what you didn't say, not just what you did." },
  { label: "Grounded",   desc: "Practical techniques, not empty affirmations." },
  { label: "Present",    desc: "Shows up consistently, especially when things are hard." },
];

// ─── Althea live metrics ──────────────────────────────────────────────────────
const metrics = [
  { label: "HRV",    value: "68",  unit: "ms",   trend: "+4",  color: "#00C47A" },
  { label: "Streak", value: "12",  unit: "days", trend: "↑",   color: "#0ABAB5" },
  { label: "Steps",  value: "7.4", unit: "k",    trend: "+8%", color: "#3B82F6" },
];

// ─── System pillars ───────────────────────────────────────────────────────────
const pillars = [
  { label: "Body",    emoji: "⚡", color: "#00C47A", description: "Adaptive workouts, form, nutrition, recovery",       score: 82, trend: "+4 this week" },
  { label: "Mind",    emoji: "🧠", color: "#3B82F6", description: "Focus, clarity, habit formation, cognitive health",    score: 74, trend: "+2 this week" },
  { label: "Emotion", emoji: "🌊", color: "#A855F7", description: "Mood tracking, journaling, stress relief, CBT tools",  score: 68, trend: "Stable"       },
  { label: "Spirit",  emoji: "✨", color: "#0ABAB5", description: "Reflection, gratitude, purpose, presence, stillness", score: 71, trend: "+6 this week" },
];
const COMPOSITE_SCORE = 74;

// ─── Features: 3 abstract (auto-animate) + 3 hover ───────────────────────────
const abstractFeatures = [
  {
    title:       "Conversational Onboarding",
    tag:         "Onboarding",
    color:       "#00C47A",
    description: "No forms. No quizzes. A natural conversation that builds your profile — and your first personalized plan — from day one.",
    visual:      "chat",
  },
  {
    title:       "Daily Growth Review",
    tag:         "Reflection",
    color:       "#A855F7",
    description: "End each day with a quick check-in: what you did, how you felt, and one thing to do tomorrow. Not analytics — a real conversation.",
    visual:      "review",
  },
  {
    title:       "Micro-Recommendations",
    tag:         "AI Engine",
    color:       "#0ABAB5",
    description: "Context-aware nudges that fit your actual day. '3-min breath reset before your 2pm call.' Your day, not a template.",
    visual:      "nudge",
  },
];

const hoverFeatures = [
  {
    title:       "Habit Tracking",
    tag:         "Habits",
    color:       "#3B82F6",
    description: "Start with 2 minutes. Stack on existing routines. Build identity, not willpower.",
    hoverReveal: "See the habit chain grow",
    emoji:       "🔁",
  },
  {
    title:       "Community Pods",
    tag:         "Community",
    color:       "#7B2FBE",
    description: "AI-matched groups of 3–5 people with similar goals. Real accountability, no awkward gym-partner energy.",
    hoverReveal: "See your pod",
    emoji:       "🫂",
  },
  {
    title:       "Smart Referee",
    tag:         "Coming Soon",
    color:       "#94A3B8",
    description: "Place your phone courtside. AI tracks your reps, scores your game, and builds sport-specific performance data.",
    hoverReveal: "Coming soon",
    emoji:       "🏀",
    comingSoon:  true,
  },
];

type SubTab = "guides" | "system" | "features";

// ─── Chat bubble animation ────────────────────────────────────────────────────
function ChatVisual({ color }: { color: string }) {
  const [step, setStep] = useState(0);
  const bubbles = [
    { text: "Tell me about your goals…",  from: "ai"   },
    { text: "I want to get consistent",   from: "user" },
    { text: "Got it. Let's build that.", from: "ai"   },
  ];
  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % (bubbles.length + 1)), 1400);
    return () => clearInterval(interval);
  }, [bubbles.length]);
  return (
    <div className="space-y-2 py-1">
      {bubbles.slice(0, step === bubbles.length ? bubbles.length : step + 1).map((b, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`flex ${b.from === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className="px-3 py-1.5 rounded-xl text-xs max-w-[85%]"
            style={
              b.from === "ai"
                ? { background: `${color}10`, border: `1px solid ${color}22`, color: "#374151" }
                : { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", color: "#0F172A" }
            }
          >
            {b.text}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ReviewVisual({ color }: { color: string }) {
  const [active, setActive] = useState(0);
  const items = ["Trained upper body ✓", "Energy: 7/10", "Slept 7.2 hours"];
  useEffect(() => {
    const interval = setInterval(() => setActive((a) => (a + 1) % (items.length + 2)), 900);
    return () => clearInterval(interval);
  }, [items.length]);
  return (
    <div className="space-y-1.5 py-1">
      {items.map((item, i) => (
        <motion.div key={i} className="flex items-center gap-2 text-xs"
          animate={{ opacity: active > i ? 1 : 0.25 }} transition={{ duration: 0.4 }}>
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: active > i ? `${color}18` : "rgba(0,0,0,0.05)" }}
          >
            {active > i && <span style={{ color, fontSize: 8 }}>✓</span>}
          </div>
          <span style={{ color: active > i ? "#0F172A" : "#94A3B8" }}>{item}</span>
        </motion.div>
      ))}
    </div>
  );
}

function NudgeVisual({ color }: { color: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setVisible((v) => !v), 2200);
    return () => clearInterval(interval);
  }, []);
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="nudge"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl px-4 py-3"
          style={{ background: `${color}08`, border: `1px solid ${color}22` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color }}> Althea · Now</p>
          <p className="text-xs" style={{ color: "#0F172A" }}>
            3-min breath reset before your 2pm. You&apos;ve got a packed afternoon.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HabitHoverCard({ color, isHovered }: { color: string; isHovered: boolean }) {
  const habits = ["Morning water", "5-min stretch", "Evening walk"];
  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden mt-3"
        >
          <div className="space-y-1.5">
            {habits.map((h, i) => (
              <motion.div key={h} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }} className="flex items-center gap-2 text-xs">
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, d) => (
                    <div key={d} className="w-3 h-3 rounded-sm"
                      style={{ background: d < 5 + i ? `${color}70` : "rgba(0,0,0,0.08)" }} />
                  ))}
                </div>
                <span style={{ color: "#475569" }}>{h}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] mt-2" style={{ color: "#94A3B8" }}>
            Week 2 of 3 → habit stacking in progress
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PodHoverCard({ color, isHovered }: { color: string; isHovered: boolean }) {
  const members = ["You", "Marcus", "Jordan", "Priya"];
  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden mt-3"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {members.map((m, i) => (
              <motion.div key={m} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: i === 0 ? `${color}20` : "rgba(0,0,0,0.05)",
                  border:     i === 0 ? `1.5px solid ${color}45` : "1.5px solid rgba(0,0,0,0.09)",
                  color:      i === 0 ? color : "#64748B",
                }}
              >
                {m[0]}
              </motion.div>
            ))}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
              style={{ background: "rgba(0,0,0,0.04)", border: "1.5px dashed rgba(0,0,0,0.10)", color: "#94A3B8" }}>+</div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: "#94A3B8" }}>
            AI-matched by goal, schedule, and timezone
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function HowItWorksSection() {
  const [subTab, setSubTab]       = useState<SubTab>("guides");
  const [scoreAnim, setScoreAnim] = useState(0);
  const [pillarsReady, setPillarsReady] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  // Which guide card is flipped to its "in action" chat demo (null = both fronts).
  const [flippedGuide, setFlippedGuide] = useState<Guide | null>(null);

  useEffect(() => {
    if (subTab !== "system") return;
    setScoreAnim(0);
    setPillarsReady(false);
    let n = 0;
    const step = () => {
      n += 2;
      if (n >= COMPOSITE_SCORE) {
        setScoreAnim(COMPOSITE_SCORE);
        setPillarsReady(true);
      } else {
        setScoreAnim(n);
        setTimeout(step, 18);
      }
    };
    setTimeout(step, 400);
  }, [subTab]);

  const subTabs: { id: SubTab; label: string; color: string; hint: string }[] = [
    { id: "guides",   label: "Your Guides",  color: "#00C47A", hint: "Althea & Kairo"  },
    { id: "system",   label: "The System",   color: "#3B82F6", hint: "Kinextion Score" },
    { id: "features", label: "Features",     color: "#A855F7", hint: "What's inside"   },
  ];

  return (
    <section className="tab-section">
      <div className="section-container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="section-label" style={{ color: "#0ABAB5" }}>How It Works</p>
          <h2
            className="font-bold mb-4 text-balance"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#0F172A" }}
          >
            Two guides. One system.{" "}
            <span style={{ color: "#64748B" }}>All working together.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto text-balance" style={{ color: "#475569" }}>
            Every layer of Kinextion feeds into the next — and everything learns from you over time.
          </p>
        </motion.div>

        {/* Sub-tab selector */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 max-w-xl mx-auto mb-14"
        >
          {subTabs.map((t) => {
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className="relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl text-center transition-all duration-200 cursor-pointer"
                style={{
                  background: isActive ? `${t.color}08` : "rgba(0,0,0,0.03)",
                  border:     isActive ? `1.5px solid ${t.color}35` : "1.5px solid rgba(0,0,0,0.08)",
                  boxShadow:  isActive ? `0 0 16px ${t.color}12` : "none",
                  transform:  isActive ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <span className="text-xs font-bold" style={{ color: isActive ? t.color : "#64748B" }}>
                  {t.label}
                </span>
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>{t.hint}</span>
                <motion.div
                  className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                  animate={{ scaleX: isActive ? 1 : 0, opacity: isActive ? 1 : 0 }}
                  style={{ background: t.color, transformOrigin: "left" }}
                  transition={{ duration: 0.3 }}
                />
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">

          {/* ── GUIDES ── */}
          {subTab === "guides" && (
            <motion.div
              key="guides"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {/* Flip container: two guide fronts ⇄ one guide's in-action demo */}
              <div style={{ perspective: 2000 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {flippedGuide ? (
                    /* ── Back face: the flipped guide's live chat demo ── */
                    <motion.div
                      key={`demo-${flippedGuide}`}
                      initial={{ rotateY: -90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      exit={{ rotateY: -90, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-card-vivid p-6 sm:p-8"
                      style={{ border: `1px solid ${guideConfig[flippedGuide].border}` }}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                            style={{ background: guideConfig[flippedGuide].bg, border: `1px solid ${guideConfig[flippedGuide].border}` }}>
                            {guideConfig[flippedGuide].emoji}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold" style={{ color: "#0F172A" }}>{guideConfig[flippedGuide].name} in action</h3>
                            <p className="text-xs" style={{ color: guideConfig[flippedGuide].color }}>Watch {guideConfig[flippedGuide].name} synthesize a real week</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFlippedGuide(null)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-150 hover:scale-105"
                          style={{ background: `${guideConfig[flippedGuide].color}10`, border: `1px solid ${guideConfig[flippedGuide].color}28`, color: guideConfig[flippedGuide].color }}
                        >
                          ← Back
                        </button>
                      </div>
                      <GuideChatDemo guide={flippedGuide} />
                    </motion.div>
                  ) : (
                    /* ── Front face: both guide profile cards ── */
                    <motion.div
                      key="fronts"
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      exit={{ rotateY: 90, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Althea */}
                <div className="glass-card-vivid p-8 relative overflow-hidden" style={{ border: "1px solid rgba(0,196,122,0.20)" }}>
                  <div
                    className="pointer-events-none absolute top-0 right-0 w-48 h-48 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(0,196,122,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }}
                  />

                  <div className="flex items-center gap-3 mb-6">
                    <motion.div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      style={{ background: "rgba(0,196,122,0.10)", border: "1px solid rgba(0,196,122,0.24)" }}
                    >⚡</motion.div>
                    <div>
                      <h3 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Althea</h3>
                      <p className="text-sm font-medium" style={{ color: "#00C47A" }}>The Coach</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs" style={{ color: "#94A3B8" }}>Female · Athletic · Direct</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mb-6" style={{ color: "#475569" }}>
                    Althea doesn&apos;t do generic. She takes your data — your HRV, your sleep, your
                    schedule, your actual week — and builds you a plan that fits it. When life shifts,
                    she shifts with it.
                  </p>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {metrics.map((m) => (
                      <motion.div
                        key={m.label}
                        className="rounded-xl p-3 text-center"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                        style={{ background: `${m.color}08`, border: `1px solid ${m.color}22` }}
                      >
                        <p className="text-lg font-bold" style={{ color: m.color }}>
                          {m.value}<span className="text-xs">{m.unit}</span>
                        </p>
                        <p className="text-[10px]" style={{ color: "#64748B" }}>{m.label}</p>
                        <p className="text-[10px] font-semibold" style={{ color: m.color }}>{m.trend}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    {altheaTraits.map((trait, i) => (
                      <motion.div key={trait.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#00C47A" }} />
                        <div>
                          <span className="text-xs font-bold" style={{ color: "#0F172A" }}>{trait.label} </span>
                          <span className="text-xs" style={{ color: "#64748B" }}>— {trait.desc}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Flip to Althea's live in-action chat demo */}
                  <button
                    onClick={() => setFlippedGuide("althea")}
                    className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[1.02]"
                    style={{ background: "rgba(0,196,122,0.08)", border: "1px solid rgba(0,196,122,0.28)", color: "#00C47A" }}
                  >
                    See Althea in action
                    <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>↻</motion.span>
                  </button>
                </div>

                {/* Kairo */}
                <div className="glass-card-vivid p-8 relative overflow-hidden" style={{ border: "1px solid rgba(168,85,247,0.20)" }}>
                  <div
                    className="pointer-events-none absolute top-0 left-0 w-48 h-48 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }}
                  />
                  <motion.div
                    className="pointer-events-none absolute bottom-8 right-8 w-32 h-32 rounded-full"
                    animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.04, 0.10, 0.04] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ background: "rgba(168,85,247,0.6)" }}
                  />

                  <div className="flex items-center gap-3 mb-6">
                    <motion.div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.24)" }}
                    >🌊</motion.div>
                    <div>
                      <h3 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Kairo</h3>
                      <p className="text-sm font-medium" style={{ color: "#A855F7" }}>The Listener</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs" style={{ color: "#94A3B8" }}>Male · Calm · Empathetic</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mb-6" style={{ color: "#475569" }}>
                    Kairo notices what you don&apos;t say. He tracks your emotional patterns across
                    your check-ins, your sleep, your journal — and responds with the kind of
                    clarity that actually lands.
                  </p>

                  <div className="mb-6 rounded-xl p-4" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.14)" }}>
                    <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#A855F7" }}>
                      Mood Pattern · Last 7 Days
                    </p>
                    <div className="flex items-end gap-1.5 h-10">
                      {[4, 5, 3, 6, 4, 7, 6].map((h, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t"
                          initial={{ height: 0 }}
                          animate={{ height: `${h * 14}%` }}
                          transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                          style={{ background: i === 5 ? "#A855F7" : "rgba(168,85,247,0.22)", minHeight: 4 }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      {["M","T","W","T","F","S","S"].map((d, i) => (
                        <span key={i} className="flex-1 text-center text-[9px]" style={{ color: "#94A3B8" }}>{d}</span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {kairoTraits.map((trait, i) => (
                      <motion.div key={trait.label} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#A855F7" }} />
                        <div>
                          <span className="text-xs font-bold" style={{ color: "#0F172A" }}>{trait.label} </span>
                          <span className="text-xs" style={{ color: "#64748B" }}>— {trait.desc}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Flip to Kairo's live in-action chat demo */}
                  <button
                    onClick={() => setFlippedGuide("kairo")}
                    className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-[1.02]"
                    style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.28)", color: "#A855F7" }}
                  >
                    See Kairo in action
                    <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>↻</motion.span>
                  </button>
                </div>
              </div>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-center text-sm mt-8"
                        style={{ color: "#64748B" }}
                      >
                        Althea and Kairo share context — so when your stress affects your training, both know.
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── SYSTEM ── */}
          {subTab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="glass-card-vivid max-w-md mx-auto p-8 mb-12 glow-border"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
                      Kinextion Score
                    </p>
                    <p
                      className="text-6xl font-extrabold leading-none"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {scoreAnim}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm" style={{ color: "#00C47A" }}>↑ 7 pts</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>vs last week</p>
                    <p className="text-xs mt-2" style={{ color: "#475569" }}>🔥 5-day streak</p>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full mb-2" style={{ background: "rgba(0,0,0,0.07)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #00C47A, #0ABAB5, #3B82F6)" }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${scoreAnim}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  />
                </div>
                <p className="text-xs text-right" style={{ color: "#94A3B8" }}>You&apos;re building momentum.</p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {pillars.map((p, i) => (
                  <motion.div
                    key={p.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: pillarsReady ? 1 : 0, y: pillarsReady ? 0 : 20 }}
                    transition={{ delay: i * 0.1, duration: 0.45 }}
                    whileHover={{ scale: 1.03 }}
                    className="glass-card p-6 transition-all duration-300"
                    style={{ border: `1px solid ${p.color}18` }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: `${p.color}10`, border: `1px solid ${p.color}20` }}
                      >
                        {p.emoji}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: "#0F172A" }}>{p.label}</h3>
                        <p className="text-[10px]" style={{ color: p.color }}>{p.trend}</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full mb-3" style={{ background: "rgba(0,0,0,0.07)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: p.color }}
                        initial={{ width: "0%" }}
                        animate={{ width: pillarsReady ? `${p.score}%` : "0%" }}
                        transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs" style={{ color: "#64748B" }}>{p.description}</p>
                      <span className="text-sm font-bold ml-2 shrink-0" style={{ color: p.color }}>{p.score}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── FEATURES ── */}
          {subTab === "features" && (
            <motion.div
              key="features"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {abstractFeatures.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.45 }}
                    className="glass-card-vivid p-6 flex flex-col relative overflow-hidden"
                    style={{ border: `1px solid ${f.color}18` }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: f.color }}>
                      {f.tag}
                    </span>
                    <h3 className="font-bold text-base mb-3" style={{ color: "#0F172A" }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed mb-4" style={{ color: "#475569" }}>{f.description}</p>
                    <div className="mt-auto" style={{ minHeight: 72 }}>
                      {f.visual === "chat"   && <ChatVisual color={f.color} />}
                      {f.visual === "review" && <ReviewVisual color={f.color} />}
                      {f.visual === "nudge"  && <NudgeVisual color={f.color} />}
                    </div>
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl opacity-25"
                      style={{ background: `linear-gradient(90deg, transparent, ${f.color}, transparent)` }}
                    />
                  </motion.div>
                ))}

                {hoverFeatures.map((f, i) => {
                  const isHovered = hoveredFeature === f.title;
                  return (
                    <motion.div
                      key={f.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.45 }}
                      onHoverStart={() => setHoveredFeature(f.title)}
                      onHoverEnd={() => setHoveredFeature(null)}
                      className={`glass-card p-6 flex flex-col cursor-pointer transition-all duration-300 relative overflow-hidden ${f.comingSoon ? "opacity-60" : ""}`}
                      style={{
                        border: `1px solid ${isHovered ? f.color + "35" : f.color + "18"}`,
                        boxShadow: isHovered ? `0 8px 28px ${f.color}14` : `0 0 0 0 transparent`,
                        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                      }}
                    >
                      {f.comingSoon && (
                        <span
                          className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ color: "#94A3B8", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}
                        >
                          Soon
                        </span>
                      )}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3"
                        style={{ background: `${f.color}10`, border: `1px solid ${f.color}20` }}
                      >
                        {f.emoji}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: f.color }}>
                        {f.tag}
                      </span>
                      <h3 className="font-bold text-base mb-2" style={{ color: "#0F172A" }}>{f.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{f.description}</p>

                      {/* Hover affordance hint — visible only when not hovered */}
                      {!f.comingSoon && !isHovered && (
                        <motion.div
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="mt-3 flex items-center gap-1.5 text-[10px] font-medium"
                          style={{ color: f.color }}
                        >
                          <motion.span
                            animate={{ x: [0, 3, 0] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                          >
                            →
                          </motion.span>
                          Hover to explore
                        </motion.div>
                      )}

                      {f.title === "Habit Tracking"  && <HabitHoverCard color={f.color} isHovered={isHovered} />}
                      {f.title === "Community Pods"  && <PodHoverCard   color={f.color} isHovered={isHovered} />}
                      {f.comingSoon && isHovered && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="text-xs mt-3" style={{ color: "#94A3B8" }}>
                          AI referee launching with the mobile app
                        </motion.p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center text-sm mt-10"
                style={{ color: "#64748B" }}
              >
                All features share a single user model — Althea knows when Kairo noticed stress,
                and your habits inform your training.
              </motion.p>
            </motion.div>
          )}

        </AnimatePresence>

        <NextPageButton toTab="research" label="Explore the science behind it" />
      </div>
    </section>
  );
}
