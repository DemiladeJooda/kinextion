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
import { AURORA, EASE, ScrollStage, TONES, inkFor, type Tone } from "@/components/motion/primitives";
import { SCENARIOS, pickScenario, type JourneyScenario } from "@/lib/journey-scenarios";
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

/** A headline in pieces, so the words that matter can be lit. */
type Part = string | { readonly mark: string };

interface Beat {
  readonly title: readonly Part[];
  readonly sub?: string;
  /** The app's colour for this step, used for the phone's glow. */
  readonly color: string;
  /** The room this step happens in, and the colour its lit words take there. */
  readonly tone: Tone;
  readonly lit: string;
  readonly Screen: (props: { readonly story: JourneyScenario }) => React.JSX.Element;
}

const BEATS: readonly Beat[] = [
  {
    title: ["First, you and your guide ", { mark: "get to know each other" }, "."],
    color: "#A855F7",
    tone: "dusk",
    lit: "#C9A6FF",
    Screen: TalkScreen,
  },
  {
    title: ["Together, you discover what ", { mark: "truly motivates you" }, "."],
    color: "#A855F7",
    tone: "dusk",
    lit: "#C9A6FF",
    Screen: KnowYouScreen,
  },
  {
    title: ["Then you shape a ", { mark: "habit" }, " that challenges you and helps you ", { mark: "grow" }, "."],
    color: "#00C47A",
    tone: "dawn",
    lit: "#00875A",
    Screen: ShapeHabitScreen,
  },
  {
    title: ["Keep the ", { mark: "relationship" }, " going. Your guide ", { mark: "adjusts" }, " and ", { mark: "coaches you" }, " as you grow."],
    color: "#00C47A",
    tone: "dawn",
    lit: "#00875A",
    Screen: GuideScreen,
  },
  {
    title: ["See yourself ", { mark: "grow" }, "."],
    color: "#0ABAB5",
    tone: "sand",
    lit: "#087F7B",
    Screen: GrowthScreen,
  },
  {
    title: ["Then do it ", { mark: "with others" }, ", in your ", { mark: "community pod" }, "."],
    sub: "A community pod is a small group on the same path as you. One honest question a week, answered in your own voices.",
    color: "#0ABAB5",
    tone: "sand",
    lit: "#087F7B",
    Screen: CommunityScreen,
  },
];

const ROOMS = [...new Set(BEATS.map((b) => b.tone))];

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
        <ScrollStage length={BEATS.length + 1} tone={BEATS[0].tone}>{(progress) => <Journey progress={progress} />}</ScrollStage>
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
  const [story, setStory] = useState<JourneyScenario>(SCENARIOS[0]);

  // A different person's story each visit, the same one across all six screens.
  useEffect(() => setStory(SCENARIOS[pickScenario()]), []);

  useMotionValueEvent(progress, "change", (v) => {
    const next = Math.min(BEATS.length - 1, Math.floor(v * BEATS.length));
    setBeat((b) => (b === next ? b : next));
  });

  const { Screen, color, tone, lit, title, sub } = BEATS[beat];
  const ink = inkFor(tone);

  return (
    <div className="relative h-full">
      {ROOMS.map((room) => (
        <motion.div
          key={room}
          aria-hidden
          className="absolute inset-0"
          style={{ background: TONES[room].background }}
          initial={false}
          animate={{ opacity: room === tone ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      ))}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={false}
        animate={{ background: `radial-gradient(ellipse 45% 55% at 74% 50%, ${color}${TONES[tone].light ? "2E" : "38"} 0%, transparent 70%)` }}
        transition={{ duration: 0.8 }}
      />

      <div className="relative section-container h-full grid lg:grid-cols-2 items-center gap-4 py-4">
        <div className="relative order-1 h-[24vh] lg:h-auto flex items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={beat}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <h2 className="font-medium text-balance" style={{ fontSize: "clamp(1.8rem, 4.6vw, 4.2rem)", color: ink.strong }}>
                {title.map((part, i) =>
                  typeof part === "string" ? (
                    <span key={i}>{part}</span>
                  ) : (
                    <span key={i} className="font-bold" style={{ color: lit }}>
                      {part.mark}
                    </span>
                  ),
                )}
              </h2>
              {sub ? (
                <p className="mt-4 max-w-md text-balance" style={{ fontSize: "clamp(0.9rem, 1.4vw, 1.1rem)", color: ink.body }}>
                  {sub}
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="hidden lg:flex absolute -bottom-20 left-0 gap-2" aria-hidden>
            {BEATS.map((b, i) => (
              <motion.span
                key={i}
                className="h-1 rounded-full"
                animate={{ width: i === beat ? 40 : 12, background: i === beat ? lit : ink.line }}
                transition={{ duration: 0.4 }}
              />
            ))}
          </div>
        </div>

        <div className="order-2 flex flex-col items-center">
          <PhoneFrame glow={color}>
            <AnimatePresence>
              <Screen key={`${beat}-${story.id}`} story={story} />
            </AnimatePresence>
          </PhoneFrame>
          <p className="mt-2 text-[11px]" style={{ color: ink.faint }}>
            Illustration of the app. Sample content, stock photos.
          </p>
        </div>
      </div>
    </div>
  );
}
