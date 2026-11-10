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
      <ScrollStage length={4.2}>{(p) => <Overload progress={p} />}</ScrollStage>
      <ScrollStage length={3.4}>{(p) => <Restarts progress={p} />}</ScrollStage>

      <div className="flex justify-center px-6 py-28">
        <button onClick={() => navigate("shift")} className="cursor-pointer group text-center">
          <span className="block text-sm text-white/55 mb-3">The solution</span>
          <span
            className="block font-semibold transition-transform duration-300 group-hover:-translate-y-1"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", backgroundImage: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            See how it can work instead →
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
    <div className="section-container h-full grid lg:grid-cols-2 gap-6 lg:gap-8 items-center content-center">
      <div className="text-center lg:text-left">
        <h2 className="font-semibold text-white text-balance mb-1" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.9rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          63% of new gym members quit by day 90.
        </h2>
        <p className="text-white/60 text-balance mb-6" style={{ fontSize: "clamp(0.95rem, 1.5vw, 1.15rem)" }}>
          Not for lack of wanting it. Life gets in the way, and nothing adapts.
        </p>
        <p className="text-sm text-white/55 tabular-nums">Day {day} of a new gym membership</p>
        <p
          className="font-bold tabular-nums"
          style={{ fontSize: "clamp(3.6rem, 11vw, 9rem)", lineHeight: 1, letterSpacing: "-0.05em", color: "#FFFFFF" }}
        >
          {left}
        </p>
        <p className="text-lg text-white/70">of 100 still going</p>
        <p className="mt-5 text-xs text-white/40">Sperandei, Vieira &amp; Reis, 2016 · 5,240 gym members</p>
      </div>

      <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 max-w-[280px] sm:max-w-md mx-auto w-full">
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

// ─── Too many apps, too many things to do ────────────────────────────────────

/**
 * Talker Research for MDLIVE, 2,000 US adults who use health apps, 3–10 Dec
 * 2025: the average person uses six health apps regularly (22% use ten or
 * more), and 45% feel burnt out every week keeping up with them.
 * See docs/claims-and-sources.md.
 */
interface AppIcon {
  readonly name: string;
  readonly asks: string;
  readonly Icon: LucideIcon;
  readonly color: string;
  readonly badge: number;
  readonly wide: readonly [number, number];
  readonly narrow: readonly [number, number];
}

const APPS: readonly AppIcon[] = [
  { name: "Workout", asks: "Log today's workout", Icon: Activity, color: "#00C47A", badge: 2, wide: [-400, -120], narrow: [-92, -205] },
  { name: "Sleep", asks: "Rate last night's sleep", Icon: Moon, color: "#F59E0B", badge: 1, wide: [-140, -175], narrow: [92, -205] },
  { name: "Food", asks: "Log your lunch", Icon: Apple, color: "#A855F7", badge: 3, wide: [140, -175], narrow: [-92, -80] },
  { name: "Running", asks: "Tempo run, 6:30 am", Icon: Footprints, color: "#3B82F6", badge: 1, wide: [400, -120], narrow: [92, -80] },
  { name: "Meditate", asks: "Streak ends tonight", Icon: Brain, color: "#0ABAB5", badge: 4, wide: [-300, 105], narrow: [-92, 45] },
  { name: "Journal", asks: "6 days since you wrote", Icon: BookOpen, color: "#EC4899", badge: 6, wide: [0, 140], narrow: [92, 45] },
  { name: "Heart", asks: "Stress is high. Breathe.", Icon: HeartPulse, color: "#EF4444", badge: 2, wide: [300, 105], narrow: [0, 170] },
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

function Overload({ progress }: { readonly progress: MotionValue<number> }) {
  const narrow = useIsNarrow();
  const first = useTransform(progress, [0, 0.05, 0.22, 0.27], [0, 1, 1, 0]);
  const second = useTransform(progress, [0.27, 0.32, 0.56, 0.61], [0, 1, 1, 0]);
  const third = useTransform(progress, [0.8, 0.88], [0, 1]);
  const coreScale = useTransform(progress, [0.66, 0.86], [0, 1]);
  const sourceOpacity = useTransform(progress, [0, 0.05, 0.6, 0.66], [0, 1, 1, 0]);

  const lines = [
    { title: "Too many apps.", sub: "The average person uses six for their health. One in five has ten or more.", opacity: first },
    { title: "Each one wants something from you.", sub: "45% feel burnt out every week just keeping up with them.", opacity: second },
    { title: "You were never the problem.", sub: "Juggling all of it was.", opacity: third },
  ];

  return (
    <div className="relative h-full flex items-center justify-center overflow-hidden">
      {lines.map((l) => (
        <motion.div key={l.title} className="absolute top-[5%] inset-x-0 px-6 text-center" style={{ opacity: l.opacity }}>
          <p className="font-semibold text-white text-balance" style={{ fontSize: "clamp(1.8rem, 4.4vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.08 }}>
            {l.title}
          </p>
          <p className="mt-2 text-white/65 text-balance mx-auto max-w-xl" style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.2rem)" }}>
            {l.sub}
          </p>
        </motion.div>
      ))}

      <div className="relative w-[1px] h-[1px] top-[9%]">
        {APPS.map((a, i) => (
          <OverloadApp key={a.name} app={a} index={i} narrow={narrow} progress={progress} />
        ))}

        <motion.span
          className="absolute -left-16 -top-16 w-32 h-32 rounded-[2.2rem] flex items-center justify-center font-extrabold text-6xl text-white"
          style={{ background: "linear-gradient(135deg, #00C47A, #0ABAB5 60%, #A855F7)", scale: coreScale, boxShadow: "0 0 90px rgba(10,186,181,0.5)" }}
        >
          K
        </motion.span>
      </div>

      <motion.p className="absolute bottom-3 inset-x-0 px-6 text-center text-[11px] text-white/40" style={{ opacity: sourceOpacity }}>
        Talker Research for MDLIVE, December 2025 · 2,000 US adults who use health apps
      </motion.p>
    </div>
  );
}

function OverloadApp({
  app,
  index,
  narrow,
  progress,
}: {
  readonly app: AppIcon;
  readonly index: number;
  readonly narrow: boolean;
  readonly progress: MotionValue<number>;
}) {
  const [x, y] = narrow ? app.narrow : app.wide;
  const size = narrow ? 54 : 78;
  const appear = 0.02 + index * 0.025;
  const asks = 0.3 + index * 0.035;

  const tx = useTransform(progress, [0.6, 0.84], [x, 0]);
  const ty = useTransform(progress, [0.6, 0.84], [y, 0]);
  const scale = useTransform(progress, [appear, appear + 0.05, 0.6, 0.84], [0.4, 1, 1, 0.35]);
  const opacity = useTransform(progress, [appear, appear + 0.04, 0.78, 0.86], [0, 1, 1, 0]);
  const askOpacity = useTransform(progress, [asks, asks + 0.04, 0.58, 0.62], [0, 1, 1, 0]);
  const askY = useTransform(progress, [asks, asks + 0.04], [8, 0]);
  const badgeScale = useTransform(progress, [asks, asks + 0.03], [0, 1]);
  const Icon = app.Icon;

  return (
    <motion.div className="absolute flex flex-col items-center" style={{ width: 170, left: -85, top: -size / 2, x: tx, y: ty, opacity, scale }}>
      <div className="relative">
        <span
          className="flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.27,
            background: `linear-gradient(150deg, ${app.color} 0%, ${app.color}AA 55%, ${app.color}66 100%)`,
            boxShadow: `0 14px 40px ${app.color}40, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          <Icon size={size * 0.46} color="#FFFFFF" strokeWidth={2.2} />
        </span>
        <motion.span
          className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
          style={{ background: "#EF4444", scale: badgeScale, boxShadow: "0 0 0 2px #05081A" }}
        >
          {app.badge}
        </motion.span>
      </div>
      <span className="mt-1.5 text-[11px] sm:text-[12px] font-medium text-white/80">{app.name}</span>
      <motion.span
        className="mt-1.5 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-[12.5px] font-semibold text-white text-center leading-snug"
        style={{ opacity: askOpacity, y: askY, background: "rgba(14,21,36,0.94)", border: `1px solid ${app.color}55`, maxWidth: narrow ? 150 : 170 }}
      >
        {app.asks}
      </motion.span>
    </motion.div>
  );
}

// ─── Every restart begins at week one ─────────────────────────────────────────

/**
 * Laughing Cow poll of 2,000 UK adults (January 2018): the average person
 * starts three diets a year, and 55% say they "always" fail. A commercial poll,
 * so it's labelled as one. See docs/claims-and-sources.md.
 */
type Point = readonly [x: number, y: number, state: string];

const FLOOR = 300;

function attempt(x0: number, peak: number): Point[] {
  return [
    [x0, FLOOR, "Fresh start"],
    [x0 + 70, FLOOR - peak * 0.42, "Going well"],
    [x0 + 165, FLOOR - peak, "Going well"],
    [x0 + 210, FLOOR - peak * 0.9, "Life happens"],
    [x0 + 232, FLOOR, "Dropped off"],
    [x0 + 268, FLOOR, "Back to week one"],
  ];
}

const STARTS = [30, 330, 630];
const POINTS: readonly Point[] = [...attempt(STARTS[0], 170), ...attempt(STARTS[1], 215), ...attempt(STARTS[2], 150)];
const TRACE = POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

function Restarts({ progress }: { readonly progress: MotionValue<number> }) {
  const inputs = useMemo(() => POINTS.map((_, i) => (i / (POINTS.length - 1)) * 0.94), []);
  const x = useTransform(progress, inputs, POINTS.map((p) => p[0]));
  const y = useTransform(progress, inputs, POINTS.map((p) => p[1]));
  const pathLength = useTransform(progress, [0, 0.94], [0, 1]);

  const [state, setState] = useState(POINTS[0][2]);
  const [round, setRound] = useState(1);

  useMotionValueEvent(progress, "change", (v) => {
    const index = Math.min(POINTS.length - 1, Math.round((v / 0.94) * (POINTS.length - 1)));
    setState(POINTS[index][2]);
    setRound(Math.min(3, Math.floor(index / 6) + 1));
  });

  const down = state === "Dropped off" || state === "Back to week one";

  return (
    <div className="section-container h-full flex flex-col justify-center">
      <h2 className="text-center font-semibold text-white text-balance" style={{ fontSize: "clamp(1.8rem, 4.4vw, 3.6rem)", letterSpacing: "-0.03em" }}>
        Every restart begins at week one. <span className="text-white/40">Nothing remembers what worked last time.</span>
      </h2>

      <div className="mt-3 h-14 text-center">
        <p className="text-xs text-white/45 tabular-nums">Attempt {round}</p>
        <motion.p
          key={state}
          className="font-semibold"
          style={{ fontSize: "clamp(1.2rem, 2.6vw, 1.8rem)", color: down ? "#EF4444" : "#00C47A" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {state}
        </motion.p>
      </div>

      <svg viewBox="0 0 920 340" className="w-full max-w-5xl mx-auto" role="img" aria-label="Progress climbs, drops back to week one, and starts again, three times">
        <line x1="0" y1={FLOOR} x2="920" y2={FLOOR} stroke="rgba(255,255,255,0.14)" />
        {STARTS.map((sx, i) => (
          <WeekOne key={sx} x={sx} progress={progress} at={(i * 6) / (POINTS.length - 1) * 0.94} />
        ))}
        <motion.path d={TRACE} fill="none" stroke="#EF4444" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" style={{ pathLength }} />
        <motion.g style={{ x, y }}>
          <circle r="18" fill={down ? "#EF444433" : "#00C47A33"} />
          <circle r="8" fill="#FFFFFF" />
        </motion.g>
      </svg>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 text-center sm:text-left">
        <p className="font-bold text-white tabular-nums" style={{ fontSize: "clamp(3rem, 7vw, 5rem)", lineHeight: 1, letterSpacing: "-0.04em" }}>
          3×
        </p>
        <div>
          <p className="text-white/85 text-[15px] sm:text-lg max-w-md text-balance">
            a year, the average person starts a new diet. 55% say they always fail.
          </p>
          <p className="mt-1 text-[11px] text-white/40">Laughing Cow poll, 2018 · 2,000 UK adults</p>
        </div>
      </div>
    </div>
  );
}

function WeekOne({ x, at, progress }: { readonly x: number; readonly at: number; readonly progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [Math.max(0, at - 0.01), at + 0.03], [0, 1]);
  return (
    <motion.g style={{ opacity }}>
      <line x1={x} y1={FLOOR} x2={x} y2={FLOOR + 10} stroke="rgba(255,255,255,0.4)" />
      <text x={x} y={FLOOR + 34} textAnchor="start" fill="rgba(255,255,255,0.65)" fontSize="22" fontWeight="600">
        Week 1
      </text>
    </motion.g>
  );
}
