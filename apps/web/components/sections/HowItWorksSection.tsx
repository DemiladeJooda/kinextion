"use client";

import { motion, useReducedMotion } from "motion/react";
import { useOpenChat, type GuideId } from "@/components/chat/chat-context";
import { EarlyAccess } from "@/components/marketing/EarlyAccess";
import { Band, EASE, Heading, Reveal, inkFor, type Tone } from "@/components/motion/primitives";

/**
 * Your guides, introduced the way you'd introduce two people: a presence, a
 * name, something they'd actually say, and when you'd go to them. No panels,
 * tabs or chips; each guide gets a room of their own colour.
 */
export function HowItWorksSection() {
  return (
    <section className="relative dark">
      <div className="section-container pt-16 sm:pt-24 pb-20 sm:pb-28">
        <Heading label="Your guides" color="#0ABAB5" title="Two guides." muted="Two different ways of knowing you." />
      </div>

      <GuideRoom id="altheo" />
      <GuideRoom id="kairo" flip />
      <Shared />
    </section>
  );
}

// ─── The two guides ───────────────────────────────────────────────────────────

interface Guide {
  readonly name: string;
  readonly tone: Tone;
  readonly color: string;
  readonly second: string;
  readonly role: string;
  readonly says: string;
  readonly manner: string;
  readonly comeFor: readonly string[];
  readonly attends: string;
}

const GUIDES: Record<GuideId, Guide> = {
  altheo: {
    name: "Althea",
    tone: "forest",
    color: "#00C47A",
    second: "#0ABAB5",
    role: "Your body and your plan",
    says: "Skip the heavy session. A ten-minute walk after lunch still counts.",
    manner: "Direct and warm. She gives you the next move.",
    comeFor: ["Deciding what to do today", "Adjusting when you're tired or hurt", "Making a habit small enough to keep"],
    attends: "Sleep and recovery, workouts, steps, injuries and limits, the equipment you have, and the days you can train.",
  },
  kairo: {
    name: "Kairo",
    tone: "dusk",
    color: "#A855F7",
    second: "#3B82F6",
    role: "Your head and your patterns",
    says: "Three days isn't a verdict. What got loud this week?",
    manner: "Patient and curious. Asks more than it tells.",
    comeFor: ["Working out why you keep stopping", "Talking through a hard week", "Noticing a pattern you can't see"],
    attends: "Mood check-ins, stress, journal entries, what keeps repeating, gratitude and reflection, and what matters to you.",
  },
};

/** The guide's presence: a slow, breathing light rather than a face or an icon. */
function Presence({ color, second }: { readonly color: string; readonly second: string }) {
  const reduced = useReducedMotion();
  const breathe = (scale: number[], duration: number, delay = 0) =>
    reduced ? {} : { animate: { scale }, transition: { duration, delay, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <div className="relative mx-auto aspect-square w-[min(72vw,420px)]" aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${color}55 0%, ${color}14 45%, transparent 70%)`, filter: "blur(18px)" }}
        {...breathe([1, 1.12, 1], 7)}
      />
      {[0.14, 0.24, 0.33].map((inset, i) => (
        <motion.span
          key={inset}
          className="absolute rounded-full"
          style={{ inset: `${inset * 100}%`, border: `1px solid ${color}${["33", "55", "77"][i]}` }}
          {...breathe([1, 1.05, 1], 5, i * 0.5)}
        />
      ))}
      <motion.span
        className="absolute rounded-full"
        style={{
          inset: "36%",
          background: `radial-gradient(circle at 34% 28%, #FFFFFF 0%, ${color} 38%, ${second} 100%)`,
          boxShadow: `0 0 90px ${color}AA, inset 0 -10px 30px rgba(0,0,0,0.25)`,
        }}
        {...breathe([1, 1.07, 1], 4)}
      />
    </div>
  );
}

function GuideRoom({ id, flip = false }: { readonly id: GuideId; readonly flip?: boolean }) {
  const openChat = useOpenChat();
  const guide = GUIDES[id];
  const ink = inkFor(guide.tone);

  return (
    <Band tone={guide.tone}>
      <div className="section-container py-28 sm:py-44 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <Reveal className={flip ? "lg:order-2" : undefined}>
          <Presence color={guide.color} second={guide.second} />
        </Reveal>

        <Reveal delay={0.1} className={flip ? "lg:order-1" : undefined}>
          <p className="text-sm font-medium" style={{ color: guide.color }}>
            {guide.role}
          </p>
          <h3 className="mt-1 font-medium" style={{ fontSize: "clamp(3.6rem, 9vw, 7.5rem)", letterSpacing: "-0.05em", lineHeight: 0.95, color: ink.strong }}>
            {guide.name}
          </h3>

          <p className="mt-8 font-medium text-balance" style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.3rem)", letterSpacing: "-0.02em", lineHeight: 1.2, color: ink.strong }}>
            &ldquo;{guide.says}&rdquo;
          </p>
          <p className="mt-3 text-[15px]" style={{ color: ink.muted }}>
            {guide.manner}
          </p>

          <p className="mt-10 text-sm" style={{ color: ink.muted }}>
            Come to {guide.name} for
          </p>
          <ul className="mt-1">
            {guide.comeFor.map((line) => (
              <li key={line} className="py-3 text-lg sm:text-xl" style={{ color: ink.strong, borderBottom: `1px solid ${ink.line}` }}>
                {line}
              </li>
            ))}
          </ul>

          <button
            onClick={() => openChat(id)}
            className="group mt-8 inline-flex items-center gap-2 text-lg font-semibold cursor-pointer"
            style={{ color: guide.color }}
          >
            <span className="underline underline-offset-[6px] decoration-1">Talk to {guide.name}</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </Reveal>
      </div>
    </Band>
  );
}

// ─── What they share, and who to ask ─────────────────────────────────────────

const BOTH_KNOW = ["who you're becoming", "your why", "everything you've said", "your habits"];

const SITUATIONS: readonly { readonly text: string; readonly guide: GuideId }[] = [
  { text: "I don't know what to do today", guide: "altheo" },
  { text: "I keep skipping and feel bad about it", guide: "kairo" },
  { text: "My knee hurts when I squat", guide: "altheo" },
  { text: "I can't switch off at night", guide: "kairo" },
  { text: "I want to get stronger", guide: "altheo" },
  { text: "I'm not sure why this matters to me", guide: "kairo" },
];

const DEEP: Record<GuideId, string> = { altheo: "#00875A", kairo: "#7B2FBE" };
const WARM = inkFor("sand");

function Shared() {
  const openChat = useOpenChat();

  return (
    <Band tone="sand">
      <div className="section-container pt-24 sm:pt-32 pb-10 max-w-5xl">
        <Reveal>
          <p className="text-sm font-medium" style={{ color: "#087F7B" }}>
            One memory between them
          </p>
          <p className="mt-3 font-medium text-balance" style={{ fontSize: "clamp(1.8rem, 4vw, 3.4rem)", letterSpacing: "-0.03em", lineHeight: 1.12, color: WARM.strong }}>
            Both guides know{" "}
            {BOTH_KNOW.map((item, i) => (
              <span key={item}>
                <span style={{ color: "#087F7B" }}>{item}</span>
                {i < BOTH_KNOW.length - 2 ? ", " : i === BOTH_KNOW.length - 2 ? " and " : "."}
              </span>
            ))}{" "}
            <span style={{ color: WARM.faint }}>You never explain yourself twice.</span>
          </p>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 gap-10">
          {(Object.keys(GUIDES) as GuideId[]).map((id, i) => (
            <Reveal key={id} delay={i * 0.08}>
              <p className="text-sm font-semibold" style={{ color: DEEP[id] }}>
                {GUIDES[id].name} listens closest to
              </p>
              <p className="mt-2 text-lg leading-relaxed" style={{ color: WARM.body }}>
                {GUIDES[id].attends}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-20 sm:mt-28">
          <h3 className="font-semibold" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", letterSpacing: "-0.03em", color: WARM.strong }}>
            Not sure who to ask?
          </h3>
          <p className="mt-2" style={{ color: WARM.muted }}>
            Start with whatever&apos;s on your mind.
          </p>
        </Reveal>

        <ul className="mt-6">
          {SITUATIONS.map((s, i) => (
            <motion.li
              key={s.text}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }}
              style={{ borderTop: `1px solid ${WARM.line}` }}
            >
              <button onClick={() => openChat(s.guide)} className="group w-full flex items-baseline justify-between gap-6 py-5 text-left cursor-pointer">
                <span className="text-xl sm:text-2xl font-medium transition-transform duration-300 group-hover:translate-x-1.5" style={{ color: WARM.strong, letterSpacing: "-0.02em" }}>
                  &ldquo;{s.text}&rdquo;
                </span>
                <span className="shrink-0 text-sm sm:text-base font-semibold whitespace-nowrap" style={{ color: DEEP[s.guide] }}>
                  {GUIDES[s.guide].name} →
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>

      <EarlyAccess source="how-it-works" light />
    </Band>
  );
}
