"use client";
/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";

/**
 * Local — real Dallas groups, shown as an example of what Kinextion plugs
 * into anywhere. Kinextion is not a Dallas product; Dallas is the first city
 * it launches in. This component exists to prove the idea with something
 * real rather than to claim the city is somehow uniquely built for it — copy
 * here should read as "here's what this looks like in practice", never as
 * "Dallas already has what we need."
 *
 * ⚠️ Read before editing
 *
 * Everything below is a real, publicly-listed group or place, linked to its
 * own page. That is the whole point: a community section full of invented
 * clubs is worse than an empty one, because the first person from Dallas who
 * reads it will know immediately.
 *
 * What that means for edits:
 *
 *   • Nothing here claims a partnership. These are groups we point people
 *     toward, not groups that have endorsed us. Do not add a logo, a quote, or
 *     the word "partner" to any entry without written permission on file — the
 *     `PARTNERS` array below is the only place a confirmed relationship goes.
 *   • Schedules move. Every card links out rather than being the source of
 *     truth for a meeting time, and `VERIFIED` records when a human last
 *     checked. If that date is stale, re-check before shipping.
 *   • Photographs are freely-licensed images of the actual named place, with
 *     attribution. Not stock, not "a park that looks like Dallas".
 *   • `SPOTS.line` is reused verbatim on the Vision slideshow — edit it once,
 *     here, rather than maintaining two versions of the same caption.
 */

/** When these listings were last checked against the groups' own pages. */
const VERIFIED = "July 2026";

interface Place {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly area: string;
  /** What actually happens there, in the group's own terms. */
  readonly note: string;
  readonly href: string;
  readonly accent: string;
}

/**
 * Real groups, each linked to its own listing.
 *
 * Details are deliberately thin — the neighbourhood and what kind of thing it
 * is. Anything more specific (pace, distance, exact meeting time) belongs on
 * their page, where it stays current.
 */
const PLACES: readonly Place[] = [
  {
    id: "214",
    name: "214 Run Club",
    kind: "Run club",
    area: "Cole Ave, Uptown",
    note: "Saturday-morning runs at three distances. No fee, no sign-up, no pace requirement.",
    href: "https://www.instagram.com/the214runclub/",
    accent: "#00C47A",
  },
  {
    id: "oak-cliff",
    name: "Oak Cliff Run Crew",
    kind: "Run club",
    area: "Oak Cliff",
    note: "A neighbourhood crew running weekday evenings and Sunday mornings out of North Zang.",
    href: "https://www.oakcliffruncrew.com/",
    accent: "#0ABAB5",
  },
  {
    id: "drc",
    name: "Dallas Running Club",
    kind: "Run club · nonprofit",
    area: "Citywide",
    note: "The city's long-running club — multiple groups, a race series, and social events all year.",
    href: "https://www.dallasrunningclub.com/",
    accent: "#3B82F6",
  },
  {
    id: "cole-pickleball",
    name: "Cole Park courts",
    kind: "Public pickleball",
    area: "4000 Cole Ave, Uptown",
    note: "Free outdoor courts, first come first served. Stack your paddle and wait your turn like everyone else.",
    href: "https://www.dallasparks.org/facilities/facility/details/Cole-Park-446",
    accent: "#A855F7",
  },
  {
    id: "zft",
    name: "ZFT Run Club",
    kind: "Run club",
    area: "Multiple locations",
    note: "Midweek and weekend runs that rotate around the city rather than sitting in one spot.",
    href: "https://www.instagram.com/zftrunclub_dallas/",
    accent: "#EC4899",
  },
  {
    id: "pegasus",
    name: "Train Pegasus",
    kind: "Training group",
    area: "Varies weekly",
    note: "Structured training sessions most days of the week, for people building toward something.",
    href: "https://trainpegasus.com/",
    accent: "#F59E0B",
  },
];

/**
 * Public places the above happen in — and where anyone can go alone.
 *
 * Photographs are freely-licensed images of these exact locations. `credit`
 * and `licence` render in the caption; removing them would breach the licence
 * on the CC BY-SA entries, so they are not optional decoration.
 */
export interface Spot {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /**
   * The through-line: what this specific place says about togetherness. Used
   * as the caption here and, unmodified, as the line on the Vision slideshow —
   * one curated set of photos, not two competing ones, and each line is tied
   * to the place in the photo rather than a borrowed quote from someone
   * unconnected to any of it.
   */
  readonly line: string;
  readonly href: string;
  readonly img: string;
  /** CSS `object-position`, so the crop favours the people/activity in frame. */
  readonly focus: string;
  readonly credit: string;
  readonly licence: string;
  readonly span?: "wide";
}

export const SPOTS: readonly Spot[] = [
  {
    id: "katy",
    name: "The Katy Trail",
    blurb:
      "Three and a half miles of old rail line through Uptown, and the spine most of the clubs above are organised around.",
    line: "The miles feel shorter with someone next to you.",
    href: "https://katytraildallas.org/",
    img: "/community/katy-trail.jpg",
    focus: "center 78%",
    credit: "Raysonho / Open Grid Scheduler",
    licence: "CC0",
    span: "wide",
  },
  {
    id: "white-rock",
    name: "White Rock Lake",
    blurb:
      "A nine-mile loop that the whole city uses. Walkers, cyclists, and the slow Sunday groups all share it.",
    line: "Showing up gets easier once somebody's expecting you.",
    href: "https://www.dallasparks.org/235/White-Rock-Lake",
    img: "/community/white-rock-lake.jpg",
    focus: "center 55%",
    credit: "Vulturesong",
    licence: "CC0",
  },
  {
    id: "klyde",
    name: "Klyde Warren Park",
    blurb:
      "Five acres built over a freeway, with free classes on the lawn most weeks.",
    line: "A class on the lawn is still a room full of people rooting for you.",
    href: "https://www.klydewarrenpark.org/",
    img: "/community/klyde-warren-park.jpg",
    focus: "center 40%",
    credit: "Joe Mabel",
    licence: "CC BY-SA 3.0",
  },
  {
    id: "bishop-arts",
    name: "Bishop Arts, Oak Cliff",
    blurb:
      "The walkable end of Oak Cliff, and where the neighbourhood crew finishes most weeks.",
    line: "What happens after the workout is where the friendship actually starts.",
    href: "https://bishopartsdistrict.com/",
    img: "/community/bishop-arts.jpg",
    focus: "center 62%",
    credit: "Michael Barera",
    licence: "CC BY-SA 4.0",
  },
];

// ── Confirmed partnerships. Empty until something is signed. ─────────────────
export interface Partner {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly neighbourhood: string;
  readonly logo: string | null;
  readonly accent: string;
}

export const PARTNERS: readonly Partner[] = [
  // Shape, kept commented so nobody has to guess it:
  // { id: "…", name: "…", kind: "Run club", neighbourhood: "Oak Cliff", logo: "/partners/….svg", accent: "#00C47A" },
];

export function LocalCommunity() {
  const hasPartners = PARTNERS.length > 0;

  return (
    <div>
      {/* Confirmed partners, once there are any. */}
      {hasPartners ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {PARTNERS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="rounded-2xl p-4 flex flex-col items-center text-center gap-2.5"
              style={{ background: `${p.accent}0A`, border: `1px solid ${p.accent}22` }}
            >
              {p.logo ? (
                <img src={p.logo} alt={p.name} className="h-10 object-contain" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: `${p.accent}1A`, color: p.accent }}
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold" style={{ color: "#FFFFFF" }}>{p.name}</p>
                <p className="text-[10px]" style={{ color: p.accent }}>
                  {p.kind} · {p.neighbourhood}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}

      {/* ── The groups ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLACES.map((p, i) => (
          <motion.a
            key={p.id}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            whileHover={{ y: -3 }}
            className="group rounded-2xl p-5 block"
            style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${p.accent}1F` }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: "#FFFFFF" }}>
                  {p.name}
                </p>
                <p className="text-[10.5px] mt-1" style={{ color: p.accent }}>
                  {p.kind} · {p.area}
                </p>
              </div>
              <span
                className="shrink-0 text-[11px] transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: `${p.accent}99` }}
                aria-hidden
              >
                ↗
              </span>
            </div>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              {p.note}
            </p>
          </motion.a>
        ))}
      </div>

      <p className="text-[10.5px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        Independent groups, listed because they&apos;re good — not partners, not
        sponsors, and not affiliated with Kinextion. Schedules change; each link
        goes to their own page. Last checked {VERIFIED}.
      </p>

      {/* ── The places ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-10">
        {SPOTS.map((s, i) => (
          <motion.a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.06, duration: 0.45 }}
            className={`group relative rounded-2xl overflow-hidden block ${
              s.span === "wide" ? "sm:col-span-2 lg:col-span-2" : ""
            }`}
            style={{ minHeight: 232, border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <img
              src={s.img}
              alt={s.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              style={{ objectPosition: s.focus }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(6,12,24,0.94) 0%, rgba(6,12,24,0.55) 42%, rgba(6,12,24,0.12) 100%)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "#FFFFFF" }}>
                {s.name}
              </p>
              <p className="text-[11.5px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.72)" }}>
                {s.blurb}
              </p>
              <p className="text-[9px] mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Photo: {s.credit} · {s.licence}
              </p>
            </div>
          </motion.a>
        ))}
      </div>

      {/* The real CTA until partnerships exist. Kicker deliberately doesn't say
          "invitation" — Dallas is the first city, not the only one, and this
          block should read as "reach out" rather than as its own destination
          section on the page. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mt-6 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5"
        style={{
          background: "linear-gradient(120deg, rgba(10,186,181,0.09) 0%, rgba(168,85,247,0.07) 100%)",
          border: "1px solid rgba(10,186,181,0.22)",
        }}
      >
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "#0ABAB5" }}>
            First city: Dallas
          </p>
          <h4 className="font-semibold text-lg mb-2 tracking-[-0.015em]" style={{ color: "#FFFFFF" }}>
            Run a group here? We&apos;ll show up for it.
          </h4>
          <p className="text-[12.5px] leading-relaxed max-w-lg" style={{ color: "rgba(255,255,255,0.58)" }}>
            We&apos;re building the local side of Kinextion one city at a time,
            starting here. No fees, no exclusivity. If you organise something and
            people keep coming back, we want to know you.
          </p>
        </div>

        <a
          href="mailto:hello@kinextion.com?subject=Dallas%20community"
          className="shrink-0 text-sm font-semibold px-6 py-3 rounded-full text-center transition-transform duration-150 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 55%, #A855F7 100%)",
            color: "#FFFFFF",
            boxShadow: "0 8px 28px rgba(10,186,181,0.28)",
          }}
        >
          Tell us about it
        </a>
      </motion.div>
    </div>
  );
}
