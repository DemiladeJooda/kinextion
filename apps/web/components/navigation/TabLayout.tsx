"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TabNav } from "./TabNav";

// The context lives in its own module so sections can consume it without
// importing this file back — see navigation-context.tsx for why that matters.
import { NavigateContext } from "./navigation-context";

// Re-exported for existing call sites; new code should import from
// "@/components/navigation/navigation-context" directly.
export { NavigateContext, useNavigate } from "./navigation-context";

// ─── Tab definitions (8 tabs) ─────────────────────────────────────────────────
export const TABS = [
  { id: "home",         label: "Home"         },
  { id: "problem",      label: "The Problem"  },
  { id: "shift",        label: "The Solution" },
  { id: "how-it-works", label: "How It Works" },
  { id: "community",    label: "Community"    },
  { id: "research",     label: "Research"     },
  { id: "story",        label: "Our Story"    },
];

// ─── Section imports ───────────────────────────────────────────────────────────
import { HeroSection }       from "@/components/sections/HeroSection";
import { ProblemSection }    from "@/components/sections/ProblemSection";
import { ShiftSection }      from "@/components/sections/ShiftSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { CommunitySection }  from "@/components/sections/CommunitySection";
import { ResearchSection }   from "@/components/sections/ResearchSection";
import { StorySection }      from "@/components/sections/StorySection";
import { ShootingStars }     from "@/components/aurora/ShootingStars";
import { SpaceBackground }   from "@/components/aurora/SpaceBackground";

// Tabs that render on the dark, immersive "space" backdrop. Every other tab
// uses the light backdrop (white) with shooting stars.
const SPACE_TABS = new Set(["home", "shift", "story"]);

// ─── Page transition ───────────────────────────────────────────────────────────
// Gentle, longer cross-dissolve so switching between a dark "space" page and a
// light page eases through the midtones instead of slamming black↔white.
const pageTransition = {
  duration: 0.34,
  ease: [0.4, 0, 0.2, 1] as const,
};

// ─── Main layout ───────────────────────────────────────────────────────────────
export function TabLayout() {
  const [activeTab, setActiveTab] = useState("home");

  const navigate = useCallback((tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Drives the backdrop + text treatment. Space pages show the dark
  // SpaceBackground; light pages show the white overlay + shooting stars.
  const isSpace = SPACE_TABS.has(activeTab);

  function renderSection() {
    switch (activeTab) {
      case "home":         return <HeroSection />;
      case "problem":      return <ProblemSection />;
      case "shift":        return <ShiftSection />;
      case "how-it-works": return <HowItWorksSection />;
      case "community":    return <CommunitySection />;
      case "research":     return <ResearchSection />;
      case "story":        return <StorySection />;
      default:             return <HeroSection />;
    }
  }

  return (
    <NavigateContext value={navigate}>
      <TabNav
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={navigate}
        onEarlyAccess={() => navigate("shift")}
      />

      {/* Dark deep-space backdrop. Always mounted at the very back; on light
          pages it is hidden by the white overlay below (cheaper than mounting/
          unmounting the animated starfield on every tab switch). */}
      <SpaceBackground />

      {/* White overlay lives OUTSIDE AnimatePresence — the CSS opacity
          transition stops the dark backdrop from flashing through during page
          changes. Opaque on light pages, fully transparent on space pages. */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: "#FFFFFF",
          opacity: isSpace ? 0 : 1,
          // Slow, eased fade — the key softener for dark↔light page changes so
          // the backdrop glides through grey instead of hitting the eyes.
          transition: "opacity 0.6s ease-in-out",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 35% 60% at -5% 40%, rgba(123,47,190,0.06) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 35% 60% at 105% 40%, rgba(0,196,122,0.06) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background:
              "linear-gradient(90deg, rgba(123,47,190,0.30) 0%, rgba(10,186,181,0.20) 50%, rgba(0,196,122,0.30) 100%)",
          }}
        />
      </div>

      {/* Shooting stars streak across the light content pages only. */}
      <ShootingStars active={!isSpace} />

      <div style={{ paddingTop: "var(--nav-height, 56px)", position: "relative", zIndex: 1 }}>
        {/* Cross-fade between tabs.

            Deliberately NOT `AnimatePresence mode="wait"`: with variant-based
            exits, the outgoing page's exit animation could fail to report
            completion, and because "wait" holds the incoming child until that
            happens, the app got stuck showing whichever section was mounted
            first — every tab click updated state and changed nothing on screen.

            Keying the motion.div on activeTab gives the same cross-fade (the
            new section mounts and fades in) with no dependency on an exit
            lifecycle that can stall. */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={pageTransition}
        >
          {renderSection()}
        </motion.div>
      </div>
    </NavigateContext>
  );
}
