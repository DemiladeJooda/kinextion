"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * A phone showing the app's real flows, drawn in the app's own design tokens
 * (apps/mobile/theme). Sample content only, and labelled as such where shown.
 * When real iPhone recordings exist, they can replace these one at a time.
 */

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, MapPin, Mic, Sparkles } from "lucide-react";
import { EASE } from "@/components/motion/primitives";
import { MAP_PLACES, KIND_COLOR } from "@/lib/community-places";
import { SAMPLE_PEOPLE, samplePhoto } from "@/lib/sample-voices";

const C = {
  bg: "#070B14",
  surface: "#0E1524",
  border: "rgba(255,255,255,0.07)",
  text: "#F5F8FC",
  muted: "#94A3B8",
  faint: "#5A6B85",
  green: "#00C47A",
  teal: "#0ABAB5",
  purple: "#A855F7",
  amber: "#F59E0B",
  red: "#EF4444",
};

const PHONE_W = 300;
const PHONE_H = 634;

/**
 * Drawn at one fixed size and scaled as a whole, so a small viewport gets a
 * smaller phone rather than a phone with clipped contents.
 */
export function PhoneFrame({ children, glow = "#0ABAB5" }: { readonly children: ReactNode; readonly glow?: string }) {
  const [scale, setScale] = useState(0.85);

  useEffect(() => {
    const fit = () => {
      const share = window.innerWidth >= 1024 ? 0.82 : 0.6;
      setScale(Math.min(1, (window.innerHeight * share) / PHONE_H));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
      animate={{ filter: `drop-shadow(0 30px 80px ${glow}55)` }}
      transition={{ duration: 0.8 }}
    >
      <div
        className="absolute top-0 left-0 rounded-[3rem] p-[7px] origin-top-left"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, background: "linear-gradient(150deg, #39445A 0%, #10151F 40%, #2A3345 100%)" }}
      >
        <div className="relative w-full h-full rounded-[2.6rem] overflow-hidden" style={{ background: C.bg }}>
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 rounded-full"
            style={{ width: "32%", height: 22, background: "#000" }}
          />
          {children}
        </div>
      </div>
    </motion.div>
  );
}

function Screen({ title, children }: { readonly title?: string; readonly children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 pt-14 px-4 flex flex-col"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {title ? (
        <p className="font-extrabold text-[22px] tracking-[-0.03em] mb-3" style={{ color: C.text }}>
          {title}
        </p>
      ) : null}
      {children}
    </motion.div>
  );
}

function GuideOrb({ color, second, size = 120 }: { readonly color: string; readonly second: string; readonly size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ inset: i * (size / 8.5), border: `1px solid ${color}66` }}
          animate={{ scale: [1, 1.16, 1], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
      <motion.span
        className="absolute rounded-full"
        style={{ inset: size / 3, background: `radial-gradient(circle at 35% 30%, #fff, ${color} 40%, ${second})`, boxShadow: `0 0 40px ${color}` }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.1, repeat: Infinity }}
      />
    </div>
  );
}

function Bubble({ from, delay, children }: { readonly from: "you" | "guide"; readonly delay: number; readonly children: ReactNode }) {
  return (
    <motion.p
      className={from === "you" ? "ml-auto max-w-[85%] w-fit rounded-2xl px-3.5 py-2 text-[12.5px]" : "text-[13.5px] leading-snug"}
      style={from === "you" ? { background: "rgba(255,255,255,0.09)", color: C.text } : { color: C.text }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {children}
    </motion.p>
  );
}

// ─── 1. Start by talking ──────────────────────────────────────────────────────

export function TalkScreen() {
  return (
    <Screen>
      <p className="text-center font-bold text-[15px] mb-1" style={{ color: C.text }}>
        Kairo
      </p>
      <p className="text-center text-[11px] mb-4" style={{ color: C.purple }}>
        Listening
      </p>
      <GuideOrb color={C.purple} second="#3B82F6" />
      <div className="mt-5 space-y-2.5">
        <Bubble from="guide" delay={0.3}>
          Before anything else: who do you want to become?
        </Bubble>
        <Bubble from="you" delay={1.2}>
          Someone who gets back in the gym. I keep stopping.
        </Bubble>
        <Bubble from="guide" delay={2.2}>
          Then let&apos;s work out what keeps stopping you.
        </Bubble>
      </div>
      <div className="mt-auto mb-5 flex justify-center">
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: C.purple }}>
          <Mic size={20} color="#05070F" />
        </span>
      </div>
    </Screen>
  );
}

// ─── 2. It gets to know you ───────────────────────────────────────────────────

const WHY = [
  { text: "Get back in the gym", note: "What you said" },
  { text: "Feel strong in my body again", note: "Why that matters" },
  { text: "Have energy for my kids after work", note: "And why that matters" },
  { text: "Be the parent who joins in, not the one watching", note: "Your motivation" },
];

export function KnowYouScreen() {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.purple }}>
        Kairo · Getting to know you
      </p>
      <p className="font-extrabold text-[22px] leading-[1.15] tracking-[-0.03em] mb-1" style={{ color: C.text }}>
        Finding your why.
      </p>
      <p className="text-[12px] mb-4" style={{ color: C.muted }}>
        It keeps asking until it understands what really drives you.
      </p>
      <div className="relative">
        {WHY.map((w, i) => {
          const last = i === WHY.length - 1;
          return (
            <motion.div
              key={w.text}
              className="relative pl-6 pb-3.5"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.6, duration: 0.5, ease: EASE }}
            >
              {!last ? <span className="absolute left-[7px] top-4 bottom-0 w-px" style={{ background: `${C.purple}55` }} /> : null}
              <span
                className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full"
                style={{ background: last ? C.purple : C.surface, border: `2px solid ${C.purple}` }}
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: last ? C.purple : C.faint }}>
                {w.note}
              </p>
              <p className={last ? "font-bold text-[16px] leading-snug" : "text-[13.5px]"} style={{ color: last ? C.text : C.muted }}>
                {w.text}
              </p>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        className="mt-2 rounded-2xl p-3 flex items-center gap-2.5"
        style={{ background: `${C.purple}1A`, border: `1px solid ${C.purple}40` }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.9, type: "spring", bounce: 0.35 }}
      >
        <Sparkles size={15} color={C.purple} />
        <p className="text-[12px] font-semibold" style={{ color: C.text }}>
          Your guides will remember this.
        </p>
      </motion.div>
    </Screen>
  );
}

// ─── 3. A habit that stretches you, and fits ─────────────────────────────────

export function ShapeHabitScreen() {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.green }}>
        Althea · Your first habit
      </p>
      <div className="space-y-2.5">
        <Bubble from="you" delay={0.2}>
          Five mornings a week. Let&apos;s go.
        </Bubble>
        <Bubble from="guide" delay={1}>
          Five is the trap. You&apos;ve stopped at five before. Three you&apos;ll keep, then we grow it.
        </Bubble>
      </div>

      <motion.div
        className="mt-4 rounded-2xl p-3.5"
        style={{ background: C.surface, border: `1px solid ${C.green}44` }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, ease: EASE }}
      >
        <p className="font-bold text-[15px]" style={{ color: C.text }}>
          Gym, 3 mornings a week
        </p>
        <p className="text-[11.5px]" style={{ color: C.muted }}>
          After school drop-off · 30 min
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: C.amber }}>
          Bad day: 10 minutes still counts
        </p>
        <div className="mt-3 flex gap-2">
          {["Ease it", "Just right", "Push me"].map((o) => (
            <span
              key={o}
              className="flex-1 text-center rounded-full py-1.5 text-[11px] font-semibold"
              style={o === "Just right" ? { background: C.green, color: "#05070F" } : { background: "rgba(255,255,255,0.06)", color: C.muted }}
            >
              {o}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="mt-auto mb-6 flex flex-col items-center">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <motion.circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={C.green}
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 2.6, duration: 1.4, ease: "easeInOut" }}
            />
          </svg>
          <span className="absolute inset-2.5 rounded-full" style={{ background: `${C.green}30` }} />
        </div>
        <p className="mt-1.5 text-[11px] font-semibold" style={{ color: C.text }}>
          Hold to commit
        </p>
      </div>
    </Screen>
  );
}

// ─── 4. Keep talking ──────────────────────────────────────────────────────────

export function GuideScreen() {
  return (
    <Screen>
      <p className="text-center font-bold text-[15px] mb-1" style={{ color: C.text }}>
        Althea
      </p>
      <p className="text-center text-[11px] mb-4" style={{ color: C.green }}>
        Listening
      </p>
      <div className="mb-5">
        <GuideOrb color={C.green} second={C.teal} />
      </div>
      <div className="space-y-2.5">
        <Bubble from="you" delay={0.5}>
          Only slept five hours. I can&apos;t do the gym today.
        </Bubble>
        <Bubble from="guide" delay={1.5}>
          Then we don&apos;t do the gym. Ten-minute walk after lunch. It counts, and nothing resets.
        </Bubble>
        <motion.div
          className="rounded-2xl p-3 flex items-center gap-2.5"
          style={{ background: "rgba(0,196,122,0.1)", border: `1px solid ${C.green}33` }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.4, type: "spring", bounce: 0.35 }}
        >
          <Sparkles size={15} color={C.green} />
          <p className="text-[12px] font-semibold" style={{ color: C.text }}>
            Swapped today to a 10-minute walk
          </p>
        </motion.div>
      </div>
      <div className="mt-auto mb-5 flex justify-center">
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: C.green }}>
          <Mic size={20} color="#05070F" />
        </span>
      </div>
    </Screen>
  );
}

// ─── 5. See your growth ───────────────────────────────────────────────────────

const WEEKS_SHOWN = [2, 3, 2, 3, 3, 3, 4, 3, 4];

export function GrowthScreen() {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.teal }}>
        Week 9
      </p>
      <p className="font-extrabold text-[22px] leading-[1.15] tracking-[-0.03em]" style={{ color: C.text }}>
        You&apos;re someone who trains.
      </p>
      <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
        27 sessions. Grew from 3 mornings to 4.
      </p>

      <div className="mt-4 rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-[11px] mb-2" style={{ color: C.muted }}>
          Mornings each week
        </p>
        <div className="flex items-end gap-1.5 h-20">
          {WEEKS_SHOWN.map((n, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-md origin-bottom"
              style={{ height: `${(n / 4) * 100}%`, background: n >= 4 ? C.green : `${C.teal}AA` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.2 + i * 0.09, duration: 0.45, ease: EASE }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-[11px]" style={{ color: C.muted }}>
          How automatic it feels
        </p>
        <svg viewBox="0 0 180 60" className="w-full mt-1">
          <motion.path
            d="M0 56 C30 54 50 46 75 34 S130 12 180 8"
            fill="none"
            stroke={C.teal}
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.9, duration: 1.6, ease: "easeInOut" }}
          />
        </svg>
      </div>

      <motion.div
        className="mt-3 self-start rounded-full px-3 py-1.5 text-[11px] font-semibold"
        style={{ background: "rgba(0,196,122,0.12)", color: C.green }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.4, type: "spring", bounce: 0.4 }}
      >
        Missed week 3 twice. Nothing reset.
      </motion.div>
    </Screen>
  );
}

// ─── 6. With people: rooms, topics, places near you ──────────────────────────

const VIEWS = ["Room", "Topics", "Near you"] as const;

export function CommunityScreen() {
  const [view, setView] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setView((v) => (v + 1) % VIEWS.length), 3200);
    return () => window.clearInterval(t);
  }, []);

  return (
    <Screen>
      <div className="flex rounded-full p-1 mb-4" style={{ background: "rgba(255,255,255,0.06)" }}>
        {VIEWS.map((v, i) => (
          <span key={v} className="relative flex-1 text-center py-1.5 text-[11px] font-semibold" style={{ color: i === view ? "#05070F" : C.muted }}>
            {i === view ? (
              <motion.span layoutId="community-view" className="absolute inset-0 rounded-full" style={{ background: C.teal }} transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />
            ) : null}
            <span className="relative">{v}</span>
          </span>
        ))}
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="absolute inset-0"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {view === 0 ? <RoomView /> : view === 1 ? <TopicsView /> : <NearbyView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Screen>
  );
}

function RoomView() {
  return (
    <div>
      <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: C.teal }}>
        This week&apos;s room
      </p>
      <p className="font-extrabold text-[17px] leading-[1.2] tracking-[-0.02em] mb-3" style={{ color: C.text }}>
        What did you stop doing that made life better?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SAMPLE_PEOPLE.slice(0, 4).map((p, i) => (
          <motion.div
            key={p.name}
            className="relative rounded-2xl h-[118px] overflow-hidden"
            initial={{ filter: "blur(8px)" }}
            animate={{ filter: "blur(0px)" }}
            transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}
          >
            <img src={samplePhoto(p.photo, 260, 320)} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,7,15,0.85), transparent 55%)" }} />
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: "rgba(0,0,0,0.45)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.red }} />
              {[4, 6, 3, 7][i]}:0{i}
            </span>
            <span className="absolute bottom-2 left-2 text-[11px] font-semibold text-white">{p.name}</span>
            <motion.span className="absolute top-2 right-2" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.4 + i * 0.15 }}>
              <Lock size={12} color="#fff" />
            </motion.span>
          </motion.div>
        ))}
      </div>
      <p className="mt-2 text-[10px]" style={{ color: C.faint }}>
        You spoke first, so you can listen.
      </p>
    </div>
  );
}

const TOPICS = [
  { name: "Sleep that actually rests", people: [5, 7, 9] },
  { name: "Strong after 40", people: [6, 10, 13] },
  { name: "New parents", people: [1, 2, 11] },
  { name: "Running, slowly", people: [8, 4, 12] },
];

function TopicsView() {
  return (
    <div className="space-y-2">
      {TOPICS.map((t, i) => (
        <motion.div
          key={t.name}
          className="rounded-2xl p-3 flex items-center gap-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.1, ease: EASE }}
        >
          <div className="flex -space-x-2.5 shrink-0">
            {t.people.map((p) => (
              <img key={p} src={samplePhoto(SAMPLE_PEOPLE[p].photo, 80, 80)} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: `2px solid ${C.surface}` }} />
            ))}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[12.5px] leading-tight" style={{ color: C.text }}>
              {t.name}
            </p>
            <p className="text-[10.5px]" style={{ color: C.faint }}>
              New question every week
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const NEARBY_IDS = ["214", "black-swan", "oak-cliff", "klyde"];

function NearbyView() {
  const places = NEARBY_IDS.map((id) => MAP_PLACES.find((p) => p.id === id)).filter((p) => p !== undefined);

  return (
    <div>
      <div className="relative h-24 rounded-2xl overflow-hidden mb-2" style={{ background: "linear-gradient(160deg, #0F1A2E, #0A1120)" }}>
        <svg viewBox="0 0 260 96" className="absolute inset-0 w-full h-full" aria-hidden>
          <path d="M-10 70 C40 60 80 80 130 50 S220 30 270 40" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
          <path d="M60 -10 C70 30 50 60 80 110" stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none" />
        </svg>
        {places.map((p, i) => (
          <motion.span
            key={p.id}
            className="absolute w-3 h-3 rounded-full"
            style={{ left: `${18 + i * 20}%`, top: `${[30, 55, 38, 62][i]}%`, background: KIND_COLOR[p.kind], boxShadow: `0 0 12px ${KIND_COLOR[p.kind]}` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + i * 0.12, type: "spring", bounce: 0.5 }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {places.map((p, i) => (
          <motion.div
            key={p.id}
            className="rounded-xl px-3 py-2 flex items-center gap-2.5"
            style={{ background: C.surface }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1, ease: EASE }}
          >
            <MapPin size={13} color={KIND_COLOR[p.kind]} />
            <div className="min-w-0">
              <p className="font-semibold text-[12px] leading-tight truncate" style={{ color: C.text }}>
                {p.name}
              </p>
              <p className="text-[10px]" style={{ color: C.faint }}>
                {p.kind} · {p.note}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
