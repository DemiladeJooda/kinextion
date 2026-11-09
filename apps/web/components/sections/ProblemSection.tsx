"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { Activity, Apple, BookOpen, Brain, Footprints, HeartPulse, Moon, type LucideIcon } from "lucide-react";
import { useNavigate } from "@/components/navigation/navigation-context";
import { AURORA, EASE, Heading, ScrollStage } from "@/components/motion/primitives";

/**
 * Sperandei, Vieira & Reis (2016), J Sci Med Sport 19(11): 63% of new gym
 * members quit within 3 months. See docs/claims-and-sources.md.
 */
const STAY_OF_100 = 37;

/** Evenly spread, deterministic, so the same people stay on every render. */
const STAYING = new Set(Array.from({ length: STAY_OF_100 }, (_, i) => Math.floor((i * 100) / STAY_OF_100 + 1) % 100));

export function ProblemSection() {
  const navigate = useNavigate();

  return (
    <section className="relative">
      <div
        className="section-container flex flex-col items-center justify-center"
        style={{ minHeight: "calc(92vh - var(--nav-height, 56px))" }}
      >
        <Heading
          label="The problem"
          color="#A855F7"
          title="Health and wellness is fragmented,"
          muted="but it doesn't have to be."
        />
      </div>

      <ScrollStage length={3}>{(p) => <DropOff progress={p} />}</ScrollStage>
      <ScrollStage length={3.6}>{(p) => <Scatter progress={p} />}</ScrollStage>
      <ScrollStage length={3.4}>{(p) => <FallingOff progress={p} />}</ScrollStage>

      <div className="flex justify-center px-6 py-28">
        <button onClick={() => navigate("shift")} className="cursor-pointer group text-center">
          <span
            className="block font-semibold transition-transform duration-300 group-hover:-translate-y-1"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", backgroundImage: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            So we built the other way →
          </span>
        </button>
      </div>
    </section>
  );
}

function DropOff({ progress }: { readonly progress: MotionValue<number> }) {
  const [day, setDay] = useState(0);
  useMotionValueEvent(progress, "change", (v) => setDay(Math.min(90, Math.round((v / 0.85) * 90))));

  const left = 100 - Math.round((Math.min(day, 90) / 90) * (100 - STAY_OF_100));

  return (
    <div className="section-container h-full grid lg:grid-cols-2 gap-8 items-center">
      <div className="text-center lg:text-left">
        <p className="text-sm text-white/55 tabular-nums">Day {day} of a new gym membership</p>
        <p
          className="font-bold tabular-nums"
          style={{ fontSize: "clamp(5rem, 15vw, 11rem)", lineHeight: 1, letterSpacing: "-0.05em", color: "#FFFFFF" }}
        >
          {left}
        </p>
        <p className="text-lg text-white/70">of 100 still going</p>
        <p className="mt-5 text-xs text-white/40">Sperandei, Vieira &amp; Reis, 2016 · 5,240 gym members</p>
      </div>

      <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 max-w-md mx-auto w-full">
        {Array.from({ length: 100 }, (_, i) => (
          <Person key={i} index={i} progress={progress} />
        ))}
      </div>
    </div>
  );
}

function Person({ index, progress }: { readonly index: number; readonly progress: MotionValue<number> }) {
  const stays = STAYING.has(index);
  const leaveAt = (((index * 61) % 100) / 100) * 0.8;
  const opacity = useTransform(progress, [leaveAt, leaveAt + 0.05], [1, stays ? 1 : 0.1]);
  const y = useTransform(progress, [leaveAt, leaveAt + 0.05], [0, stays ? 0 : 7]);
  const background = useTransform(progress, [0.7, 0.86], ["#CBD5E1", stays ? "#00C47A" : "#CBD5E1"]);

  return <motion.span className="aspect-square rounded-full" style={{ opacity, y, background }} />;
}

// ─── Too many apps ────────────────────────────────────────────────────────────

interface AppCard {
  readonly name: string;
  readonly says: string;
  readonly Icon: LucideIcon;
  readonly color: string;
  readonly wide: readonly [number, number];
  readonly narrow: readonly [number, number];
}

/** Each app is right by its own numbers. Together they're telling you opposite things. */
const APPS: readonly AppCard[] = [
  { name: "Workout app", says: "Push harder today.", Icon: Activity, color: "#00C47A", wide: [-400, -130], narrow: [-93, -190] },
  { name: "Sleep app", says: "You slept 5 hours. Rest.", Icon: Moon, color: "#F59E0B", wide: [-110, -190], narrow: [93, -190] },
  { name: "Food app", says: "You're 400 calories over.", Icon: Apple, color: "#A855F7", wide: [180, -190], narrow: [-93, -90] },
  { name: "Running app", says: "Eat more before your long run.", Icon: Footprints, color: "#3B82F6", wide: [430, -120], narrow: [93, -90] },
  { name: "Meditation app", says: "You lost your 12-day streak.", Icon: Brain, color: "#0ABAB5", wide: [-300, 120], narrow: [-93, 10] },
  { name: "Journal", says: "You haven't written in 6 days.", Icon: BookOpen, color: "#EC4899", wide: [0, 150], narrow: [93, 10] },
  { name: "Heart monitor", says: "Stress is high. Have you tried yoga?", Icon: HeartPulse, color: "#EF4444", wide: [300, 120], narrow: [0, 110] },
];

/** Which apps are contradicting each other. */
const CLASHES: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 3],
  [4, 6],
];

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return narrow;
}

function Scatter({ progress }: { readonly progress: MotionValue<number> }) {
  const narrow = useIsNarrow();
  const firstLine = useTransform(progress, [0, 0.06, 0.2, 0.26], [0, 1, 1, 0]);
  const secondLine = useTransform(progress, [0.26, 0.32, 0.56, 0.62], [0, 1, 1, 0]);
  const thirdLine = useTransform(progress, [0.76, 0.86], [0, 1]);
  const clashOpacity = useTransform(progress, [0.28, 0.36, 0.56, 0.62], [0, 1, 1, 0]);
  const coreScale = useTransform(progress, [0.66, 0.86], [0, 1]);

  const lines = [
    { text: "A different app for every part of you.", opacity: firstLine },
    { text: "Each one is right. Together, they make no sense.", opacity: secondLine },
    { text: "You're one person.", opacity: thirdLine },
  ];

  return (
    <div className="relative h-full flex items-center justify-center overflow-hidden">
      {lines.map((l) => (
        <motion.p
          key={l.text}
          className="absolute top-[7%] px-6 text-center font-semibold text-white text-balance"
          style={{ fontSize: "clamp(1.6rem, 4vw, 3.2rem)", opacity: l.opacity }}
        >
          {l.text}
        </motion.p>
      ))}

      <div className="relative w-[1px] h-[1px] top-[6%]">
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0 }} width="1" height="1" aria-hidden>
          {CLASHES.map(([a, b]) => {
            const [ax, ay] = narrow ? APPS[a].narrow : APPS[a].wide;
            const [bx, by] = narrow ? APPS[b].narrow : APPS[b].wide;
            return (
              <motion.line key={`${a}-${b}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="5 6" style={{ opacity: clashOpacity }} />
            );
          })}
        </svg>

        {APPS.map((a, i) => (
          <FloatingApp key={a.name} app={a} index={i} narrow={narrow} progress={progress} />
        ))}

        <motion.span
          className="absolute -left-16 -top-16 w-32 h-32 rounded-[2.2rem] flex items-center justify-center font-extrabold text-6xl text-white"
          style={{ background: "linear-gradient(135deg, #00C47A, #0ABAB5 60%, #A855F7)", scale: coreScale, boxShadow: "0 0 90px rgba(10,186,181,0.5)" }}
        >
          K
        </motion.span>
      </div>
    </div>
  );
}

function FloatingApp({
  app,
  index,
  narrow,
  progress,
}: {
  readonly app: AppCard;
  readonly index: number;
  readonly narrow: boolean;
  readonly progress: MotionValue<number>;
}) {
  const [x, y] = narrow ? app.narrow : app.wide;
  const width = narrow ? 172 : 230;
  const start = 0.01 + index * 0.025;
  const tx = useTransform(progress, [0.6, 0.84], [x, 0]);
  const ty = useTransform(progress, [0.6, 0.84], [y, 0]);
  const opacity = useTransform(progress, [start, start + 0.05, 0.78, 0.86], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0.6, 0.84], [1, 0.4]);
  const Icon = app.Icon;

  return (
    <motion.div
      className="absolute rounded-2xl p-3"
      style={{ width, left: -width / 2, top: -44, x: tx, y: ty, opacity, scale, background: "rgba(14,21,36,0.92)", border: `1px solid ${app.color}55` }}
    >
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${app.color}24` }}>
          <Icon size={15} color={app.color} />
        </span>
        <span className="text-[11px] text-white/55">{app.name}</span>
      </div>
      <p className="mt-2 text-[13px] sm:text-[15px] font-semibold text-white leading-snug">{app.says}</p>
    </motion.div>
  );
}

// ─── Starting over, and over ──────────────────────────────────────────────────

type Pose = readonly [x: number, y: number, rotate: number, state: string];

/** One attempt: starts at the floor, climbs, wobbles, falls, sits there. */
function attempt(x0: number, peak: number): Pose[] {
  const floor = 330;
  return [
    [x0, floor, 0, "Fresh start"],
    [x0 + 70, floor - peak * 0.42, 0, "Going well"],
    [x0 + 170, floor - peak, 0, "Going well"],
    [x0 + 205, floor - peak * 0.94, 8, "Life happens"],
    [x0 + 225, floor - peak * 0.9, 16, "Life happens"],
    [x0 + 232, floor, 95, "Dropped off"],
    [x0 + 262, floor, 95, "Guilt"],
  ];
}

const POSES: readonly Pose[] = [...attempt(30, 170), ...attempt(330, 215), ...attempt(630, 150)];
const TRACE = POSES.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

function FallingOff({ progress }: { readonly progress: MotionValue<number> }) {
  const inputs = useMemo(() => POSES.map((_, i) => (i / (POSES.length - 1)) * 0.94), []);
  const x = useTransform(progress, inputs, POSES.map((p) => p[0]));
  const y = useTransform(progress, inputs, POSES.map((p) => p[1]));
  const rotate = useTransform(progress, inputs, POSES.map((p) => p[2]));
  const pathLength = useTransform(progress, [0, 0.94], [0, 1]);
  const finalOpacity = useTransform(progress, [0.9, 0.98], [0, 1]);

  const [state, setState] = useState(POSES[0][3]);
  const [attemptNo, setAttemptNo] = useState(1);

  useMotionValueEvent(progress, "change", (v) => {
    const index = Math.min(POSES.length - 1, Math.round((v / 0.94) * (POSES.length - 1)));
    setState(POSES[index][3]);
    setAttemptNo(Math.min(3, Math.floor(index / 7) + 1));
  });

  return (
    <div className="section-container h-full flex flex-col justify-center">
      <h2 className="text-center font-semibold text-white text-balance" style={{ fontSize: "clamp(1.9rem, 4.6vw, 3.8rem)" }}>
        You don&apos;t fail once. <span className="text-white/40">You restart forever.</span>
      </h2>

      <div className="mt-4 h-16 text-center">
        <p className="text-xs text-white/45 tabular-nums">Attempt {attemptNo}</p>
        <motion.p
          key={state}
          className="font-semibold"
          style={{ fontSize: "clamp(1.3rem, 2.8vw, 2rem)", color: state === "Dropped off" || state === "Guilt" ? "#EF4444" : "#00C47A" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {state}
        </motion.p>
      </div>

      <svg viewBox="0 0 920 380" className="w-full max-w-5xl mx-auto mt-2" role="img" aria-label="A person climbs, falls and restarts three times">
        <line x1="0" y1="330" x2="920" y2="330" stroke="rgba(255,255,255,0.14)" />
        <motion.path d={TRACE} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ pathLength }} />

        <motion.g style={{ x, y, rotate }}>
          <circle cx="0" cy="-46" r="9" fill="#FFFFFF" />
          <line x1="0" y1="-37" x2="0" y2="-14" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <motion.g animate={{ rotate: [-24, 24, -24] }} transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} style={{ originX: "0px", originY: "-32px" }}>
            <line x1="0" y1="-32" x2="-9" y2="-18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          </motion.g>
          <motion.g animate={{ rotate: [24, -24, 24] }} transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} style={{ originX: "0px", originY: "-14px" }}>
            <line x1="0" y1="-14" x2="-8" y2="0" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
          <motion.g animate={{ rotate: [-24, 24, -24] }} transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} style={{ originX: "0px", originY: "-14px" }}>
            <line x1="0" y1="-14" x2="8" y2="0" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        </motion.g>

        <motion.text x="905" y="225" textAnchor="end" fill="#FFFFFF" fontSize="26" fontWeight="600" style={{ opacity: finalOpacity }}>
          Again.
        </motion.text>
      </svg>
    </div>
  );
}
