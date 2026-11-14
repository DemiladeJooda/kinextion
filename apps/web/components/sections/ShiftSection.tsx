"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
import { AURORA, Band, EASE, Heading, Reveal, inkFor } from "@/components/motion/primitives";
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
      <div className="section-container pt-16 sm:pt-24 pb-24 sm:pb-32">
        <Heading
          label="The solution"
          color="#00C47A"
          title="One app that brings it all together."
          muted="And two guides who actually know you."
        />
        <Reveal delay={0.1}>
          <p className="mt-6 mx-auto max-w-2xl text-center text-balance text-white/75" style={{ fontSize: "clamp(1.05rem, 1.7vw, 1.3rem)", lineHeight: 1.5 }}>
            Kinextion looks at your body, your mind, your habits and your people together, then tells you the one thing worth
            doing today. Here&apos;s how.
          </p>
        </Reveal>
      </div>

      <HowItHelps />

      <SignalExplorer />

      <EarlyAccess source="shift" />
    </section>
  );
}

// ─── What it actually does, in four plain steps ──────────────────────────────

const STEPS = [
  {
    title: "It gets to know you.",
    body: "You talk, it listens. Who you want to become, what your days really look like, and what has stopped you before.",
    color: "#7B2FBE",
  },
  {
    title: "It reads your whole day.",
    body: "What you tell it, what your wearables already know, and how your habits are going. Read together, so you don't have to.",
    color: "#087F7B",
  },
  {
    title: "It gives you one next step.",
    body: "Not seven notifications from seven apps. One thing that fits how you are today, from a guide who remembers yesterday.",
    color: "#00875A",
  },
  {
    title: "It stays with you.",
    body: "Miss a day and nothing resets. The plan bends, the guide keeps coaching, and your community pod keeps you company.",
    color: "#2563EB",
  },
];

const DAY = inkFor("dawn");

function HowItHelps() {
  return (
    <Band tone="dawn" lift>
      <div className="section-container py-24 sm:py-32 max-w-5xl">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.05}>
            <div
              className="grid sm:grid-cols-[5rem_1fr_1.1fr] gap-x-8 gap-y-2 items-baseline py-8 sm:py-10"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${DAY.line}` }}
            >
              <p className="font-semibold tabular-nums" style={{ fontSize: "clamp(1rem, 1.6vw, 1.25rem)", color: step.color }}>
                0{i + 1}
              </p>
              <h3 className="font-semibold text-balance" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", letterSpacing: "-0.03em", lineHeight: 1.1, color: DAY.strong }}>
                {step.title}
              </h3>
              <p className="text-balance" style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)", lineHeight: 1.55, color: DAY.body }}>
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Band>
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
    <div className="section-container pt-24 sm:pt-32 pb-16">
      <Heading title="What it can listen to." muted="Closer to the centre matters more." />
      <p className="mt-4 text-center text-[15px] text-white/60 max-w-xl mx-auto text-balance">
        Each circle is something Kinextion can read about you. Tap one to see what it does with it.
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
