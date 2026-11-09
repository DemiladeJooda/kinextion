"use client";

/**
 * Netflix-style rows of voices, the same shape as Discover in the app.
 *
 * Shows real public responses when any exist. Until then it shows example
 * rows that say so, with no names and nothing that plays.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Lock, Play } from "lucide-react";
import type { DiscoverRow } from "@kinextion/shared";
import { EASE, Reveal } from "@/components/motion/primitives";

const CARD_TONES = [
  ["#00C47A", "#0E1524"],
  ["#A855F7", "#0E1524"],
  ["#0ABAB5", "#0E1524"],
  ["#F59E0B", "#0E1524"],
  ["#3B82F6", "#0E1524"],
  ["#EC4899", "#0E1524"],
] as const;

interface ExampleRow {
  readonly question: string;
  readonly community: string;
  readonly minutes: readonly number[];
}

const EXAMPLES: readonly ExampleRow[] = [
  { question: "What did you stop doing that made life better?", community: "A morning run club", minutes: [4, 7, 3, 6, 9, 5, 4, 8] },
  { question: "Who keeps you honest?", community: "New parents", minutes: [6, 3, 8, 5, 4, 7, 2, 6] },
  { question: "What are you pretending is fine?", community: "Night-shift nurses", minutes: [9, 5, 3, 7, 4, 6, 8, 3] },
  { question: "When did you last feel strong?", community: "Lifting after 40", minutes: [3, 6, 4, 8, 5, 7, 4, 9] },
  { question: "What does rest actually look like for you?", community: "First-time founders", minutes: [5, 8, 4, 3, 6, 9, 7, 4] },
];

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function VoiceRows() {
  const [rows, setRows] = useState<DiscoverRow[]>([]);

  useEffect(() => {
    const base = apiBase();
    if (!base) return;
    let cancelled = false;
    fetch(`${base}/api/discover?seed=site`)
      .then((r) => r.json())
      .then((payload: { success?: boolean; data?: { rows?: DiscoverRow[] } }) => {
        if (!cancelled && payload.success) setRows(payload.data?.rows ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-20 pb-16">
      <div className="section-container">
        <Reveal>
          <h2 className="font-semibold text-white text-balance" style={{ fontSize: "clamp(2rem, 4.6vw, 3.6rem)" }}>
            One question a week. <span className="text-white/45">In their own voices.</span>
          </h2>
        </Reveal>
      </div>

      <LockedRow />

      {rows.length > 0
        ? rows.map((row) => (
            <Row key={`${row.community.slug}-${row.topic.topicKey}-${row.weekKey}`} question={row.topic.text} community={row.community.name}>
              {row.responses.map((item, i) => (
                <Link key={item.id} href={`/discover/${item.id}`} className="block">
                  <VoiceCard index={i} minutes={Math.max(1, Math.round(item.durationSec / 60))} name={item.speaker.displayName ?? "A member"} />
                </Link>
              ))}
            </Row>
          ))
        : EXAMPLES.map((row) => (
            <Row key={row.question} question={row.question} community={row.community}>
              {row.minutes.map((m, i) => (
                <VoiceCard key={i} index={i + row.question.length} minutes={m} name="A member" />
              ))}
            </Row>
          ))}

      {rows.length === 0 ? (
        <p className="section-container mt-6 text-[11px] text-white/40">
          Examples of what rooms look like. Real responses appear here once people choose to share them.
        </p>
      ) : (
        <div className="section-container mt-6">
          <Link href="/discover" className="text-sm font-semibold underline underline-offset-4" style={{ color: "#0ABAB5" }}>
            See everything
          </Link>
        </div>
      )}
    </div>
  );
}

function LockedRow() {
  return (
    <section className="mt-10 section-container">
      <div className="rounded-[2rem] p-6 sm:p-8 relative overflow-hidden" style={{ background: "linear-gradient(120deg, #0ABAB522, rgba(255,255,255,0.03))", border: "1px solid #0ABAB544" }}>
        <p className="text-xs font-semibold" style={{ color: "#0ABAB5" }}>
          This week in your room
        </p>
        <h3 className="mt-1 text-white font-semibold" style={{ fontSize: "clamp(1.4rem, 3vw, 2.2rem)" }}>
          What did you need to hear this year?
        </h3>
        <div className="mt-5 flex gap-3 overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="relative shrink-0 w-44 h-28 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(145deg, ${CARD_TONES[i % 6][0]}55, #0E1524)`, filter: "blur(5px)" }} />
          ))}
          <div className="absolute inset-x-0 bottom-6 sm:bottom-9 flex justify-center">
            <span className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#05070F] bg-white">
              <Lock size={15} /> Speak first. Then you can listen.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  question,
  community,
  children,
}: {
  readonly question: string;
  readonly community: string;
  readonly children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nudge = (direction: number) =>
    scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="mt-10 group/row">
      <div className="section-container flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-lg sm:text-xl">{question}</h3>
          <p className="text-[13px] text-white/50">{community}</p>
        </div>
        <div className="hidden sm:flex gap-1 shrink-0">
          <button onClick={() => nudge(-1)} aria-label="Scroll back" className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 cursor-pointer">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => nudge(1)} aria-label="Scroll forward" className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 cursor-pointer">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={scroller} className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-3 snap-x">
        {children}
      </div>
    </section>
  );
}

function VoiceCard({ index, minutes, name }: { readonly index: number; readonly minutes: number; readonly name: string }) {
  const [hover, setHover] = useState(false);
  const [from] = CARD_TONES[index % CARD_TONES.length];

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ scale: 1.07, y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="relative snap-start shrink-0 w-52 h-32 rounded-2xl overflow-hidden p-3 flex flex-col justify-end"
      style={{ background: `linear-gradient(145deg, ${from}88, #0E1524 78%)` }}
    >
      <div className="absolute inset-x-3 top-4 h-10 flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <motion.span
            key={i}
            className="flex-1 rounded-full bg-white/70"
            style={{ height: "100%", transformOrigin: "center" }}
            animate={{ scaleY: hover ? [0.2, 0.3 + (((i + index) * 37) % 70) / 100, 0.2] : 0.12 + (((i + index) * 37) % 70) / 200 }}
            transition={hover ? { duration: 0.7 + (i % 4) * 0.12, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          />
        ))}
      </div>
      <motion.span
        className="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-white flex items-center justify-center"
        animate={{ opacity: hover ? 1 : 0, scale: hover ? 1 : 0.7 }}
      >
        <Play size={15} color="#05070F" fill="#05070F" />
      </motion.span>
      <p className="text-[13px] font-semibold text-white">{name}</p>
      <p className="text-[11px] text-white/65 tabular-nums">{minutes} min</p>
    </motion.div>
  );
}
