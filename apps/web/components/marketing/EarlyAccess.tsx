"use client";

/**
 * Early access, as the ending of a page rather than a strip beneath it.
 *
 * Lives inside the Solution, How It Works and Community pages only, written
 * as each page's last beat. There's no divider above it on purpose: it should
 * read as where the page was heading.
 */

import { motion } from "motion/react";
import { WaitlistForm } from "./WaitlistForm";
import { AURORA, EASE } from "@/components/motion/primitives";

export function EarlyAccess({
  source,
  line,
  accent,
}: {
  readonly source: string;
  /** The sentence that closes this particular page. */
  readonly line: string;
  readonly accent: string;
}) {
  return (
    <div
      id="early-access"
      className="relative scroll-mt-24 flex flex-col items-center text-center px-6 pt-28 pb-32 sm:pt-40 sm:pb-44 overflow-hidden"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "min(90vw, 760px)",
          height: "min(90vw, 760px)",
          background: `radial-gradient(circle, ${accent}2E 0%, transparent 65%)`,
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: EASE }}
      />

      <motion.h2
        className="relative font-semibold text-balance max-w-3xl"
        style={{ fontSize: "clamp(2.2rem, 5.6vw, 4.4rem)", color: "#FFFFFF" }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        {line}{" "}
        <span style={{ backgroundImage: AURORA, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Be there when it opens.
        </span>
      </motion.h2>

      <motion.div
        className="relative mt-10 w-full flex justify-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      >
        <WaitlistForm source={source} />
      </motion.div>
    </div>
  );
}
