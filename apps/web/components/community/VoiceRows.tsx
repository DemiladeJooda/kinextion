"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * Rows of voices that keep sliding, the same shape as Discover in the app.
 *
 * Shows real public responses when any exist. Until then it shows sample rows
 * with stock photos and made-up names, and says so underneath.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Lock, Play } from "lucide-react";
import type { DiscoverRow } from "@kinextion/shared";
import { EASE, Reveal } from "@/components/motion/primitives";
import { SAMPLE_PEOPLE, samplePhoto, type SamplePerson } from "@/lib/sample-voices";

const TONES = ["#00C47A", "#A855F7", "#0ABAB5", "#F59E0B", "#3B82F6", "#EC4899"] as const;

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

function peopleFor(row: number, count: number): SamplePerson[] {
  return Array.from({ length: count }, (_, i) => SAMPLE_PEOPLE[(row * 3 + i * 5) % SAMPLE_PEOPLE.length]);
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
    <div className="pt-20 pb-20">
      <div className="section-container">
        <Reveal>
          <h2 className="font-semibold text-white text-balance" style={{ fontSize: "clamp(2rem, 4.6vw, 3.6rem)" }}>
            One question a week. <span className="text-white/45">In their own voices.</span>
          </h2>
        </Reveal>
      </div>

      <LockedRow />

      {rows.length > 0
        ? rows.map((row, r) => (
            <Row key={`${row.community.slug}-${row.topic.topicKey}-${row.weekKey}`} question={row.topic.text} community={row.community.name} index={r}>
              {row.responses.map((item, i) => (
                <Link key={item.id} href={`/discover/${item.id}`} className="block shrink-0">
                  <VoiceCard tone={TONES[i % TONES.length]} minutes={Math.max(1, Math.round(item.durationSec / 60))} name={item.speaker.displayName ?? "A member"} />
                </Link>
              ))}
            </Row>
          ))
        : EXAMPLES.map((row, r) => {
            const people = peopleFor(r, row.minutes.length);
            return (
              <Row key={row.question} question={row.question} community={row.community} index={r}>
                {row.minutes.map((m, i) => (
                  <VoiceCard key={i} tone={TONES[(i + r) % TONES.length]} minutes={m} name={people[i].name} photo={people[i].photo} />
                ))}
              </Row>
            );
          })}

      {rows.length === 0 ? (
        <p className="section-container mt-8 text-[11px] text-white/40">
          Sample rooms, with stock photos and made-up names. Real responses appear here once people choose to share them.
        </p>
      ) : (
        <div className="section-container mt-8">
          <Link href="/discover" className="text-sm font-semibold underline underline-offset-4" style={{ color: "#0ABAB5" }}>
            See everything
          </Link>
        </div>
      )}
    </div>
  );
}

function LockedRow() {
  const people = peopleFor(7, 8);
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
          {people.map((p, i) => (
            <div key={i} className="relative shrink-0 w-28 h-36 rounded-2xl overflow-hidden" style={{ filter: "blur(6px)" }}>
              <img src={samplePhoto(p.photo, 200, 260)} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-8 sm:bottom-10 flex justify-center">
            <span className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#05070F] bg-white">
              <Lock size={15} /> Speak first. Then you can listen.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The cards are rendered twice and the strip slides by exactly one copy, so
 * the loop never shows a seam. Alternate rows run the other way at a slightly
 * different speed. Hovering a row pauses it.
 */
function Row({
  question,
  community,
  index,
  children,
}: {
  readonly question: string;
  readonly community: string;
  readonly index: number;
  readonly children: ReactNode;
}) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="section-container">
        <p className="text-[13px] font-semibold" style={{ color: TONES[index % TONES.length] }}>
          {community}
        </p>
        <h3 className="mt-1 text-white font-semibold text-balance max-w-3xl" style={{ fontSize: "clamp(1.5rem, 3.2vw, 2.4rem)", letterSpacing: "-0.025em", lineHeight: 1.12 }}>
          {question}
        </h3>
      </div>
      <div
        className="kx-marquee mt-5 overflow-hidden py-3"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)",
        }}
      >
        <div
          className="kx-marquee-track flex w-max"
          style={{
            animationDuration: `${150 + (index % 3) * 20}s`,
            animationDirection: index % 2 ? "reverse" : "normal",
          }}
        >
          <div className="flex gap-3 pr-3">{children}</div>
          <div className="flex gap-3 pr-3" aria-hidden>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function VoiceCard({
  tone,
  minutes,
  name,
  photo,
}: {
  readonly tone: string;
  readonly minutes: number;
  readonly name: string;
  readonly photo?: string;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="relative shrink-0 w-72 h-44 sm:w-96 sm:h-56 rounded-3xl overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${tone}88, #0E1524 78%)` }}
    >
      {photo ? <img src={samplePhoto(photo, 768, 448)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-85" loading="lazy" /> : null}
      <span className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(5,7,15,0.92) 0%, rgba(5,7,15,0.15) 50%, ${tone}22 100%)` }} />

      <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold text-white tabular-nums" style={{ background: "rgba(0,0,0,0.45)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#EF4444" }} />
        {minutes} min
      </span>

      <div className="absolute left-4 right-16 bottom-11 h-7 flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: 34 }, (_, i) => (
          <motion.span
            key={i}
            className="flex-1 rounded-full bg-white/80"
            style={{ height: "100%", transformOrigin: "center" }}
            animate={{ scaleY: hover ? [0.2, 0.35 + ((i * 37) % 60) / 100, 0.2] : 0.12 + ((i * 37) % 60) / 260 }}
            transition={hover ? { duration: 0.6 + (i % 4) * 0.12, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          />
        ))}
      </div>

      <motion.span
        className="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-white flex items-center justify-center"
        animate={{ opacity: hover ? 1 : 0, scale: hover ? 1 : 0.7 }}
      >
        <Play size={15} color="#05070F" fill="#05070F" />
      </motion.span>
      <p className="absolute left-4 bottom-4 text-[15px] font-semibold text-white">{name}</p>
    </motion.div>
  );
}
