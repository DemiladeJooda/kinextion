"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useOpenChat } from "@/components/chat/chat-context";
import { useNavigate } from "@/components/navigation/navigation-context";
import { AURORA, EASE, ScrollStage } from "@/components/motion/primitives";
import { AuroraRibbons } from "@/components/aurora/AuroraRibbons";
import {
  CommunityScreen,
  GrowthScreen,
  GuideScreen,
  KnowYouScreen,
  PhoneFrame,
  ShapeHabitScreen,
  TalkScreen,
} from "@/components/showcase/PhoneScreens";

const LETTERS = "KINEXTION".split("");

const BECOMING = [
  "someone who gets quality sleep",
  "someone who moves every day",
  "a calmer parent",
  "stronger than last year",
  "the one who shows up",
  "someone who cooks at home",
  "kinder to yourself",
  "the friend who checks in",
  "someone who runs on Saturdays",
  "able to keep up with your kids",
  "someone who switches off at night",
  "calm under pressure",
  "someone who reads before bed",
  "present with the people you love",
  "someone who stretches every morning",
  "lighter on your feet",
  "someone who finishes what they start",
  "the healthiest you've been",
];

const BEATS = [
  { title: "Start by talking. Your guide gets to know you.", color: "#A855F7", Screen: TalkScreen },
  { title: "It asks for your why, then goes deeper.", color: "#A855F7", Screen: KnowYouScreen },
  { title: "Then you shape a habit that challenges you and helps you grow.", color: "#00C47A", Screen: ShapeHabitScreen },
  { title: "Keep talking. It adjusts with your journey.", color: "#00C47A", Screen: GuideScreen },
  { title: "See yourself grow.", color: "#0ABAB5", Screen: GrowthScreen },
  { title: "Then do it with people.", color: "#0ABAB5", Screen: CommunityScreen },
] as const;

/** One line at a time: it slides up and out, the next slides in, forever. */
function BecomingReel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % BECOMING.length), 2600);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative mt-1 h-[2.4em] w-[92vw] max-w-2xl overflow-hidden" style={{ fontSize: "clamp(1.15rem, 2.4vw, 1.75rem)" }}>
      <AnimatePresence initial={false}>
        <motion.p
          key={index}
          className="absolute inset-x-0 font-semibold"
          style={{ backgroundImage: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {BECOMING[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative">
      <Opening />

      <div id="journey">
        <ScrollStage length={BEATS.length + 1}>{(progress) => <Journey progress={progress} />}</ScrollStage>
      </div>

      <div className="flex justify-center px-6 pt-24 pb-28">
        <button
          onClick={() => navigate("problem")}
          className="group text-center cursor-pointer"
        >
          <span className="block text-sm text-white/55 mb-3">Why we built it</span>
          <span
            className="block font-semibold transition-transform duration-300 group-hover:-translate-y-1"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", backgroundImage: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            See what we couldn&apos;t ignore →
          </span>
        </button>
      </div>
    </section>
  );
}

function Opening() {
  const openChat = useOpenChat();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const scale = useTransform(smooth, [0, 1], [1, 1.5]);
  const opacity = useTransform(smooth, [0, 0.7], [1, 0]);
  const y = useTransform(smooth, [0, 1], [0, -90]);

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center overflow-hidden"
      style={{ minHeight: "calc(100vh - var(--nav-height, 56px))" }}
    >
      <AuroraRibbons />

      <motion.div className="relative z-10 flex flex-col items-center text-center px-4" style={{ scale, opacity, y }}>
        <h1 aria-label="Kinextion" className="flex items-end justify-center" style={{ letterSpacing: "-0.04em" }}>
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="font-extrabold text-white select-none"
              style={{ fontSize: "clamp(3.2rem, 13vw, 10rem)", lineHeight: 1 }}
              initial={{ opacity: 0, y: 44, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.05 + i * 0.045, duration: 0.7, ease: EASE }}
            >
              {char}
            </motion.span>
          ))}
        </h1>

        <motion.p
          className="mt-6 font-light text-white/85"
          style={{ fontSize: "clamp(1.15rem, 2.4vw, 1.75rem)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
        >
          Your system for becoming
        </motion.p>

        <BecomingReel />

        <motion.div
          className="mt-6 flex flex-col sm:flex-row items-center gap-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.6, ease: EASE }}
        >
          <motion.button
            onClick={() => openChat()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="h-13 px-8 py-3.5 rounded-full font-semibold text-[15px] cursor-pointer"
            style={{ background: "#FFFFFF", color: "#05070F" }}
          >
            Talk to a guide
          </motion.button>
          <button
            onClick={() => document.getElementById("journey")?.scrollIntoView({ behavior: "smooth" })}
            className="px-7 py-3.5 text-[15px] font-medium text-white/75 hover:text-white cursor-pointer"
          >
            See it work ↓
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Journey({ progress }: { readonly progress: MotionValue<number> }) {
  const [beat, setBeat] = useState(0);

  useMotionValueEvent(progress, "change", (v) => {
    const next = Math.min(BEATS.length - 1, Math.floor(v * BEATS.length));
    setBeat((b) => (b === next ? b : next));
  });

  const { Screen, color } = BEATS[beat];

  return (
    <div className="section-container h-full grid lg:grid-cols-2 items-center gap-4 py-4">
      <div className="relative order-1 h-[22vh] lg:h-auto flex items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={beat}
            className="font-semibold text-balance"
            style={{ fontSize: "clamp(1.9rem, 5vw, 4.4rem)", color: "#FFFFFF" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {BEATS[beat].title}
          </motion.h2>
        </AnimatePresence>

        <div className="hidden lg:flex absolute -bottom-20 left-0 gap-2" aria-hidden>
          {BEATS.map((b, i) => (
            <motion.span
              key={b.title}
              className="h-1 rounded-full"
              animate={{ width: i === beat ? 40 : 12, background: i === beat ? color : "rgba(255,255,255,0.2)" }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
      </div>

      <div className="order-2 flex flex-col items-center">
        <PhoneFrame glow={color}>
          <AnimatePresence>
            <Screen key={beat} />
          </AnimatePresence>
        </PhoneFrame>
        <p className="mt-2 text-[11px] text-white/40">Illustration of the app. Sample content, stock photos.</p>
      </div>
    </div>
  );
}
