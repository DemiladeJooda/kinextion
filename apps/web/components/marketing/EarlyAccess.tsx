"use client";

/**
 * Early access, as the ending of a page rather than a strip beneath it.
 *
 * Lives inside the Solution and Your Guides pages only. Just the email field
 * and the button, nothing behind it.
 */

import { motion } from "motion/react";
import { WaitlistForm } from "./WaitlistForm";
import { EASE } from "@/components/motion/primitives";

export function EarlyAccess({ source }: { readonly source: string }) {
  return (
    <div id="early-access" className="relative scroll-mt-24 flex flex-col items-center px-6 py-24 sm:py-32">
      <motion.div
        className="relative w-full flex justify-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <WaitlistForm source={source} />
      </motion.div>
    </div>
  );
}
