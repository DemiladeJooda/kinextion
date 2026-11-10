"use client";

import { CommunityMap } from "@/components/community/CommunityMap";
import { VoiceRows } from "@/components/community/VoiceRows";

/**
 * Where you'd go, then what you'd hear. The map holds only real, verified
 * groups; the voices are real when any are public and labelled otherwise.
 */
export function CommunitySection() {
  return (
    <section className="relative">
      <CommunityMap />
      <VoiceRows />
    </section>
  );
}
