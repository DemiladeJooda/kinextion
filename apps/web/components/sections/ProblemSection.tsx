"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { Activity, Apple, BookOpen, Brain, Footprints, HeartPulse, Moon, type LucideIcon } from "lucide-react";
import { useNavigate } from "@/components/navigation/navigation-context";
import { Band, EASE, Heading, Reveal, ScrollStage, inkFor } from "@/components/motion/primitives";

/**
 * Sperandei, Vieira & Reis (2016), J Sci Med Sport 19(11): 63% of new gym
 * members quit within 3 months. See docs/claims-and-sources.md.
 */
const STAY_OF_100 = 37;

/** Evenly spread, deterministic, so the same people stay on every render. */
const STAYING = new Set(Array.from({ length: STAY_OF_100 }, (_, i) => Math.floor((i * 100) / STAY_OF_100 + 1) % 100));

export function ProblemSection() {
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

      <ScrollStage length={3} tone="dawn">{(p) => <DropOff progress={p} />}</ScrollStage>
      <ScrollStage length={4.2} tone="ink">{(p) => <Overload progress={p} />}</ScrollStage>
      <FreshStarts />
    </section>
  );
}

const DAY = inkFor("dawn");

function DropOff({ progress }: { readonly progress: MotionValue<number> }) {
  const [day, setDay] = useState(0);
  useMotionValueEvent(progress, "change", (v) => setDay(Math.min(90, Math.round((v / 0.85) * 90))));

  const left = 100 - Math.round((Math.min(day, 90) / 90) * (100 - STAY_OF_100));

  return (
    <div className="section-container h-full grid lg:grid-cols-2 gap-6 lg:gap-8 items-center content-center">
      <div className="text-center lg:text-left">
        <h2 className="font-semibold text-balance mb-1" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.9rem)", letterSpacing: "-0.03em", lineHeight: 1.1, color: DAY.strong }}>
          63% of new gym members quit by day 90.
        </h2>
        <p className="text-balance mb-6" style={{ fontSize: "clamp(0.95rem, 1.5vw, 1.15rem)", color: DAY.body }}>
          Not for lack of wanting it. Life gets in the way, and nothing adapts.
        </p>
        <p className="text-sm tabular-nums" style={{ color: DAY.muted }}>Day {day} of a new gym membership</p>
        <p
          className="font-bold tabular-nums"
          style={{ fontSize: "clamp(3.6rem, 11vw, 9rem)", lineHeight: 1, letterSpacing: "-0.05em", color: DAY.strong }}
        >
          {left}
        </p>
        <p className="text-lg" style={{ color: DAY.body }}>of 100 still going</p>
        <p className="mt-5 text-xs" style={{ color: DAY.faint }}>Sperandei, Vieira &amp; Reis, 2016 · 5,240 gym members</p>
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
  const opacity = useTransform(progress, [leaveAt, leaveAt + 0.05], [1, stays ? 1 : 0.12]);
  const y = useTransform(progress, [leaveAt, leaveAt + 0.05], [0, stays ? 0 : 7]);
  const background = useTransform(progress, [0.7, 0.86], ["#1F2E29", stays ? "#00A368" : "#1F2E29"]);

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

/** A line in pieces, so the words that name the problem can be picked out in red. */
type Part = string | { readonly hot: string };
const HOT = "#FF6B6B";

function Lit({ parts }: { readonly parts: readonly Part[] }) {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} className="font-semibold" style={{ color: HOT }}>
            {part.hot}
          </span>
        ),
      )}
    </>
  );
}

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

  const lines: readonly { readonly title: readonly Part[]; readonly sub: readonly Part[]; readonly opacity: MotionValue<number> }[] = [
    {
      title: [{ hot: "Too many" }, " apps."],
      sub: ["The average person uses ", { hot: "six" }, " for their health. One in five has ", { hot: "ten or more" }, "."],
      opacity: first,
    },
    {
      title: ["Each one ", { hot: "wants something" }, " from you."],
      sub: [{ hot: "45% feel burnt out" }, " every week just ", { hot: "keeping up" }, " with them."],
      opacity: second,
    },
    { title: ["You were never the problem."], sub: [{ hot: "Juggling all of it" }, " was."], opacity: third },
  ];

  return (
    <div className="relative h-full flex items-center justify-center overflow-hidden">
      {lines.map((l, i) => (
        <motion.div key={i} className="absolute top-[5%] inset-x-0 px-6 text-center" style={{ opacity: l.opacity }}>
          <p className="font-semibold text-white text-balance" style={{ fontSize: "clamp(1.8rem, 4.4vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.08 }}>
            <Lit parts={l.title} />
          </p>
          <p className="mt-2 text-white/70 text-balance mx-auto max-w-xl" style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.2rem)" }}>
            <Lit parts={l.sub} />
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
          style={{ background: "#EF4444", scale: badgeScale, boxShadow: "0 0 0 2px #04050B" }}
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

// ─── Three fresh starts a year ───────────────────────────────────────────────

/**
 * Laughing Cow poll of 2,000 UK adults (January 2018): the average person
 * starts three diets a year, and 55% say they "always" fail. A commercial poll,
 * so it's labelled as one. See docs/claims-and-sources.md.
 *
 * The three bars are an illustration of that number, not data: each try starts
 * from the same line, runs a few weeks and stops.
 */
const TRIES = [
  { label: "First try", weeks: 5 },
  { label: "Second try", weeks: 7 },
  { label: "Third try", weeks: 4 },
];
const SPAN = 12;
const WARM = inkFor("sand");

function FreshStarts() {
  const navigate = useNavigate();

  return (
    <Band tone="sand">
      <div className="section-container py-24 sm:py-32 grid lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-20 items-center">
        <Reveal>
          <h2 className="font-semibold text-balance" style={{ fontSize: "clamp(2rem, 4.6vw, 3.8rem)", color: WARM.strong }}>
            Starting isn&apos;t the hard part. <span style={{ color: WARM.faint }}>Starting over is.</span>
          </h2>
          <div className="mt-8 flex items-center gap-5">
            <p className="font-bold tabular-nums" style={{ fontSize: "clamp(3.4rem, 7vw, 5.5rem)", lineHeight: 1, letterSpacing: "-0.04em", color: "#C2410C" }}>
              3×
            </p>
            <div>
              <p className="text-[15px] sm:text-lg max-w-sm text-balance" style={{ color: WARM.body }}>
                a year, the average person starts a new diet. 55% say they always fail.
              </p>
              <p className="mt-1 text-[11px]" style={{ color: WARM.faint }}>
                Laughing Cow poll, 2018 · 2,000 UK adults
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative pl-[5.5rem] sm:pl-28">
            <span className="absolute top-0 bottom-7 w-px left-[5.5rem] sm:left-28" style={{ background: WARM.strong }} />
            <p className="mb-3 ml-2.5 text-xs font-semibold" style={{ color: WARM.strong }}>
              Week 1
            </p>
            <div className="space-y-6">
              {TRIES.map((t, i) => (
                <div key={t.label} className="relative">
                  <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold" style={{ color: WARM.body }}>
                    {t.label}
                  </span>
                  <div className="relative h-10 rounded-r-full" style={{ background: "rgba(12,21,18,0.06)" }}>
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-r-full origin-left flex items-center justify-end pr-3"
                      style={{ width: `${(t.weeks / SPAN) * 100}%`, background: "linear-gradient(90deg, #E9B08D, #C2410C)" }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: 0.2 + i * 0.7, duration: 0.9, ease: EASE }}
                    />
                    <motion.span
                      className="absolute top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap text-[13px]"
                      style={{ left: `${(t.weeks / SPAN) * 100}%`, color: WARM.muted }}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: 1 + i * 0.7 }}
                    >
                      <span className="hidden sm:inline">stopped in </span>week {t.weeks}
                    </motion.span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px]" style={{ color: WARM.faint }}>
              Illustration
            </p>
          </div>
          <p className="mt-6 text-lg sm:text-xl font-medium text-balance" style={{ color: WARM.strong }}>
            Every try begins on the same line. <span style={{ color: WARM.muted }}>Nothing carries over what worked last time.</span>
          </p>
        </Reveal>
      </div>

      <div className="flex justify-center px-6 pt-10 pb-16 sm:pb-24">
        <button onClick={() => navigate("shift")} className="cursor-pointer group text-center">
          <span className="block text-sm mb-3" style={{ color: WARM.muted }}>
            The solution
          </span>
          <span
            className="block font-semibold transition-transform duration-300 group-hover:-translate-y-1"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 3rem)",
              backgroundImage: "linear-gradient(120deg, #00875A 0%, #087F7B 50%, #7B2FBE 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            See how it can work instead →
          </span>
        </button>
      </div>
    </Band>
  );
}
