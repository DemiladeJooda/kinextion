"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useOpenChat, type GuideId } from "@/components/chat/chat-context";
import { EarlyAccess } from "@/components/marketing/EarlyAccess";
import { EASE, Heading, Reveal } from "@/components/motion/primitives";

export function HowItWorksSection() {
  return (
    <section className="relative dark">
      <div className="section-container pt-16 sm:pt-24 pb-10">
        <Heading label="Your guides" color="#0ABAB5" title="Two guides." muted="Two different ways of knowing you." />
      </div>

      <TwoLenses />

      <EarlyAccess source="how-it-works" />
    </section>
  );
}

// ─── Two guides ───────────────────────────────────────────────────────────────

type Focus = GuideId | "both";

const CONTEXT: readonly { readonly label: string; readonly focus: Focus }[] = [
  { label: "Who you're becoming", focus: "both" },
  { label: "Your why", focus: "both" },
  { label: "Everything you've said", focus: "both" },
  { label: "Your habits", focus: "both" },
  { label: "Sleep & recovery", focus: "altheo" },
  { label: "Workouts", focus: "altheo" },
  { label: "Steps", focus: "altheo" },
  { label: "Injuries & limits", focus: "altheo" },
  { label: "Equipment you have", focus: "altheo" },
  { label: "Days you can train", focus: "altheo" },
  { label: "Mood check-ins", focus: "kairo" },
  { label: "Stress", focus: "kairo" },
  { label: "Journal entries", focus: "kairo" },
  { label: "What keeps repeating", focus: "kairo" },
  { label: "Gratitude & reflection", focus: "kairo" },
  { label: "What matters to you", focus: "kairo" },
];

const LENS = {
  altheo: {
    name: "Althea",
    color: "#00C47A",
    role: "Your body and your plan",
    question: "What can today hold?",
    style: "Direct. Gives you the next move.",
    bestFor: ["Deciding what to do today", "Adjusting when you're tired or hurt", "Making a habit small enough to keep"],
    sounds: "Skip the heavy session. Ten-minute walk after lunch still counts.",
  },
  kairo: {
    name: "Kairo",
    color: "#A855F7",
    role: "Your head and your patterns",
    question: "What's underneath this?",
    style: "Patient. Asks more than it tells.",
    bestFor: ["Working out why you keep stopping", "Talking through a hard week", "Noticing a pattern you can't see"],
    sounds: "Three days isn't a verdict. What got loud this week?",
  },
} as const;

const SITUATIONS: readonly { readonly text: string; readonly guide: GuideId }[] = [
  { text: "I don't know what to do today", guide: "altheo" },
  { text: "I keep skipping and feel bad about it", guide: "kairo" },
  { text: "My knee hurts when I squat", guide: "altheo" },
  { text: "I can't switch off at night", guide: "kairo" },
  { text: "I want to get stronger", guide: "altheo" },
  { text: "I'm not sure why this matters to me", guide: "kairo" },
];

function TwoLenses() {
  const openChat = useOpenChat();
  const [active, setActive] = useState<GuideId>("altheo");
  const [situation, setSituation] = useState<string | null>(null);
  const lens = LENS[active];

  const ordered = useMemo(() => {
    const rank = (f: Focus) => (f === active ? 0 : f === "both" ? 1 : 2);
    return [...CONTEXT].sort((a, b) => rank(a.focus) - rank(b.focus));
  }, [active]);

  return (
    <div className="section-container pb-24 max-w-6xl">
      <Reveal>
        <p className="text-center text-sm text-white/55 mb-3">Switch between your two guides</p>
        <div
          role="tablist"
          aria-label="Choose a guide"
          className="relative mx-auto grid grid-cols-2 w-full max-w-2xl rounded-full p-1.5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {(Object.keys(LENS) as GuideId[]).map((id) => {
            const on = id === active;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(id);
                  setSituation(null);
                }}
                className="relative h-20 sm:h-24 rounded-full cursor-pointer flex items-center justify-center gap-3 px-3"
              >
                {on ? (
                  <motion.span
                    layoutId="guide-switch"
                    className="absolute inset-0 rounded-full"
                    style={{ background: LENS[id].color, boxShadow: `0 10px 50px ${LENS[id].color}66` }}
                    transition={{ type: "spring", bounce: 0.22, duration: 0.5 }}
                  />
                ) : null}
                <span
                  className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0"
                  style={{
                    background: on
                      ? "radial-gradient(circle at 35% 30%, #fff, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.15))"
                      : `radial-gradient(circle at 35% 30%, #fff, ${LENS[id].color} 45%, ${LENS[id].color}55)`,
                  }}
                />
                <span className="relative text-left min-w-0">
                  <span
                    className="block font-semibold leading-none"
                    style={{ fontSize: "clamp(1.5rem, 3.6vw, 2.4rem)", letterSpacing: "-0.03em", color: on ? "#05070F" : "#FFFFFF" }}
                  >
                    {LENS[id].name}
                  </span>
                  <span className="hidden sm:block mt-1 text-[13px]" style={{ color: on ? "rgba(5,7,15,0.7)" : "rgba(255,255,255,0.5)" }}>
                    {LENS[id].role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>

      <motion.div
        className="mt-8 rounded-[2rem] p-6 sm:p-10 grid lg:grid-cols-[1.15fr_1fr] gap-10"
        animate={{ background: `linear-gradient(150deg, ${lens.color}22 0%, rgba(255,255,255,0.025) 65%)`, borderColor: `${lens.color}44` }}
        transition={{ duration: 0.5 }}
        style={{ border: "1px solid" }}
      >
        <div>
          <p className="text-sm text-white/60 mb-4">What {lens.name} pays most attention to</p>
          <div className="flex flex-wrap gap-2">
            {ordered.map((c) => {
              const lit = c.focus === active;
              const shared = c.focus === "both";
              return (
                <motion.span
                  key={c.label}
                  layout
                  transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
                  className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                  style={{
                    background: lit ? lens.color : shared ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                    color: lit ? "#05070F" : shared ? "#FFFFFF" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {c.label}
                </motion.span>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[12px] text-white/55">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: lens.color }} /> {lens.name}&apos;s focus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white/30" /> They share these
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <p className="text-sm" style={{ color: lens.color }}>
              {lens.role}
            </p>
            <p className="mt-1 font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              &ldquo;{lens.question}&rdquo;
            </p>
            <p className="mt-2 text-white/70">{lens.style}</p>

            <p className="mt-6 text-sm text-white/60">Go to {lens.name} for</p>
            <ul className="mt-2 space-y-1.5">
              {lens.bestFor.map((b) => (
                <li key={b} className="text-white text-[15px] flex gap-2.5 items-start">
                  <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lens.color }} />
                  {b}
                </li>
              ))}
            </ul>

            <button onClick={() => openChat(active)} className="mt-6 px-6 h-11 rounded-full font-semibold text-sm cursor-pointer" style={{ background: lens.color, color: "#05070F" }}>
              Talk to {lens.name}
            </button>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Reveal className="mt-10 text-center">
        <p className="text-white font-medium text-lg">Not sure who to ask? Tap what&apos;s going on.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {SITUATIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => {
                setActive(s.guide);
                setSituation(s.text);
              }}
              aria-pressed={situation === s.text}
              className="px-4 py-2.5 rounded-full text-sm cursor-pointer transition-colors"
              style={{ background: situation === s.text ? LENS[s.guide].color : "rgba(255,255,255,0.06)", color: situation === s.text ? "#05070F" : "rgba(255,255,255,0.75)" }}
            >
              {s.text}
            </button>
          ))}
        </div>
        <p className="mt-4 h-6 text-sm" style={{ color: lens.color }}>
          {situation ? `Start with ${lens.name}. Both guides share what they know about you.` : " "}
        </p>
      </Reveal>
    </div>
  );
}
