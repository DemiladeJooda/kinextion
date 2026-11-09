"use client";

import { Reveal } from "@/components/motion/primitives";

/**
 * Real places in Dallas, the first city Kinextion launches in.
 *
 * Photographs are freely-licensed images of these exact locations. Credit and
 * licence must stay in the caption. Nothing here claims a partnership.
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

/** The invitation to real organisers. */
export function RunAGroup() {
  return (
    <div className="section-container py-20">
      <Reveal className="text-center">
        <h3 className="font-semibold text-white text-balance" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.8rem)" }}>
          Run a group here? We&apos;ll show up for it.
        </h3>
        <a
          href="mailto:hello@kinextion.com?subject=Dallas%20community"
          className="mt-6 inline-block px-7 py-3 rounded-full font-semibold text-sm text-[#05070F] bg-white"
        >
          Tell us about it
        </a>
        <p className="mt-6 text-[11px] text-white/40 max-w-lg mx-auto">
          Groups on the map are independent. They aren&apos;t partners or sponsors, and schedules change, so each one links to its own page.
        </p>
      </Reveal>
    </div>
  );
}
