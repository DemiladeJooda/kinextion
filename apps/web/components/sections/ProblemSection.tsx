"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NextPageButton } from "@/components/navigation/NextPageButton";

// ─── People grid: who stays vs who drops ─────────────────────────────────────
const STAYING = new Set([
  1, 7, 13, 19, 20, 25, 32, 38, 44, 46,
  51, 57, 63, 69, 70, 75, 82, 88, 94, 96,
]);

const APPS = [
  { label: "Fitness",   emoji: "💪", color: "#00C47A", dx:  80, dy: -55, dur: 2.8 },
  { label: "Meditate",  emoji: "🧘", color: "#0ABAB5", dx: -85, dy: -30, dur: 3.3 },
  { label: "Run",       emoji: "🏃", color: "#3B82F6", dx:  90, dy:  40, dur: 2.6 },
  { label: "Nutrition", emoji: "🥗", color: "#A855F7", dx: -70, dy:  55, dur: 3.0 },
  { label: "Sleep",     emoji: "💤", color: "#F59E0B", dx:  10, dy: -85, dur: 3.4 },
  { label: "Journal",   emoji: "📓", color: "#EC4899", dx: -30, dy:  80, dur: 2.9 },
  { label: "Health",    emoji: "🫀", color: "#0ABAB5", dx:  60, dy:  60, dur: 3.1 },
];

const TOTAL_DAYS = 90;

// ─── Restart cycle data ───────────────────────────────────────────────────────
const restartCycle = [
  { label: "Fresh Start",     icon: "🌱", color: "#00C47A", desc: "New program, full motivation" },
  { label: "Building Streak", icon: "🔥", color: "#F59E0B", desc: "Weeks 2–4, feeling good" },
  { label: "Life Happens",    icon: "🌀", color: "#A855F7", desc: "Work, travel, relationships" },
  { label: "Dropped Off",     icon: "📉", color: "#EF4444", desc: "Missed days become missed weeks" },
  { label: "Guilt & Reset",   icon: "🔄", color: "#94A3B8", desc: "\"This time will be different\"" },
];

type Scene = 0 | 1 | 2;

export function ProblemSection() {
  const [activeScene, setActiveScene] = useState<Scene>(0);
  const scene0Ref = useRef<HTMLDivElement>(null);
  const scene1Ref = useRef<HTMLDivElement>(null);
  const scene2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refs = [scene0Ref.current, scene1Ref.current, scene2Ref.current];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = refs.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActiveScene(idx as Scene);
          }
        });
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: 0 }
    );
    refs.forEach((r) => r && observer.observe(r));
    return () => observer.disconnect();
  }, []);

  const [day, setDay] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = () => {
      if (!mounted) return;
      setDay(0);
      let d = 0;
      const tick = () => {
        if (!mounted) return;
        d++;
        setDay(d);
        if (d < TOTAL_DAYS) {
          setTimeout(tick, 38);
        } else {
          setTimeout(() => { if (mounted) run(); }, 2400);
        }
      };
      setTimeout(tick, 600);
    };
    run();
    return () => { mounted = false; };
  }, []);

  const dropThresholds = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    const map = new Map<number, number>();
    let thresholdIndex = 0;
    for (let i = 0; i < 100; i++) {
      if (!STAYING.has(i)) {
        map.set(i, Math.round((thresholdIndex / 79) * 88));
        thresholdIndex++;
      }
    }
    dropThresholds.current = map;
  }, []);

  const [cycleStep, setCycleStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCycleStep((s) => (s + 1) % restartCycle.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  // Per-scene focus styling: the active scene is crisp and fully opaque while
  // the others dim and blur out, keeping the reader anchored on one stat at a time.
  const sceneStyle = (scene: Scene): React.CSSProperties => ({
    opacity:       activeScene === scene ? 1 : 0.10,
    filter:        activeScene === scene ? "none" : "blur(3px)",
    transition:    "opacity 0.7s ease, filter 0.7s ease",
    pointerEvents: activeScene === scene ? "auto" : "none",
  });

  return (
    <section className="relative">

      {/* ── Section header ── */}
      <div className="section-container relative z-10 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <p className="section-label" style={{ color: "#A855F7" }}>The Problem</p>
          {/* Heading spans the full page width (no max-width clamp) so the
              statement reads as a wide, page-spanning banner. */}
          <h2
            className="font-bold w-full mb-5 text-balance"
            style={{ fontSize: "clamp(2.2rem, 5.5vw, 4rem)", color: "#0F172A" }}
          >
            Health and wellness is fragmented,{" "}
            <span style={{ color: "#64748B" }}>but it doesn&apos;t have to be.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto text-balance" style={{ color: "#475569" }}>
            Most tools work to optimize parts of your health — but that&apos;s only addressing one part of the human puzzle.
          </p>
        </motion.div>

        {/* Progress indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-2 mt-20"
        >
          {([0, 1, 2] as Scene[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                animate={{
                  width:           activeScene === s ? 28 : 8,
                  backgroundColor: activeScene === s ? "#00C47A" : activeScene > s ? "rgba(0,196,122,0.4)" : "rgba(0,0,0,0.12)",
                }}
                transition={{ duration: 0.4 }}
                className="h-2 rounded-full"
              />
              {s < 2 && <div className="w-5 h-px" style={{ background: "rgba(0,0,0,0.08)" }} />}
            </div>
          ))}
        </motion.div>
      </div>

      {/* ══ SCENE 0 — The Dropout + 90-Day Clock ══ */}
      <div ref={scene0Ref} className="section-container relative z-10 py-56" style={sceneStyle(0)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="pt-4">
            <div className="stat-number">80%</div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: "#0F172A" }}>
              The number of people who abandon or fall short of their health goals within the first 3 months
            </h3>
            <p className="leading-relaxed mb-4" style={{ color: "#475569" }}>
              People start with commitment — they download the app, plan their time, and try to stay consistent. There&apos;s real motivation behind every step.
            </p>
            <p className="leading-relaxed mb-6" style={{ color: "#475569" }}>
              However, most programs are built for consistency on paper, but don&apos;t address the reality of everyday life; where schedules shift, energy changes, and priorities evolve. The result isn&apos;t lack of commitment, but a mismatch between expectations and real capacity.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>
              100 people who started a wellness journey
            </p>

            <div className="grid gap-[4px]" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
              {Array.from({ length: 100 }, (_, i) => {
                const stays = STAYING.has(i);
                const threshold = dropThresholds.current.get(i) ?? 0;
                const hasFaded = !stays && day >= threshold;
                return (
                  <motion.div
                    key={i}
                    animate={
                      day === 0
                        ? { opacity: 0, scale: 0.5 }
                        : hasFaded
                        ? { opacity: 0.12, scale: 0.75, y: 5 }
                        : { opacity: 1, scale: 1, y: 0 }
                    }
                    transition={{
                      duration: hasFaded ? 0.5 : 0.22,
                      ease:     "easeOut",
                      delay:    day === 0 ? i * 0.008 : hasFaded ? 0.04 : 0,
                    }}
                    style={{ width: 22, height: 26 }}
                  >
                    <svg viewBox="0 0 10 12" fill="none">
                      <circle cx="5" cy="2.5" r="2.2" fill={hasFaded ? "#CBD5E1" : "#00C47A"} />
                      <path
                        d="M1.5 11.5 C1.5 7.5 8.5 7.5 8.5 11.5"
                        stroke={hasFaded ? "#CBD5E1" : "#00C47A"}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </motion.div>
                );
              })}
            </div>

            <div className="w-full max-w-xs">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "#94A3B8" }}>Day 1</span>
                <span className="text-[10px] font-semibold" style={{ color: day >= 60 ? "#EF4444" : "#00C47A" }}>
                  Day {Math.min(day, TOTAL_DAYS)}
                </span>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "#94A3B8" }}>Day 90</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: "rgba(0,0,0,0.08)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: day > 75
                      ? "linear-gradient(90deg, #00C47A, #EF4444)"
                      : "linear-gradient(90deg, #00C47A, #0ABAB5)",
                  }}
                  animate={{ width: `${(Math.min(day, TOTAL_DAYS) / TOTAL_DAYS) * 100}%` }}
                  transition={{ duration: 0.04, ease: "linear" }}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#00C47A" }} />
                  Still going ({STAYING.size})
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "#94A3B8" }}>
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#CBD5E1" }} />
                  Dropped off ({100 - STAYING.size})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ SCENE 1 — 5+ Apps, Fragmented System ══ */}
      <div ref={scene1Ref} className="section-container relative z-10 py-56" style={sceneStyle(1)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <div className="stat-number">5+</div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: "#0F172A" }}>
              The number of apps the average person manages for their health
            </h3>
            <p className="leading-relaxed mb-3" style={{ color: "#475569" }}>
              One for workouts. One for meditation. One for nutrition. One for sleep.
              They all live in the same house, just don&apos;t speak the same language, yet!
            </p>
            <p className="leading-relaxed" style={{ color: "#475569" }}>
              None of them talk to each other. None of them know <em className="not-italic font-semibold" style={{ color: "#0F172A" }}>you</em>.
              Without a system that sees the whole picture, every additional app just adds more noise.
            </p>
          </div>

          <div className="relative flex items-center justify-center" style={{ height: 300 }}>
            {APPS.map((app, i) => (
              <motion.div
                key={app.label}
                style={{ position: "absolute", left: "50%", top: "50%" }}
                animate={{
                  x: [app.dx - 5, app.dx + 5, app.dx - 5],
                  y: [app.dy - 8, app.dy + 8, app.dy - 8],
                }}
                transition={{ duration: app.dur, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div
                  className="flex flex-col items-center justify-center rounded-2xl"
                  style={{
                    width: 58, height: 58,
                    background: `${app.color}10`,
                    border:     `1px solid ${app.color}30`,
                    transform:  "translate(-50%,-50%)",
                    boxShadow:  `0 4px 14px ${app.color}18`,
                  }}
                >
                  <span className="text-xl leading-none">{app.emoji}</span>
                  <span className="text-[9px] mt-0.5 font-semibold" style={{ color: app.color }}>
                    {app.label}
                  </span>
                </div>
              </motion.div>
            ))}

            <motion.div
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.97, 1.02, 0.97] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="glass-card px-5 py-3 z-10 text-center"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "#475569" }}>No single source of truth</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>Maximum effort, minimum coherence</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ══ SCENE 2 — The Restart Cycle ══ */}
      <div ref={scene2Ref} className="section-container relative z-10 py-56" style={sceneStyle(2)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <div className="stat-number">4×</div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: "#0F172A" }}>
              Number of times per year the average person restarts their wellness journey.
            </h3>
            <p className="leading-relaxed mb-4" style={{ color: "#475569" }}>
              New Year&apos;s Resolution. Post-vacation. After a breakup. Reminiscing on what once was.
              Motivation builds, and a new chapter begins. A new program. New gear. New conviction that this time around will be different.
            </p>
            <p className="leading-relaxed" style={{ color: "#475569" }}>
              However, each restart begins at Week 1. No memory of what worked before, and no system to build on it. Just a fresh start waiting for something to connect it all together.
            </p>
          </div>

          <div className="relative flex flex-col items-center gap-6">
            <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>
              The cycle most people are stuck in
            </p>

            <div className="relative w-full max-w-xs">
              {restartCycle.map((step, i) => {
                const isActive = cycleStep === i;
                const isPast   = cycleStep > i;
                return (
                  <motion.div
                    key={step.label}
                    className="flex items-center gap-4 mb-3"
                    animate={{ opacity: isActive ? 1 : isPast ? 0.45 : 0.22 }}
                    transition={{ duration: 0.5 }}
                  >
                    {i < restartCycle.length - 1 && (
                      <div
                        className="absolute left-[19px]"
                        style={{
                          top:    `${i * 52 + 36}px`,
                          height: 20,
                          width:  1,
                          background: isActive ? step.color : "rgba(0,0,0,0.10)",
                          transition: "background 0.5s",
                        }}
                      />
                    )}

                    <motion.div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 relative z-10"
                      animate={{
                        background: isActive ? `${step.color}18` : "rgba(0,0,0,0.04)",
                        border:     isActive ? `2px solid ${step.color}55` : "2px solid rgba(0,0,0,0.08)",
                        scale:      isActive ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.4 }}
                    >
                      {step.icon}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: isActive ? step.color : "#64748B" }}>
                        {step.label}
                      </p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>{step.desc}</p>
                    </div>

                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: step.color }}
                      />
                    )}
                  </motion.div>
                );
              })}

              <div className="flex items-center gap-2 mt-2 pl-1">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="text-sm"
                  style={{ color: "#94A3B8" }}
                >
                  ↻
                </motion.div>
                <span className="text-xs" style={{ color: "#94A3B8" }}>Repeats 4× per year on average</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Closing CTA — the persona carousel now lives on the Research page ══ */}
      <div className="relative z-10 pt-8 pb-24">
        <div className="section-container">
          <div className="border-t pt-20" style={{ borderColor: "rgba(0,0,0,0.07)" }} />
          <div className="mt-12">
            <NextPageButton toTab="shift" label="See how Kinextion closes the gap" />
          </div>
        </div>
      </div>
    </section>
  );
}
