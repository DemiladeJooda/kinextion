"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CommunityMap } from "@/components/community/CommunityMap";
import { VoiceRows } from "@/components/community/VoiceRows";
import { RunAGroup, SPOTS } from "./LocalCommunity";

/**
 * Where you'd go, then what you'd hear. The map holds only real, verified
 * groups; the voices are real when any are public and labelled otherwise.
 */
export function CommunitySection() {
  return (
    <section className="relative">
      <CommunityMap />
      <VoiceRows />
      <Vision />
      <RunAGroup />
    </section>
  );
}

function Vision() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => (i + 1) % SPOTS.length), 5500);
    return () => window.clearInterval(t);
  }, []);

  const spot = SPOTS[index];

  return (
    <div className="relative overflow-hidden" style={{ height: "82vh", minHeight: 460 }}>
      <AnimatePresence>
        <motion.img
          key={spot.id}
          src={spot.img}
          alt={spot.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: spot.focus }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #05081A 4%, rgba(5,8,26,0.45) 55%, #05081A 100%)" }} />

      <div className="absolute inset-x-0 bottom-0 px-6 pb-16 text-center">
        <AnimatePresence mode="wait">
          <motion.div key={spot.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }}>
            <p className="font-semibold text-white text-balance max-w-3xl mx-auto" style={{ fontSize: "clamp(1.6rem, 3.8vw, 3rem)", letterSpacing: "-0.025em" }}>
              {spot.line}
            </p>
            <p className="mt-3 text-sm" style={{ color: "#0ABAB5" }}>
              {spot.name}, Dallas
            </p>
            <p className="mt-1 text-[10px] text-white/45">
              Photo: {spot.credit} · {spot.licence}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
