"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

import { LocalCommunity, SPOTS } from "./LocalCommunity";

const DARK_BG = "#060C18";
const DARK_BG2 = "#08111E";

/**
 * Community page.
 *
 *   1. Nobody does this alone   → so who would I be with, and where?
 *   2. Four lives, and the real groups they'd actually land in
 *                                → does any of this feel like togetherness,
 *                                  not just a feature list?
 *   3. The vision, told through the same places just shown → done.
 *
 * Kinextion is a global product; Dallas is the first city it launches in, not
 * a place it was built for. Section 2 is deliberately one continuous section
 * rather than a "who's in a pod" block followed by a separate "this city
 * already has what we're building" block — the previous version implied
 * Dallas was special-cased, which isn't true and isn't the message. Every
 * "in Dallas" line here should read as one example of a pattern that repeats
 * in any city, not as a claim about Dallas itself.
 *
 * Also gone, both deliberate:
 *   • A scripted pod conversation — a fake chat thread modelling the "right"
 *     way to open up. Telling people how to talk to their friends isn't a
 *     product decision that belongs to us.
 *   • A standalone "what Kinextion does in a pod" feature block and a
 *     separate closing CTA — cut for focus; the page ends on the same real
 *     places it opened with, not a second ask.
 */

// ── Pod members shown in the hero constellation ───────────────────────────────
const MEMBERS = [
  { id: "marcus", name: "Marcus", role: "Engineer · Chicago", color: "#00C47A", x: 50, y: 6,  photo: "https://randomuser.me/api/portraits/men/36.jpg" },
  { id: "jade",   name: "Jade",   role: "Student · London",   color: "#0ABAB5", x: 81, y: 19, photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "sofia",  name: "Sofia",  role: "Designer · Austin",  color: "#A855F7", x: 91, y: 54, photo: "https://randomuser.me/api/portraits/women/68.jpg" },
  { id: "aaliya", name: "Aaliya", role: "Teacher · Dallas",   color: "#F59E0B", x: 68, y: 88, photo: "https://randomuser.me/api/portraits/women/91.jpg" },
  { id: "mia",    name: "Mia",    role: "Nurse · Houston",    color: "#EC4899", x: 32, y: 88, photo: "https://randomuser.me/api/portraits/women/56.jpg" },
  { id: "andre",  name: "Andre",  role: "Manager · Atlanta",  color: "#EF4444", x: 9,  y: 54, photo: "https://randomuser.me/api/portraits/men/65.jpg" },
  { id: "jordan", name: "Jordan", role: "Coach · Seattle",    color: "#3B82F6", x: 19, y: 19, photo: "https://randomuser.me/api/portraits/men/58.jpg" },
] as const;

/**
 * Who a pod is made of — and one real example of where each of them could
 * land, once matched.
 *
 * `landing` deliberately reads as an example rather than a claim: it's what
 * pod-adjacent group life looks like *today, in Dallas* — the first city
 * Kinextion runs in — not a statement that this only exists there. The same
 * matching produces a different, equally real answer in any other city.
 */
const POD_PEOPLE = [
  {
    initial: "A", name: "Ashley, 33", role: "Registered Nurse", color: "#0ABAB5",
    quote: "I tell my patients to rest and eat well. I haven't done either myself in three years.",
    fit: "Check-ins built for between shifts — not around them",
    landing: "a Saturday club with no pace requirement, like 214 Run Club",
  },
  {
    initial: "M", name: "Marcus, 28", role: "Marketing Manager", color: "#00C47A",
    quote: "The problem isn't finding a program. Programs don't survive contact with my actual life.",
    fit: "Adapts when life spikes — doesn't ask you to start over",
    landing: "something on the calendar every week, like Train Pegasus",
  },
  {
    initial: "D", name: "Diana, 41", role: "Elementary Teacher", color: "#F59E0B",
    quote: "I give everything I have to 28 kids all day. By the time I'm home, there's nothing left for me.",
    fit: "Micro recovery built for a caregiver's actual schedule",
    landing: "a walk round White Rock Lake that asks nothing of her",
  },
  {
    initial: "J", name: "James, 54", role: "Operations Director", color: "#A855F7",
    quote: "I put off taking care of myself for 20 years because work came first. I don't know how to start at 54.",
    fit: "Longevity-first coaching that begins wherever you are",
    landing: "free courts at Cole Park, where nobody asks your history",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
export function CommunitySection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const smX = useSpring(rawX, { stiffness: 58, damping: 18 });
  const smY = useSpring(rawY, { stiffness: 58, damping: 18 });
  const netX = useTransform(smX, [0, 1], [-14, 14]);
  const netY = useTransform(smY, [0, 1], [-10, 10]);

  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % SPOTS.length), 5500);
    return () => clearInterval(t);
  }, []);

  const onNetMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      rawX.set((e.clientX - r.left) / r.width);
      rawY.set((e.clientY - r.top) / r.height);
    },
    [rawX, rawY]
  );

  return (
    <section className="tab-section" style={{ background: DARK_BG }}>

      {/* ══ 1 · HERO ══════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{
          minHeight: "calc(100vh - var(--nav-height, 56px))",
          background: `radial-gradient(ellipse 120% 80% at 70% 40%, rgba(10,186,181,0.07) 0%, rgba(168,85,247,0.05) 55%, transparent 80%), ${DARK_BG}`,
        }}
        onMouseMove={onNetMouseMove}
      >
        <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.35 }}>
          {[...Array(28)].map((_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                width: i % 3 === 0 ? 2 : 1, height: i % 3 === 0 ? 2 : 1,
                left: `${(i * 37 + 11) % 97}%`, top: `${(i * 53 + 7) % 94}%`,
                background: "rgba(255,255,255,0.6)",
              }} />
          ))}
        </div>

        <div
          className="section-container grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-6 items-center"
          style={{
            minHeight: "calc(100vh - var(--nav-height, 56px))",
            paddingTop: "3.5rem",
            paddingBottom: "3.5rem",
          }}
        >
          <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.65 }}>
            <p className="section-label mb-3" style={{ color: "#0ABAB5" }}>Community</p>
            <h2 className="font-semibold leading-[1.05] mb-5 text-balance tracking-[-0.03em]"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#FFFFFF" }}>
              No one reaches
              <br />
              <span style={{ color: "#0ABAB5" }}>their best alone.</span>
            </h2>

            <p className="text-[15px] leading-relaxed max-w-md text-balance" style={{ color: "rgba(255,255,255,0.58)" }}>
              Kinextion matches you with a pod of 3–5 people chasing similar goals.
              Not a feed. Not followers. Real humans held together by AI that watches
              out for all of you.
            </p>
          </motion.div>

          {/* Constellation */}
          <motion.div className="relative mx-auto w-full max-w-[420px] aspect-square"
            style={{ x: netX, y: netY }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.72, delay: 0.14 }}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none" style={{ overflow: "visible" }}>
              {MEMBERS.map((m, i) => (
                <motion.path key={m.id} d={`M ${m.x} ${m.y} L 50 50`}
                  stroke={m.color} strokeWidth="0.55" strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.35 }}
                  transition={{ pathLength: { duration: 0.88, delay: 0.3 + i * 0.11 }, opacity: { duration: 0.4, delay: 0.3 + i * 0.11 } }} />
              ))}
            </svg>

            {MEMBERS.map((m, i) => (
              <motion.div key={m.id} className="absolute"
                style={{ left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)", zIndex: hoveredNode === m.id ? 30 : 10 }}
                initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", delay: 0.18 + i * 0.09, stiffness: 280, damping: 22 }}
                onMouseEnter={() => setHoveredNode(m.id)} onMouseLeave={() => setHoveredNode(null)}>
                <motion.div whileHover={{ scale: 1.18 }} className="relative flex flex-col items-center">
                  <div className="w-10 h-10 sm:w-[46px] sm:h-[46px] rounded-full overflow-hidden select-none"
                    style={{
                      border: `2px solid ${m.color}55`,
                      boxShadow: hoveredNode === m.id ? `0 0 22px ${m.color}48, 0 0 8px ${m.color}20` : `0 2px 10px ${m.color}22`,
                      transition: "box-shadow 0.22s",
                    }}>
                    <img src={m.photo} alt="" className="w-full h-full object-cover" />
                  </div>
                  <AnimatePresence>
                    {hoveredNode === m.id && (
                      <motion.div initial={{ opacity: 0, y: 6, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.88 }} transition={{ duration: 0.18 }}
                        className="absolute top-full mt-2 rounded-xl px-2.5 py-1.5 whitespace-nowrap"
                        style={{ background: "rgba(8,18,32,0.95)", boxShadow: `0 4px 20px rgba(0,0,0,0.40), 0 0 0 1px ${m.color}30` }}>
                        <p className="text-[11px] font-semibold" style={{ color: "#F1F5F9" }}>{m.name}</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.50)" }}>{m.role}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))}

            <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 20 }}>
              <motion.div className="w-[68px] h-[68px] rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(0,196,122,0.16) 0%, rgba(10,186,181,0.14) 50%, rgba(168,85,247,0.10) 100%)",
                  border: "2px solid rgba(10,186,181,0.52)",
                }}
                animate={{
                  boxShadow: [
                    "0 0 30px rgba(10,186,181,0.22), 0 0 58px rgba(0,196,122,0.10)",
                    "0 0 48px rgba(10,186,181,0.40), 0 0 80px rgba(0,196,122,0.18)",
                    "0 0 30px rgba(10,186,181,0.22), 0 0 58px rgba(0,196,122,0.10)",
                  ],
                }}
                transition={{ duration: 3.2, repeat: Infinity }}>
                <span className="text-[10px] font-semibold tracking-[0.18em]" style={{ color: "#FFFFFF" }}>YOU</span>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${DARK_BG})` }} />
      </div>

      {/* ══ 2 · WHO'S IN A POD, SHOWN FOR REAL ════════════════════════════════
          "Different lives, same problem" and "here's what that looks like on
          the ground" used to be two sections — a claim, then a separate proof.
          Merged into one: the cards make the claim, the real groups right
          beneath them are the proof, no second header in between. */}
      <div className="py-24" style={{ background: DARK_BG }}>
        <div className="section-container">
          <SectionHead
            label="Who you'd be matched with"
            labelColor="#00C47A"
            title="Different lives."
            titleMuted="The same quiet problem."
            body="Pods are matched on the shape of your week — the constraints, the season of life, the reason it keeps breaking — not on where you live. That works the same in any city Kinextion runs in. We're launching first in Dallas, so that's where these examples come from."
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-12">
            {POD_PEOPLE.map((p, i) => (
              <motion.div key={p.name}
                initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }} transition={{ delay: i * 0.08, duration: 0.45 }}
                className="rounded-2xl p-5 flex flex-col"
                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${p.color}1F` }}>
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ background: `${p.color}1A`, border: `1.5px solid ${p.color}38`, color: p.color }}>
                    {p.initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold leading-tight" style={{ color: "#FFFFFF" }}>{p.name}</p>
                    <p className="text-[10.5px] leading-snug mt-0.5" style={{ color: p.color }}>{p.role}</p>
                  </div>
                </div>

                <p className="text-[11.5px] leading-relaxed italic mb-4 flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  &ldquo;{p.quote}&rdquo;
                </p>

                <div className="flex items-start gap-2 pt-3" style={{ borderTop: `1px solid ${p.color}1A` }}>
                  <div className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: p.color }} />
                  <p className="text-[10.5px] leading-relaxed" style={{ color: `${p.color}CC` }}>{p.fit}</p>
                </div>

                {/* One concrete example — not a claim that this only exists here. */}
                <div className="flex items-start gap-2 mt-2.5">
                  <span className="text-[10px] leading-none mt-1 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>↳</span>
                  <p className="text-[10.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>
                    In Dallas, that could be {p.landing}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }} transition={{ delay: 0.15, duration: 0.5 }}
            className="text-center max-w-xl mx-auto mt-16 mb-10"
          >
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "#0ABAB5" }}>
              Real, in Dallas today
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)" }}>
              Kinextion works the same in any city — Dallas is simply where
              we&apos;re starting. These are the actual groups and places pods
              there connect to right now.
            </p>
          </motion.div>

          <LocalCommunity />
        </div>
      </div>

      {/* ══ 3 · VISION ════════════════════════════════════════════════════════
          Closes on the same four places just shown above, not new stock
          imagery — and each line is written about the place in its photo
          rather than borrowed from someone unconnected to any of it. */}
      <div style={{ background: DARK_BG2 }}>
        <div className="pt-24 pb-10 px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.55 }}>
            <p className="section-label mb-3" style={{ color: "#0ABAB5" }}>The Vision</p>
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }}
              className="text-[15px] italic mb-3"
              style={{
                background: "linear-gradient(135deg, #FFFFFF 0%, #0ABAB5 45%, #A855F7 100%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
              Your future self is calling.
            </motion.p>
            <h3 className="font-semibold text-white text-balance mx-auto tracking-[-0.025em]"
              style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", maxWidth: "22ch" }}>
              Together is better.
              <br />
              <span style={{ color: "rgba(255,255,255,0.26)" }}>Always has been.</span>
            </h3>
          </motion.div>
        </div>

        <div className="relative overflow-hidden" style={{ height: "58vh", minHeight: 360, maxHeight: 580 }}>
          <AnimatePresence mode="sync">
            <motion.div key={slideIdx} className="absolute inset-0 lg:right-[38%]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: "easeInOut" }}>
              <img
                src={SPOTS[slideIdx].img}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: SPOTS[slideIdx].focus }}
              />
              <div className="absolute inset-0 hidden lg:block"
                style={{ background: `linear-gradient(to right, transparent 52%, ${DARK_BG2} 100%)` }} />
              <div className="absolute inset-0 block lg:hidden"
                style={{ background: "linear-gradient(to top, rgba(8,17,30,0.92) 0%, transparent 55%)" }} />
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 right-0 lg:left-auto lg:top-0 lg:w-[42%] flex flex-col justify-center px-8 py-10 lg:py-0">
            <AnimatePresence>
              <motion.div key={slideIdx} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.42 }}>
                <div className="w-8 h-0.5 rounded-full mb-4" style={{ background: "#0ABAB5" }} />
                <p className="font-semibold text-xl lg:text-2xl leading-snug text-balance mb-4 tracking-[-0.02em]" style={{ color: "#FFFFFF" }}>
                  {SPOTS[slideIdx].line}
                </p>
                <p className="text-xs font-medium" style={{ color: "#0ABAB5" }}>
                  {SPOTS[slideIdx].name}, Dallas
                </p>
                <p className="text-[9.5px] mt-1.5" style={{ color: "rgba(255,255,255,0.32)" }}>
                  Photo: {SPOTS[slideIdx].credit} · {SPOTS[slideIdx].licence}
                </p>

                <div className="flex items-center gap-2 mt-7">
                  {SPOTS.map((_, i) => (
                    <motion.button key={i} onClick={() => setSlideIdx(i)}
                      aria-label={`Show place ${i + 1}`}
                      className="rounded-full transition-all duration-300 cursor-pointer"
                      animate={{ width: i === slideIdx ? 28 : 8, background: i === slideIdx ? "#0ABAB5" : "rgba(255,255,255,0.25)" }}
                      style={{ height: 8 }} whileHover={{ scale: 1.2 }} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Shared section header ────────────────────────────────────────────────────
// Every section on this page opens the same way, which is most of what makes
// the page read as one argument rather than five unrelated blocks.
function SectionHead({
  label, labelColor, title, titleMuted, body,
}: {
  readonly label: string;
  readonly labelColor: string;
  readonly title: string;
  readonly titleMuted: string;
  readonly body: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55 }}
      className="text-center max-w-2xl mx-auto"
    >
      <p className="section-label mb-3" style={{ color: labelColor }}>{label}</p>
      <h3 className="font-semibold text-balance tracking-[-0.025em] leading-[1.12]" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", color: "#FFFFFF" }}>
        {title}
        <br />
        <span style={{ color: "rgba(255,255,255,0.32)" }}>{titleMuted}</span>
      </h3>
      <p className="mt-4 text-[13.5px] leading-relaxed max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.48)" }}>
        {body}
      </p>
    </motion.div>
  );
}
