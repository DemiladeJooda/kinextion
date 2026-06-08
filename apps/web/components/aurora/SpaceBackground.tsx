"use client";

import { StarField } from "./StarField";

// Fixed, full-viewport "deep space" backdrop shared by the immersive pages
// (home, solution, story). It recreates the look of the Solution page's solar
// system: a near-black night-sky gradient, a twinkling star layer, and three
// soft aurora glows (green on the left, violet on the right, teal in the
// centre). Pointer events are disabled so it never blocks the UI on top.
export function SpaceBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Night-sky gradient — the base colour of the whole scene. */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(165deg, #04051C 0%, #060920 55%, #05081A 100%)" }}
      />

      {/* Twinkling stars — a denser field since this covers the full screen. */}
      <StarField count={130} />

      {/* Aurora ambient glow — green, anchored to the left. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 60% at 18% 45%, rgba(0,196,122,0.12) 0%, transparent 70%)" }}
      />
      {/* Aurora ambient glow — violet, anchored to the right. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 60% at 82% 55%, rgba(168,85,247,0.12) 0%, transparent 70%)" }}
      />
      {/* Aurora ambient glow — teal, faint, centred (blends the two sides). */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 40% 50% at 50% 50%, rgba(10,186,181,0.08) 0%, transparent 70%)" }}
      />
    </div>
  );
}
