"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/components/navigation/TabLayout";
import { guideConfig, type Guide } from "@/components/sections/GuideChatDemo";

// ─── 12 data sources orbiting the Kinextion core ──────────────────────────────
// Four rings × 3 signals = the 12 inputs Kinextion fuses. Each signal carries a
// live reading (`sub`), the kinds of data it collects, and how that data feeds
// the synthesis — all surfaced as a mini "article" when a signal is explored.
type Signal = {
  readonly icon: string;
  readonly label: string;
  readonly sub: string;
  readonly color: string;
  readonly r: number;
  readonly speed: number;
  readonly delay: number;
  readonly collects: readonly string[];
  readonly aids: string;
};

const ORBIT_RADII = [86, 138, 190, 242];

const ORBITAL_PLANETS: readonly Signal[] = [
  // Inner ring r=86 — period 22s
  { icon: "⌚", label: "Apple Watch", sub: "72 BPM · HRV 41ms ↓ −27ms", color: "#00C47A", r: 86, speed: 22, delay: 0,
    collects: ["Heart rate & resting HR", "Heart-rate variability", "Workout strain & calories"],
    aids: "Real-time recovery readouts let Kinextion dial today's intensity up or down before you ever feel the crash." },
  { icon: "🥗", label: "Nutrition Log", sub: "Protein 64g · Calories 1,842", color: "#F59E0B", r: 86, speed: 22, delay: -7.3,
    collects: ["Protein, carbs & calories", "Meal timing", "Hydration"],
    aids: "Fuel data tells Kinextion whether your body can back the plan — or whether today should be lighter and smarter." },
  { icon: "🎯", label: "Goal Progress", sub: "Streak 18d · Momentum HIGH", color: "#3B82F6", r: 86, speed: 22, delay: -14.6,
    collects: ["Active streaks", "Momentum trend", "Milestone pace"],
    aids: "Momentum tracking lets Kinextion protect a fragile streak instead of risking the all-or-nothing break." },
  // Ring 2 r=138 — period 32s
  { icon: "🏃", label: "Strava", sub: "5.4 mi · 8:42/mi · HIGH load", color: "#EF4444", r: 138, speed: 32, delay: 0,
    collects: ["Distance & pace", "Training load", "Route & elevation"],
    aids: "Endurance load feeds the fatigue model so Kinextion never stacks a hard run on an already-tired system." },
  { icon: "💍", label: "Oura Ring", sub: "Sleep 71 · Deep 52min · REM 18%", color: "#7B2FBE", r: 138, speed: 32, delay: -10.7,
    collects: ["Sleep stages (deep / REM)", "Resting HR & temperature", "Readiness score"],
    aids: "Sleep architecture is the foundation — one poor night quietly rewrites the entire day's brief." },
  { icon: "👨‍👩‍👧", label: "Family Context", sub: "Parents arrive Fri · high-stakes", color: "#0ABAB5", r: 138, speed: 32, delay: -21.3,
    collects: ["Key relationships & events", "High-stakes moments", "Emotional load"],
    aids: "Life context tells Kinextion when to ease off — a system that ignores your family was never built for your life." },
  // Ring 3 r=190 — period 44s
  { icon: "📅", label: "Calendar", sub: "Q3 Presentation Thu ⚠ · Parents Fri", color: "#3B82F6", r: 190, speed: 44, delay: 0,
    collects: ["Meetings & deadlines", "Travel & commitments", "Open windows"],
    aids: "Your real schedule lets Kinextion place the session where it'll actually happen — not where it's convenient." },
  { icon: "🧠", label: "3-yr Memory", sub: "82% pattern match · active", color: "#A855F7", r: 190, speed: 44, delay: -14.7,
    collects: ["Long-term patterns", "What worked before", "Seasonal trends"],
    aids: "Three years of memory means Kinextion spots the spiral early — it has seen this exact pattern in you before." },
  { icon: "💬", label: "Chat History", sub: "47 sessions · last: 2d ago", color: "#EC4899", r: 190, speed: 44, delay: -29.3,
    collects: ["Past conversations", "Stated goals & blockers", "Tone & sentiment"],
    aids: "Everything you've told Althea and Kairo stays known — so you never have to re-explain who you are." },
  // Outer ring r=242 — period 58s
  { icon: "📱", label: "Behavior", sub: "Screen ↑40% · Journal 6d silent", color: "#F59E0B", r: 242, speed: 58, delay: 0,
    collects: ["App & screen patterns", "Journaling cadence", "Engagement dips"],
    aids: "Behavioral drift is the earliest warning — a six-day journaling silence speaks louder than any check-in." },
  { icon: "🫀", label: "Mood Journal", sub: "Anxious 4/5 · 5-day trend ↑", color: "#EF4444", r: 242, speed: 58, delay: -19.3,
    collects: ["Daily mood ratings", "Emotional trends", "Triggers & notes"],
    aids: "Mood trends let Kairo step in early — before a hard week quietly becomes a lost month." },
  { icon: "🧘", label: "Mindfulness", sub: "Last session 6d ago · needed", color: "#0ABAB5", r: 242, speed: 58, delay: -38.6,
    collects: ["Session frequency", "Stress & breath work", "Recovery practices"],
    aids: "Knowing your last calm moment was six days ago, Kinextion surfaces the reset you didn't know you needed." },
];

// Kinextion core branding — the aurora gradient that represents the synthesis
// engine at the centre of the system (distinct from either individual guide).
const KIN_GRADIENT = "linear-gradient(135deg, #00C47A 0%, #0ABAB5 50%, #A855F7 100%)";

// ─── Today's Brief content — surfaced in the popup when the core is tapped ─────
const todaysBriefItems = [
  { dot: "#F59E0B", text: "Recovery: MODERATE  ·  HRV 27ms below your baseline" },
  { dot: "#EF4444", text: "HIGH-STAKES WEEK  ·  Q3 Presentation Thu + Family Fri" },
  { dot: "#EF4444", text: "Pattern Alert: emotional shutdown signals  82% active" },
];
const briefActions: Record<Guide, string> = {
  althea: "Recovery protocol active  ·  peaking you for Thursday",
  kairo:  "Emotional support first  ·  physical asks can wait",
};

// The live readings that "fed" today's brief — they drift in around the popup so
// you can see exactly which signals the synthesis was assembled from.
const briefContributors = [
  { icon: "💍", text: "Sleep 71",    color: "#7B2FBE" },
  { icon: "⌚", text: "HRV −27ms",   color: "#00C47A" },
  { icon: "📅", text: "Q3 Thu ⚠",    color: "#3B82F6" },
  { icon: "🫀", text: "Anxious 4/5", color: "#EF4444" },
  { icon: "👨‍👩‍👧", text: "Family Fri", color: "#0ABAB5" },
  { icon: "📱", text: "Journal 6d",  color: "#F59E0B" },
  { icon: "🏃", text: "HIGH load",   color: "#EF4444" },
  { icon: "🧠", text: "82% match",   color: "#A855F7" },
];

// ─── Signal article — the rich "what we read & why it matters" panel ───────────
// Floats over the right of the orbit stage when a signal is hovered or pinned.
// Reads like a short article: live data, the inputs collected, and the synthesis payoff.
function SignalArticle({
  signal, pinned, onClose,
}: { readonly signal: Signal; readonly pinned: boolean; readonly onClose: () => void }) {
  return (
    <motion.aside
      key={signal.label}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card-dark-vivid absolute z-40 p-5 sm:p-6 w-[min(92vw,360px)] right-2 sm:right-4 top-1/2 -translate-y-1/2"
      style={{ borderColor: `${signal.color}45` }}
    >
      {/* Top-edge accent glow in the signal's colour */}
      <div className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${signal.color}1f 0%, transparent 70%)` }} />

      {pinned && (
        <button onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[11px] z-10 transition-colors hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)" }}
          aria-label="Close">✕</button>
      )}

      <div className="relative z-[5]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `${signal.color}1f`, border: `1px solid ${signal.color}45` }}>
            {signal.icon}
          </span>
          <div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>Intelligence Source</p>
            <h4 className="font-bold text-base leading-tight" style={{ color: "#FFFFFF" }}>{signal.label}</h4>
          </div>
        </div>

        {/* Live reading */}
        <div className="rounded-lg px-3 py-2 mb-4 text-xs font-medium flex items-center gap-2"
          style={{ background: `${signal.color}14`, border: `1px solid ${signal.color}2e`, color: signal.color }}>
          <motion.span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: signal.color }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
          {signal.sub}
        </div>

        {/* What we collect */}
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>
          What we read
        </p>
        <ul className="space-y-1.5 mb-4">
          {signal.collects.map((c) => (
            <li key={c} className="flex items-start gap-2 text-xs leading-snug" style={{ color: "rgba(255,255,255,0.80)" }}>
              <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ background: signal.color }} />
              {c}
            </li>
          ))}
        </ul>

        {/* How it feeds Kinextion */}
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.38)" }}>
          How it feeds Kinextion
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.68)" }}>{signal.aids}</p>
      </div>
    </motion.aside>
  );
}

// ─── Immersive Solar System — Kinextion core fusing 12 orbiting signals ────────
// Fills its container (the page's flex stage) and renders transparently so the
// shared space backdrop shows through. Hovering a signal pauses every orbit and
// opens its article; tapping the glowing core opens the Today's Brief popup.
function SolarSystem({ onOpenBrief }: { readonly onOpenBrief: () => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx]   = useState<number | null>(null);
  // Pinned (clicked) wins over hovered so you can move the mouse to read the article.
  const activeIdx = pinnedIdx ?? hoveredIdx;
  const active = activeIdx !== null ? ORBITAL_PLANETS[activeIdx] : null;
  const paused = activeIdx !== null;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Orbit rings — concentric guides for the four data tiers */}
      {ORBIT_RADII.map((r, i) => (
        <div key={r} className="pointer-events-none absolute top-1/2 left-1/2"
          style={{
            width: r * 2, height: r * 2, transform: "translate(-50%, -50%)",
            borderRadius: "50%", border: `1px solid rgba(255,255,255,${0.12 - i * 0.02})`,
          }} />
      ))}

      {/* Core — the Kinextion synthesis engine; tap to open Today's Brief */}
      <div className="absolute top-1/2 left-1/2" style={{ transform: "translate(-50%, -50%)", zIndex: 20 }}>
        {/* Pulsing aura behind the core */}
        <motion.div
          style={{
            position: "absolute", inset: -38, borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(10,186,181,0.32) 0%, transparent 70%)",
            filter: "blur(10px)",
          }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.button
          onClick={onOpenBrief}
          className="rounded-full flex flex-col items-center justify-center relative z-10 cursor-pointer"
          style={{
            width: 104, height: 104,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.20), rgba(10,186,181,0.12) 60%, transparent 100%)",
            border: "2px solid rgba(255,255,255,0.45)",
            boxShadow: "0 0 34px rgba(10,186,181,0.45), 0 0 70px rgba(123,47,190,0.22)",
          }}
          whileHover={{ scale: 1.05 }}
          animate={{ boxShadow: [
            "0 0 34px rgba(10,186,181,0.45), 0 0 70px rgba(123,47,190,0.22)",
            "0 0 52px rgba(10,186,181,0.65), 0 0 100px rgba(123,47,190,0.34)",
            "0 0 34px rgba(10,186,181,0.45), 0 0 70px rgba(123,47,190,0.22)",
          ]}}
          transition={{ duration: 3, repeat: Infinity }}
          aria-label="Open Today's Brief"
        >
          <span className="text-2xl leading-none">✦</span>
          <span
            className="text-xs font-extrabold mt-0.5"
            style={{ backgroundImage: KIN_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            Kinextion
          </span>
        </motion.button>
        {/* Tap affordance under the core */}
        <motion.p
          className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-[9px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.45)" }}
          animate={{ opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          tap for today&apos;s brief
        </motion.p>
      </div>

      {/* Planets — each orbits its ring on the shared CSS keyframe (paused while reading) */}
      {ORBITAL_PLANETS.map((planet, i) => {
        const isActive = activeIdx === i;
        return (
          <div
            key={planet.label}
            style={{
              position: "absolute", top: "50%", left: "50%", width: 0, height: 0,
              zIndex: isActive ? 30 : 10,
              animation: `kinextion-orbit ${planet.speed}s linear infinite`,
              animationDelay: `${planet.delay}s`,
              animationPlayState: paused ? "paused" : "running",
              "--orbit-r": `${planet.r}px`,
            } as React.CSSProperties}
          >
            <div
              style={{ position: "absolute", width: 48, height: 48, marginLeft: -24, marginTop: -24, cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setPinnedIdx((prev) => (prev === i ? null : i))}
            >
              <motion.div
                animate={{ scale: isActive ? 1.32 : 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: isActive ? `${planet.color}30` : `${planet.color}18`,
                  border: `1.5px solid ${planet.color}${isActive ? "78" : "40"}`,
                  boxShadow: isActive
                    ? `0 0 22px ${planet.color}60, 0 0 44px ${planet.color}28`
                    : `0 0 10px ${planet.color}35`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                }}
              >
                {planet.icon}
              </motion.div>
            </div>
          </div>
        );
      })}

      {/* Idle hint — only while nothing is being explored */}
      <AnimatePresence>
        {!active && (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap"
            style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            Hover a signal to read what it feeds · click to keep it open
          </motion.p>
        )}
      </AnimatePresence>

      {/* Article overlay */}
      <AnimatePresence mode="wait">
        {active && (
          <SignalArticle
            signal={active}
            pinned={pinnedIdx !== null}
            onClose={() => { setPinnedIdx(null); setHoveredIdx(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Today's Brief popup — the "magical" synthesis moment ──────────────────────
// Dark-glass card summarising the day, wrapped in an aurora bloom with the live
// signals that fed it drifting inward — so the brief visibly assembles from data.
function TodaysBriefPopup({ onClose }: { readonly onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
      style={{ background: "rgba(2,6,23,0.62)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Aurora bloom behind the whole moment */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: 700, height: 700, transform: "translate(-50%, -50%)", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(10,186,181,0.20) 0%, rgba(123,47,190,0.10) 45%, transparent 70%)",
          filter: "blur(22px)",
        }}
        animate={{ scale: [0.9, 1.06, 0.9], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating data motes — the live signals that fed today's brief, drifting inward */}
      {briefContributors.map((c, i) => {
        const angle = (i / briefContributors.length) * Math.PI * 2 - Math.PI / 2;
        const rx = 322, ry = 234;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        return (
          <motion.div
            key={c.text}
            className="pointer-events-none absolute left-1/2 top-1/2 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(8,12,30,0.72)", border: `1px solid ${c.color}55`,
              boxShadow: `0 0 16px ${c.color}33`, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            }}
            initial={{ x: x * 1.3, y: y * 1.3, opacity: 0 }}
            animate={{ x: [x, x * 0.84, x], y: [y, y * 0.84, y], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 4.5 + i * 0.35, repeat: Infinity, ease: "easeInOut", delay: 0.25 + i * 0.16 }}
          >
            <span className="text-xs">{c.icon}</span>
            <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: c.color }}>{c.text}</span>
          </motion.div>
        );
      })}

      {/* The brief card */}
      <motion.div
        className="glass-card-dark-vivid w-full max-w-lg p-6 relative z-10"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — title + day + close button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🗂</span>
            <span className="font-bold text-sm" style={{ color: "#FFFFFF" }}>Today&apos;s Brief</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>Wednesday</span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Synthesis bullets */}
        <div className="space-y-2.5 mb-5">
          {todaysBriefItems.map((item, i) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + i * 0.09 }}
              className="flex items-center gap-2.5 text-xs"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.dot }} />
              <span style={{ color: "rgba(255,255,255,0.80)" }}>{item.text}</span>
            </motion.div>
          ))}
        </div>

        {/* How each guide responds to the brief */}
        <div className="grid sm:grid-cols-2 gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
          {(["althea", "kairo"] as Guide[]).map((g) => {
            const gc = guideConfig[g];
            return (
              <div key={g} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5"
                  style={{ background: `${gc.color}18`, border: `1px solid ${gc.color}40`, color: gc.color }}>
                  {gc.emoji}
                </span>
                <div>
                  <span className="text-[10px] font-bold" style={{ color: gc.color }}>{gc.name}</span>
                  <span className="text-[10px] ml-1" style={{ color: "rgba(255,255,255,0.55)" }}>→ {briefActions[g]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Synthesis footnote — ties the floating motes to the brief */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-5 pt-4 text-[10px] text-center uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.40)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          Synthesized live from 12 signals orbiting you
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// ─── Solution page ─────────────────────────────────────────────────────────────
// A single, non-scrolling viewport: a compact header, the immersive solar system
// filling the middle, and a compact CTA. Renders over the shared dark space backdrop.
export function ShiftSection() {
  const navigate = useNavigate();
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <section
      className="relative flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - var(--nav-height, 56px))" }}
    >
      {/* ── Header — the "12 signals, one synthesis" promise, front and centre ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="shrink-0 text-center px-4 pt-5 sm:pt-7"
      >
        <p className="section-label" style={{ color: "#00C47A", marginBottom: "0.5rem" }}>The Solution</p>
        <h2 className="font-bold text-balance leading-tight" style={{ fontSize: "clamp(1.9rem, 4.6vw, 3.4rem)", color: "#FFFFFF" }}>
          Twelve signals.{" "}
          <span style={{ backgroundImage: KIN_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            One synthesis.
          </span>
        </h2>
        <p className="mt-2 text-sm max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.60)" }}>
          Not another app — a system that reads the day you&apos;re actually living, in real time.
        </p>
      </motion.div>

      {/* ── Solar system stage — fills the remaining height, clipped so it never scrolls ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="relative flex-1 min-h-0"
      >
        <SolarSystem onOpenBrief={() => setBriefOpen(true)} />
      </motion.div>

      {/* ── Compact CTA — Join Early Access + See How It Works ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="shrink-0 flex flex-col items-center gap-2 px-4 pb-5 sm:pb-6"
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            className="px-7 py-3 rounded-full font-bold text-sm text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)", boxShadow: "0 6px 24px rgba(0,196,122,0.30)" }}
          >
            Join Early Access
          </button>
          <button
            onClick={() => navigate("how-it-works")}
            className="px-7 py-3 rounded-full font-semibold text-sm transition-all duration-200 hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.80)", border: "1.5px solid rgba(255,255,255,0.20)" }}
          >
            See How It Works →
          </button>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
          Free during early access · 847 members already building
        </p>
      </motion.div>

      {/* Today's Brief popup — mounted at the section root, toggled by the core */}
      <AnimatePresence>
        {briefOpen && <TodaysBriefPopup onClose={() => setBriefOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}
