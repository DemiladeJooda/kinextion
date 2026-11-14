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
import type { JourneyScenario } from "@/lib/journey-scenarios";

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

// ─── 1. Getting to know each other ───────────────────────────────────────────

interface StoryProps {
  readonly story: JourneyScenario;
}

function Listening({ color }: { readonly color: string }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-6" aria-hidden>
      {Array.from({ length: 21 }, (_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ height: "100%", background: color, transformOrigin: "center" }}
          animate={{ scaleY: [0.18, 0.3 + ((i * 37) % 70) / 100, 0.18] }}
          transition={{ duration: 0.7 + (i % 5) * 0.13, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function TalkScreen({ story }: StoryProps) {
  return (
    <Screen>
      <p className="text-center font-bold text-[15px] mb-1" style={{ color: C.text }}>
        Kairo
      </p>
      <p className="text-center text-[11px] mb-4" style={{ color: C.purple }}>
        Listening to you
      </p>
      <GuideOrb color={C.purple} second="#3B82F6" />
      <div className="mt-3">
        <Listening color={C.purple} />
      </div>
      <div className="mt-4 space-y-2.5">
        <Bubble from="guide" delay={0.3}>
          Hi, I&apos;m Kairo. No forms. Just tell me a bit about you.
        </Bubble>
        <Bubble from="you" delay={1.2}>
          {story.opener}
        </Bubble>
        <Bubble from="guide" delay={2.2}>
          {story.kairoReply}
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

// ─── 2. What truly motivates you ─────────────────────────────────────────────

const WHY_NOTES = ["What you said", "Why that matters", "And why that matters", "What truly drives you"];

export function KnowYouScreen({ story }: StoryProps) {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.purple }}>
        Kairo · Getting to know you
      </p>
      <p className="font-extrabold text-[22px] leading-[1.15] tracking-[-0.03em] mb-1" style={{ color: C.text }}>
        What truly drives you.
      </p>
      <p className="text-[12px] mb-4" style={{ color: C.muted }}>
        A few gentle questions, until you both see it.
      </p>
      <div className="relative">
        {story.why.map((text, i) => {
          const last = i === story.why.length - 1;
          return (
            <motion.div
              key={text}
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
                {WHY_NOTES[i]}
              </p>
              <p className={last ? "font-bold text-[16px] leading-snug" : "text-[13.5px]"} style={{ color: last ? C.text : C.muted }}>
                {text}
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

export function ShapeHabitScreen({ story }: StoryProps) {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.green }}>
        Althea · Your first habit
      </p>
      <motion.p
        className="mb-3 rounded-xl px-3 py-2 text-[11px] leading-snug"
        style={{ background: `${C.purple}14`, color: C.muted }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span style={{ color: C.purple }}>Your why · </span>
        {story.why[3]}
      </motion.p>
      <div className="space-y-2.5">
        <Bubble from="you" delay={0.5}>
          {story.ask}
        </Bubble>
        <Bubble from="guide" delay={1.3}>
          {story.counter}
        </Bubble>
      </div>

      <motion.div
        className="mt-4 rounded-2xl p-3.5"
        style={{ background: C.surface, border: `1px solid ${C.green}44` }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.1, ease: EASE }}
      >
        <p className="font-bold text-[15px]" style={{ color: C.text }}>
          {story.habit.title}
        </p>
        <p className="text-[11.5px]" style={{ color: C.muted }}>
          {story.habit.anchor}
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: C.amber }}>
          Bad day: {story.habit.badDay}
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

      <div className="mt-auto mb-5 flex flex-col items-center">
        <div className="relative w-14 h-14">
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
              transition={{ delay: 2.9, duration: 1.4, ease: "easeInOut" }}
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

// ─── 4. The relationship: it adjusts and coaches as you grow ─────────────────

export function GuideScreen({ story }: StoryProps) {
  return (
    <Screen>
      <p className="text-center font-bold text-[15px] mb-1" style={{ color: C.text }}>
        Althea
      </p>
      <p className="text-center text-[11px] mb-4" style={{ color: C.green }}>
        Week 3 · Listening to you
      </p>
      <div className="mb-5">
        <GuideOrb color={C.green} second={C.teal} />
      </div>
      <div className="space-y-2.5">
        <Bubble from="you" delay={0.5}>
          {story.hardDay}
        </Bubble>
        <Bubble from="guide" delay={1.5}>
          {story.adjust}
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
            {story.swapped}
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

export function GrowthScreen({ story }: StoryProps) {
  const top = Math.max(...story.weeks);
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.teal }}>
        Week 9
      </p>
      <p className="font-extrabold text-[22px] leading-[1.15] tracking-[-0.03em]" style={{ color: C.text }}>
        {story.identity}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: C.muted }}>
        {story.summary}
      </p>

      <div className="mt-4 rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-[11px] mb-2" style={{ color: C.muted }}>
          {story.unit}
        </p>
        <div className="flex items-end gap-1.5 h-20">
          {story.weeks.map((n, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-md origin-bottom"
              style={{ height: `${(n / top) * 100}%`, background: n >= top ? C.green : `${C.teal}AA` }}
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
        {story.forgiven}
      </motion.div>
    </Screen>
  );
}

// ─── 6. With people: rooms, topics, places near you ──────────────────────────

const VIEWS = ["Your pod", "More pods", "Near you"] as const;

export function CommunityScreen({ story }: StoryProps) {
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
            {view === 0 ? <RoomView story={story} /> : view === 1 ? <TopicsView /> : <NearbyView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </Screen>
  );
}

function RoomView({ story }: StoryProps) {
  return (
    <div>
      <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase" style={{ color: C.teal }}>
        Community pod
      </p>
      <p className="font-extrabold text-[19px] leading-[1.15] tracking-[-0.02em]" style={{ color: C.text }}>
        {story.pod}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.faint }}>
        This week&apos;s question
      </p>
      <p className="font-semibold text-[14px] leading-[1.25] mb-3" style={{ color: C.text }}>
        {story.question}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SAMPLE_PEOPLE.slice(0, 4).map((p, i) => (
          <motion.div
            key={p.name}
            className="relative rounded-2xl h-[98px] overflow-hidden"
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
              Community pod · new question weekly
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
