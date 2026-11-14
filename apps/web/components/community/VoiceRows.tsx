"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * Shelves of voices, the same shape as Discover in the app.
 *
 * Shows real public responses when any exist. Until then it shows sample rows
 * with stock photos and made-up names, and says so underneath.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Lock, Play } from "lucide-react";
import type { DiscoverRow } from "@kinextion/shared";
import { Band, EASE, ON_LIGHT, Reveal, inkFor } from "@/components/motion/primitives";
import { SAMPLE_PEOPLE, samplePhoto, type SamplePerson } from "@/lib/sample-voices";

const TONES = ["#00C47A", "#A855F7", "#0ABAB5", "#F59E0B", "#3B82F6", "#EC4899"] as const;

interface ExampleRow {
  readonly question: string;
  readonly community: string;
  readonly minutes: readonly number[];
}

const EXAMPLES: readonly ExampleRow[] = [
  { question: "What are you proud of this week that nobody saw?", community: "New parents", minutes: [6, 3, 8, 5, 4, 7, 2, 6] },
  { question: "What did you stop doing that made life better?", community: "Morning runners", minutes: [4, 7, 3, 6, 9, 5, 4, 8] },
  { question: "What are you pretending is fine?", community: "Night-shift nurses", minutes: [9, 5, 3, 7, 4, 6, 8, 3] },
  { question: "When did you last feel strong?", community: "Lifting after 40", minutes: [3, 6, 4, 8, 5, 7, 4, 9] },
  { question: "What would you do this week if nobody was keeping score?", community: "First-time founders", minutes: [5, 8, 4, 3, 6, 9, 7, 4] },
  { question: "Who did you mean to call this week, and didn't?", community: "Working away from home", minutes: [7, 4, 6, 3, 8, 5, 9, 4] },
  { question: "What small thing saved a bad day?", community: "Starting over", minutes: [3, 5, 7, 4, 6, 8, 5, 3] },
  { question: "What did your body ask for that you ignored?", community: "Desk-job backs", minutes: [8, 6, 4, 9, 3, 5, 7, 6] },
];

const WARM = inkFor("sand");

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
    <Band tone="sand">
    <div className="pt-24 sm:pt-32 pb-24">
      <div className="section-container">
        <Reveal>
          <p className="section-label" style={{ color: "#087F7B", WebkitTextFillColor: "#087F7B" }}>
            Community pods
          </p>
          <h2 className="font-semibold text-balance" style={{ fontSize: "clamp(2.2rem, 5.2vw, 4.2rem)", color: WARM.strong }}>
            One question a week. <span style={{ color: WARM.faint }}>In their own voices.</span>
          </h2>
          <p className="mt-4 max-w-xl text-balance" style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)", color: WARM.body }}>
            A community pod is a small group on the same path. Every week it gets one question worth answering out loud.
          </p>
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
        <p className="section-container mt-12 text-[11px]" style={{ color: WARM.faint }}>
          Sample pods and questions, with stock photos and made-up names. Real responses appear here once people choose to share them.
        </p>
      ) : (
        <div className="section-container mt-8">
          <Link href="/discover" className="text-sm font-semibold underline underline-offset-4" style={{ color: "#087F7B" }}>
            See everything
          </Link>
        </div>
      )}
    </div>
    </Band>
  );
}

function LockedRow() {
  const people = peopleFor(7, 8);
  return (
    <section className="mt-10 section-container">
      <div className="rounded-[2rem] p-6 sm:p-10 relative overflow-hidden" style={{ background: "linear-gradient(140deg, #062629, #06111C)" }}>
        <p className="text-sm font-semibold" style={{ color: "#3DCFCB" }}>
          Your community pod · this week
        </p>
        <h3 className="mt-2 text-white font-semibold text-balance max-w-3xl" style={{ fontSize: "clamp(1.8rem, 4vw, 3.2rem)", letterSpacing: "-0.03em", lineHeight: 1.08 }}>
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

/** The page gutter, so a shelf's first card lines up under its title. */
const GUTTER = "max(1.5rem, calc((100vw - 80rem) / 2 + 2rem))";

/**
 * A shelf, the way a streaming app lays one out: the title, then a row of
 * cards that starts at the page's left edge and runs off the right. It sits
 * still until you scroll it, or use the arrows that appear on hover.
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
  const shelf = useRef<HTMLDivElement>(null);
  const slide = (dir: -1 | 1) => shelf.current?.scrollBy({ left: dir * shelf.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="mt-12 sm:mt-14">
      <div className="section-container">
        <p className="flex items-center gap-2.5 text-[15px] sm:text-base font-semibold" style={{ color: WARM.strong }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONES[index % TONES.length] }} />
          {community}
          <span className="font-normal text-sm" style={{ color: ON_LIGHT[TONES[index % TONES.length]] ?? WARM.muted }}>
            Community pod
          </span>
        </p>
        <h3 className="mt-1.5 font-semibold text-balance max-w-4xl" style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.2rem)", letterSpacing: "-0.03em", lineHeight: 1.1, color: WARM.strong }}>
          {question}
        </h3>
      </div>
      <div className="group/shelf relative mt-4">
        <div
          ref={shelf}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide py-3 snap-x"
          style={{ paddingInline: GUTTER, scrollPaddingInline: GUTTER }}
        >
          {children}
        </div>
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            onClick={() => slide(dir)}
            aria-label={dir < 0 ? "Earlier voices" : "More voices"}
            className={`hidden md:flex absolute top-3 bottom-3 w-14 items-center justify-center text-white text-3xl cursor-pointer opacity-0 group-hover/shelf:opacity-100 transition-opacity duration-200 ${dir < 0 ? "left-0" : "right-0"}`}
            style={{ background: `linear-gradient(to ${dir < 0 ? "right" : "left"}, rgba(12,21,18,0.55), transparent)` }}
          >
            {dir < 0 ? "‹" : "›"}
          </button>
        ))}
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
      className="relative shrink-0 snap-start w-60 h-36 sm:w-[19rem] sm:h-44 rounded-xl overflow-hidden"
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
