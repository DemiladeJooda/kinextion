"use client";

/**
 * The three measurements the site couldn't answer before.
 *
 *   Which tab converts   → tab_view, plus waitlist_submit carrying its source
 *   Where people drop    → tab_dwell and scroll_depth per tab
 *   Does the demo help   → chat_demo_* events, tied to the same session
 *
 * Mounted once inside TabLayout and driven by the active tab, so every section
 * is measured without any section having to know it's being measured.
 */

import { useEffect, useRef } from "react";
import { track, trackSessionStart } from "@/lib/analytics";

/** Depth marks, in percent. Coarse on purpose — a continuous scroll stream is
 *  a lot of rows to answer a question that has four useful answers. */
const DEPTH_MARKS = [25, 50, 75, 100];

export function PageAnalytics({ tab }: { tab: string }) {
  const enteredAt = useRef<number>(Date.now());
  const reached = useRef<Set<number>>(new Set());

  // Guarded inside the helper: a mount effect alone would count page loads
  // rather than sessions, since a reload remounts but keeps the session id.
  useEffect(() => {
    trackSessionStart();
  }, []);

  useEffect(() => {
    enteredAt.current = Date.now();
    reached.current = new Set();
    track("tab_view", tab);

    return () => {
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      // Sub-second switches are someone finding their way, not reading.
      if (seconds >= 1) track("tab_dwell", tab, { seconds });
    };
  }, [tab]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // A page that doesn't scroll has no depth to report.
      if (scrollable < 200) return;

      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const mark of DEPTH_MARKS) {
        if (percent >= mark && !reached.current.has(mark)) {
          reached.current.add(mark);
          track("scroll_depth", tab, { percent: mark });
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab]);

  return null;
}
