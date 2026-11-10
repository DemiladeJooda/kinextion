"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TabNav } from "./TabNav";
import { NavigateContext } from "./navigation-context";
import { ChatContext, type GuideId } from "@/components/chat/chat-context";
import { GuideConversation } from "@/components/chat/GuideConversation";
import { HeroSection } from "@/components/sections/HeroSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { ShiftSection } from "@/components/sections/ShiftSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { CommunitySection } from "@/components/sections/CommunitySection";
import { ResearchSection } from "@/components/sections/ResearchSection";
import { StorySection } from "@/components/sections/StorySection";
import { SpaceBackground } from "@/components/aurora/SpaceBackground";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PageAnalytics } from "@/components/analytics/PageAnalytics";

export { NavigateContext, useNavigate } from "./navigation-context";

export const TABS = [
  { id: "home", label: "Home" },
  { id: "problem", label: "The Problem" },
  { id: "shift", label: "The Solution" },
  { id: "how-it-works", label: "Your Guides" },
  { id: "community", label: "Community" },
  { id: "research", label: "How It Works" },
  { id: "story", label: "Our Story" },
];

/** The pages that end with the early-access form. */
const SIGNUP_TABS = new Set(["shift", "how-it-works"]);

export function TabLayout() {
  const [activeTab, setActiveTab] = useState("home");
  const [chatGuide, setChatGuide] = useState<GuideId | null>(null);

  const navigate = useCallback((tab: string) => setActiveTab(tab), []);

  // After the new page has committed, or the browser keeps the old offset.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);

  const openChat = useCallback((guide: GuideId = "altheo") => setChatGuide(guide), []);
  const closeChat = useCallback(() => setChatGuide(null), []);

  // The nav button goes to the form on this page, or to the Solution page's.
  const goToEarlyAccess = useCallback(() => {
    const scroll = () => {
      const target = document.getElementById("early-access");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.querySelector<HTMLInputElement>('input[type="email"]')?.focus({ preventScroll: true });
    };
    if (SIGNUP_TABS.has(activeTab)) {
      scroll();
      return;
    }
    setActiveTab("shift");
    window.setTimeout(scroll, 450);
  }, [activeTab]);

  function renderSection() {
    switch (activeTab) {
      case "problem":
        return <ProblemSection />;
      case "shift":
        return <ShiftSection />;
      case "how-it-works":
        return <HowItWorksSection />;
      case "community":
        return <CommunitySection />;
      case "research":
        return <ResearchSection />;
      case "story":
        return <StorySection />;
      default:
        return <HeroSection />;
    }
  }

  return (
    <NavigateContext value={navigate}>
      <ChatContext value={openChat}>
        <PageAnalytics tab={activeTab} />

        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={navigate}
          onEarlyAccess={goToEarlyAccess}
          onTalk={() => openChat()}
        />

        <SpaceBackground />

        <div className="relative z-[1] text-white" style={{ paddingTop: "var(--nav-height, 56px)" }}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            {renderSection()}
          </motion.div>

          <SiteFooter />
        </div>

        <AnimatePresence>
          {chatGuide ? <GuideConversation initialGuide={chatGuide} onClose={closeChat} /> : null}
        </AnimatePresence>
      </ChatContext>
    </NavigateContext>
  );
}
