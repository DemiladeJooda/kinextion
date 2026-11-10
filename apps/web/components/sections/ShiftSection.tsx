"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import {
  Activity,
  Bandage,
  Brain,
  CalendarDays,
  CircleDot,
  Compass,
  Droplets,
  Footprints,
  HeartPulse,
  History,
  MessageCircle,
  Moon,
  Plane,
  Salad,
  Smile,
  Sparkles,
  Sun,
  Thermometer,
  TrendingUp,
  Users,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { useOpenChat } from "@/components/chat/chat-context";
import { EarlyAccess } from "@/components/marketing/EarlyAccess";
import { AURORA, EASE, Heading } from "@/components/motion/primitives";
import {
  SIGNAL_TIERS,
  SIGNALS,
  categoryColor,
  signalsIn,
  sourceLabel,
  tier as tierOf,
  type SignalDef,
} from "@/lib/signal-taxonomy";

const ICONS: Record<string, LucideIcon> = {
  limits: Bandage,
  becoming: Compass,
  memory: History,
  conversations: MessageCircle,
  cycle: CircleDot,
  oura: Moon,
  whoop: HeartPulse,
  checkin: Smile,
  people: Users,
  watch: Watch,
  calendar: CalendarDays,
  temperature: Thermometer,
  momentum: TrendingUp,
  strava: Activity,
  steps: Footprints,
  "sleep-rhythm": Moon,
  mindful: Brain,
  nutrition: Salad,
  community: Users,
  away: Plane,
  hydration: Droplets,
  daylight: Sun,
};

const OUTER = SIGNAL_TIERS[SIGNAL_TIERS.length - 1];
const EXTENT = 2 * OUTER.radius + OUTER.orbSize + 24;

export function ShiftSection() {
  return (
    <section className="relative">
      <div className="section-container pt-14 sm:pt-20">
        <Heading
          label="The solution"
          color="#00C47A"
          title="One app that brings it all together."
          muted="Your body, your mind, your habits and your people, read as one."
        />
      </div>

      <SignalExplorer />

      <OneMorning />

      <EarlyAccess source="shift" />
    </section>
  );
}

function SignalExplorer() {
  const openChat = useOpenChat();
  const [picked, setPicked] = useState<SignalDef>(SIGNALS[0]);

  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1.15, entry.contentRect.width / EXTENT)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="section-container pt-4 sm:pt-8 pb-16">
      <p className="text-center text-sm text-white/55 max-w-xl mx-auto">
        Everything Kinextion reads about you. The closer to the centre, the more it shapes what your guide tells you.
      </p>

      <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-10 items-center">
        <div ref={frameRef} className="relative w-full max-w-[min(680px,84vh)] mx-auto aspect-square">
          <div
            className="absolute left-1/2 top-1/2"
            style={{ width: EXTENT, height: EXTENT, transform: `translate(-50%, -50%) scale(${scale})` }}
          >
            {SIGNAL_TIERS.map((t) => (
              <span
                key={t.id}
                className="absolute rounded-full"
                style={{
                  left: "50%",
                  top: "50%",
                  width: t.radius * 2,
                  height: t.radius * 2,
                  transform: "translate(-50%, -50%)",
                  border: `1px solid rgba(255,255,255,${0.04 + t.weight * 0.1})`,
                }}
              />
            ))}

            {SIGNAL_TIERS.flatMap((t) => {
              const list = signalsIn(t.id);
              return list.map((signal, i) => (
                <Orbiter
                  key={signal.id}
                  signal={signal}
                  radius={t.radius}
                  size={t.orbSize}
                  duration={t.speed}
                  delay={-(t.speed / list.length) * i}
                  lit
                  selected={picked.id === signal.id}
                  onPick={() => setPicked(signal)}
                />
              ));
            })}

            <button
              onClick={() => openChat()}
              aria-label="Talk to a guide"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer z-10"
              style={{ width: 92, height: 92 }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: AURORA }}
                animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 30px #0ABAB566", "0 0 80px #0ABAB5AA", "0 0 30px #0ABAB566"] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="relative flex flex-col items-center justify-center h-full text-[#05070F]">
                <Sparkles size={20} />
                <span className="text-[11px] font-bold mt-0.5">Talk</span>
              </span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <SignalCard key={picked.id} signal={picked} />
        </AnimatePresence>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-white/60">Tap any signal to see what it does.</p>
        <button
          onClick={() => document.getElementById("one-morning")?.scrollIntoView({ behavior: "smooth" })}
          className="mt-2 text-sm font-semibold cursor-pointer"
          style={{ color: "#00C47A" }}
        >
          See them come together ↓
        </button>
      </div>
    </div>
  );
}

function Orbiter({
  signal,
  radius,
  size,
  duration,
  delay,
  lit,
  selected,
  onPick,
}: {
  readonly signal: SignalDef;
  readonly radius: number;
  readonly size: number;
  readonly duration: number;
  readonly delay: number;
  readonly lit: boolean;
  readonly selected: boolean;
  readonly onPick: () => void;
}) {
  const Icon = ICONS[signal.id] ?? Sparkles;
  const color = categoryColor(signal.category);
  const next = signal.status === "next";

  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={
        {
          width: 0,
          height: 0,
          "--orbit-r": `${radius}px`,
          animation: `kinextion-orbit ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        } as React.CSSProperties
      }
    >
      <motion.button
        onClick={onPick}
        onHoverStart={onPick}
        aria-label={signal.label}
        className="absolute rounded-full flex items-center justify-center cursor-pointer"
        style={{
          width: size,
          height: size,
          left: -size / 2,
          top: -size / 2,
          background: selected ? color : next ? "#0B1120" : `${color}2B`,
          border: `1.5px ${next ? "dashed" : "solid"} ${color}${selected ? "" : "88"}`,
          boxShadow: selected ? `0 0 34px ${color}` : "none",
        }}
        animate={{ opacity: lit ? 1 : 0.12, scale: lit ? 1 : 0.8 }}
        whileHover={{ scale: 1.2 }}
        transition={{ duration: 0.3 }}
      >
        <Icon size={size * 0.42} color={selected ? "#05070F" : color} />
      </motion.button>
    </div>
  );
}

function SignalCard({ signal }: { readonly signal: SignalDef }) {
  const color = categoryColor(signal.category);

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      <p className="text-xs font-semibold" style={{ color }}>
        {tierOf(signal.tier).kicker}
      </p>
      <h3 className="mt-1 font-semibold text-white" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)" }}>
        {signal.label}
      </h3>
      <p className="mt-2 text-white/75 text-[15px] leading-relaxed">{signal.does}</p>

      <div className="mt-4 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.05)" }}>
        <p className="text-[11px] text-white/40">For example</p>
        <p className="text-sm text-white">{signal.example}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {signal.sources.map((s) => (
          <span key={s} className="px-2.5 py-1 rounded-full text-[11px] text-white/70" style={{ background: "rgba(255,255,255,0.07)" }}>
            {sourceLabel(s)}
          </span>
        ))}
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ color: signal.status === "live" ? "#00C47A" : "#F59E0B" }}>
          {signal.status === "live" ? "In the app" : "Coming next"}
        </span>
      </div>
    </motion.div>
  );
}

/** One morning: the inputs arrive by themselves, then the reply. No scrolling needed. */
const INPUTS = [
  { label: "Slept 5h 40m", from: "Oura", color: "#00C47A", y: 12 },
  { label: "Recovery 38%", from: "Whoop", color: "#00C47A", y: 31 },
  { label: "Stress up, 4th day", from: "Check-in", color: "#A855F7", y: 50 },
  { label: "Left knee", from: "She remembers", color: "#3B82F6", y: 69 },
  { label: "Evening walk, 18 of 21", from: "Your habits", color: "#EC4899", y: 88 },
];

const STEP_MS = 750;

function OneMorning() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || step > INPUTS.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 300 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [inView, step]);

  const done = step > INPUTS.length;

  return (
    <div id="one-morning" ref={ref} className="section-container mt-24 sm:mt-40 pt-16 sm:pt-24 pb-20 sm:pb-28 scroll-mt-16 border-t border-white/[0.06]">
      <Heading title="One morning." muted="Everything Althea weighed." />

      <div className="relative w-full max-w-5xl mx-auto mt-12" style={{ height: "min(56vh, 460px)" }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {INPUTS.map((inp, i) => (
            <motion.path
              key={inp.label}
              d={`M 34 ${inp.y} C 48 ${inp.y}, 50 50, 62 50`}
              fill="none"
              stroke={inp.color}
              vectorEffect="non-scaling-stroke"
              style={{ strokeWidth: 1.5 }}
              initial={false}
              animate={{ pathLength: step > i ? 1 : 0, opacity: step > i ? 1 : 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {INPUTS.map((inp, i) => (
          <motion.div
            key={inp.label}
            className="absolute left-0 -translate-y-1/2 w-[34%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3"
            style={{ top: `${inp.y}%`, background: `${inp.color}1C`, border: `1px solid ${inp.color}44` }}
            initial={false}
            animate={{ opacity: step > i ? 1 : 0, x: step > i ? 0 : -24 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <p className="text-[12px] sm:text-[15px] font-semibold text-white leading-tight">{inp.label}</p>
            <p className="text-[10px] sm:text-[11px] text-white/55">{inp.from}</p>
          </motion.div>
        ))}

        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[46%] sm:w-[38%] rounded-3xl p-4 sm:p-6"
          initial={false}
          animate={{ scale: done ? 1 : 0.92, background: done ? "rgba(0,196,122,0.14)" : "rgba(255,255,255,0.04)" }}
          style={{ border: "1px solid rgba(0,196,122,0.3)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "#00C47A" }}>
            Althea
          </p>
          <AnimatePresence mode="wait">
            {done ? (
              <motion.p
                key="reply"
                className="mt-1 font-semibold text-white"
                style={{ fontSize: "clamp(1.05rem, 2.5vw, 2rem)", lineHeight: 1.2 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                Skip the squats. Same walk, ten minutes. Bed by eleven.
              </motion.p>
            ) : (
              <motion.p key="wait" className="mt-1 text-white/50 text-sm" exit={{ opacity: 0 }}>
                Reading your day…
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-white/40">
        <span>Example member, sample readings</span>
        <button onClick={() => setStep(0)} className="font-semibold text-white/70 hover:text-white cursor-pointer">
          Play again
        </button>
      </div>
    </div>
  );
}
