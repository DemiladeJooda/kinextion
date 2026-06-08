"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// The two AI guides. Althea is the body/plan coach; Kairo is the emotional listener.
export type Guide = "althea" | "kairo";

// ─── Per-guide branding (colours, emoji, copy) ────────────────────────────────
// Shared by the chat demo here and by the Solution page's "Today's Brief" popup.
export const guideConfig = {
  althea: {
    name: "Althea", role: "The Coach",
    color: "#00C47A", border: "rgba(0,196,122,0.22)",
    bg: "rgba(0,196,122,0.06)", msgBg: "rgba(0,196,122,0.07)",
    msgBorder: "rgba(0,196,122,0.20)", emoji: "⚡",
    tagline: "Reads your body. Adapts your plan.",
  },
  kairo: {
    name: "Kairo", role: "The Listener",
    color: "#A855F7", border: "rgba(168,85,247,0.22)",
    bg: "rgba(168,85,247,0.06)", msgBg: "rgba(168,85,247,0.07)",
    msgBorder: "rgba(168,85,247,0.20)", emoji: "🌊",
    tagline: "Reads your patterns. Understands your why.",
  },
};

// ─── Context cards — the live signals each guide is "seeing" right now ─────────
const contextCards: Record<Guide, { icon: string; label: string; details: string[]; badge: string; color: string }[]> = {
  althea: [
    {
      icon: "⌚", label: "Apple Watch",
      details: ["❤  72 BPM  ·  HRV 41ms  ↓ −27ms", "8,234 steps  ·  O₂ 97%  ·  Activity 62%", "5-day declining HRV trend"],
      badge: "LIVE", color: "#00C47A",
    },
    {
      icon: "💍", label: "Oura Ring",
      details: ["Sleep 71  ·  Readiness 68  ·  Deep 52min", "REM 18%  ·  Restless ×3  ·  Resp 15.4/min", "Recovery window: rest recommended"],
      badge: "LAST NIGHT", color: "#7B2FBE",
    },
    {
      icon: "📅", label: "This Week",
      details: ["⚠ Thu 9AM: Q3 Presentation", "👨‍👩‍👧 Fri 6PM: Parents arriving", "Strava: 5.4 mi Tue · Training: HIGH"],
      badge: "HIGH STAKES", color: "#3B82F6",
    },
  ],
  kairo: [
    {
      icon: "📱", label: "Behavior Signals",
      details: ["Screen: 14.2 h/day ↑40% vs avg", "Journal: 6 consecutive days silent", "Morning routine: delayed ×3 this week"],
      badge: "7 DAYS", color: "#EC4899",
    },
    {
      icon: "🧠", label: "Pattern Memory",
      details: ["Oct 2023: \"I shut down when overwhelmed\"", "Nov 2022: \"Family = I fall apart\"", "Match confidence: 82%  ·  3-year data"],
      badge: "ACTIVE", color: "#A855F7",
    },
    {
      icon: "💭", label: "Right Now",
      details: ["⚠ Q3 Presentation Thursday", "👨‍👩‍👧 Parents arriving Friday", "Kairo's read: carrying it alone"],
      badge: "SITUATION", color: "#7B2FBE",
    },
  ],
};

// ─── Scripted conversations — staged to play back message by message ───────────
const conversations: Record<Guide, { from: "user" | "ai"; text: string; delay: number }[]> = {
  althea: [
    {
      from: "ai", delay: 0,
      text: "Your Apple Watch flagged it overnight: HRV at 41ms — that's 27 points below your 68ms baseline, trending down 5 consecutive days. Oura confirms: 52 minutes of deep sleep, restless three times between 11PM and 2AM.\n\nI've already adjusted your training load. Your Q3 presentation is Thursday. Your parents arrive Friday. I'm not adding to what your body is already managing.\n\nTonight: 20-minute recovery walk. No metrics. Your peak window is Thursday afternoon — I'm saving your energy for when it counts.",
    },
    { from: "user", delay: 1400, text: "I feel like I'm failing by not pushing through." },
    {
      from: "ai", delay: 3000,
      text: "Your Strava shows 8 miles Tuesday. You've already done the work. Your Oura readiness is 68 — borderline. Three times in your history you pushed through low HRV before a high-stakes event. Three times your Thursday performance suffered.\n\nProtecting tonight's rest IS the high-performance decision. Your streak is alive. The work isn't lost — it's compounding.",
    },
    { from: "user", delay: 4800, text: "What about the food situation — family dinners this week are going to be heavy." },
    {
      from: "ai", delay: 6400,
      text: "Lean in. I've tracked your \"restart anxiety\" after social eating 7 times in 3 years — the guilt never justified itself. Protect breakfast protein tomorrow and you're right back on track.\n\nYour body needs restoration tonight, not restriction. Sleep before 10:30. I'll have your full readout waiting Thursday morning. 💪",
    },
  ],
  kairo: [
    {
      from: "ai", delay: 0,
      text: "Six days of journal silence. I've been watching quietly.\n\nYour screen time climbed to 14.2 hours this week — up 40% from your average. Your morning routine, the one you've kept for 23 consecutive days, broke three times. Messages are down 65%.\n\nThree years ago you wrote: \"I shut down emotionally when I'm overwhelmed. I disappear into my phone and call it productivity. I don't know how to ask for help.\"\n\nYou've grown since then. But right now — the pattern signatures are 82% identical. Thursday's presentation. Parents arriving Friday. I think you're carrying all of it alone. What's the loudest thing in your head?",
    },
    { from: "user", delay: 1600, text: "Honestly? I'm terrified the presentation is going to go badly. And then I have to deal with my family on top of that." },
    {
      from: "ai", delay: 3200,
      text: "That fear makes complete sense. Your Oura readiness is 68, HRV at 41ms — fear lands differently on an exhausted nervous system. Two high-stakes events in 48 hours and your body is already running a deficit.\n\nHere's what the data also says: you got up at 6AM three days this week with all of that weight on you. That isn't failure. That's resilience under the kind of pressure that makes most people disappear entirely.\n\nNovember 2022 — similar data signature, family incoming, work deadline. You wrote afterward: \"I don't know how I did it. But I did.\"\n\nI kept that note. You have this.",
    },
    { from: "user", delay: 5200, text: "I want to believe that." },
    {
      from: "ai", delay: 6800,
      text: "One ask — before anything else tonight. Ten minutes. Not productivity. Not prep. Just write one sentence about something from this week you're quietly proud of.\n\nYour nervous system needs a win before it can give more. Not because you earned it — because you need the resource.\n\nI'll check in Thursday morning before you walk in. 🌊",
    },
  ],
};

// Prompt chips for Althea vs Kairo — hint at how each guide is meant to be used.
const GUIDE_PROMPTS: Record<Guide, string[]> = {
  althea: ["What's my training load this week?", "How's my sleep affecting my energy?", "Should I push or recover today?"],
  kairo:  ["I'm feeling off this week", "Why can't I stay consistent?", "I'm stressed about something big"],
};

// GuideChatDemo — the staged "context → synthesis → conversation" animation for a
// single guide. Self-starting: the timeline replays whenever `guide` changes (e.g.
// when a card is flipped to reveal a different guide). Light-themed for use on the
// white How It Works page.
export function GuideChatDemo({ guide: activeGuide }: { readonly guide: Guide }) {
  const guide = guideConfig[activeGuide];
  const cards = contextCards[activeGuide];
  const convo = conversations[activeGuide];

  // Playback state: how many context cards are in, whether the orb is "thinking",
  // how many chat messages have appeared, and the (decorative) input field value.
  const [visibleCards, setVisibleCards]       = useState(0);
  const [showProcessing, setShowProcessing]   = useState(false);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [inputValue, setInputValue]           = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Drive the staged timeline: reveal cards one by one, show a processing beat,
  // then play the conversation message by message. Resets on guide change.
  useEffect(() => {
    setVisibleCards(0);
    setShowProcessing(false);
    setVisibleMessages(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    cards.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCards(i + 1), 400 + i * 550));
    });
    timers.push(setTimeout(() => setShowProcessing(true), 400 + cards.length * 550 + 300));
    const baseOffset = 400 + cards.length * 550 + 1200;
    convo.forEach((msg, i) => {
      timers.push(setTimeout(() => {
        setShowProcessing(false);
        setVisibleMessages(i + 1);
      }, baseOffset + msg.delay));
    });
    return () => timers.forEach(clearTimeout);
  }, [activeGuide, cards, convo]);

  // Keep the latest chat message in view as the conversation grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [visibleMessages]);

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-4">

      {/* LEFT — Context cards: the raw signals being read */}
      <div className="lg:w-64 lg:flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "#94A3B8" }}>
          What {guide.name} is seeing right now
        </p>
        <div className="flex flex-col gap-3">
          {cards.map((card, i) => (
            <motion.div
              key={`${activeGuide}-card-${i}`}
              initial={{ opacity: 0, x: -14 }}
              animate={visibleCards > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -14 }}
              transition={{ duration: 0.36 }}
              className="glass-card p-3.5"
              style={{ border: `1px solid ${card.color}20` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{card.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide flex-1" style={{ color: card.color }}>{card.label}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${card.color}10`, color: card.color, border: `1px solid ${card.color}22` }}>
                  {card.badge}
                </span>
              </div>
              <div className="space-y-1">
                {card.details.map((d, j) => (
                  <p key={j} className="text-[11px] leading-snug" style={{ color: "#475569" }}>{d}</p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CENTER — Guide orb: appears once all cards are in, then "synthesizes" */}
      <AnimatePresence>
        {visibleCards >= cards.length && (
          <motion.div
            key="orb"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-2 lg:flex-shrink-0 lg:w-20 lg:pt-10"
          >
            <div className="relative flex items-center justify-center">
              {showProcessing && (
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 76, height: 76, background: `${guide.color}12` }}
                  animate={{ scale: [1, 1.65, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
              <motion.div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl relative z-10"
                animate={showProcessing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={showProcessing ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }}
                style={{ background: guide.bg, border: `2px solid ${guide.border}` }}
              >
                {guide.emoji}
              </motion.div>
            </div>
            <AnimatePresence mode="wait">
              {showProcessing ? (
                <motion.p key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[10px] font-medium text-center" style={{ color: guide.color }}>
                  synthesizing…
                </motion.p>
              ) : visibleMessages > 0 ? (
                <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-1">
                  <p className="text-[9px] text-center" style={{ color: "#94A3B8" }}>{guide.name}</p>
                  <motion.div style={{ color: guide.color, fontSize: 14 }} animate={{ x: [0, 4, 0] }} transition={{ duration: 1.1, repeat: Infinity }}>→</motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT — Chat transcript */}
      <div className="lg:flex-1 lg:min-w-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: visibleMessages > 0 ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="glass-card-vivid overflow-hidden" style={{ border: `1px solid ${guide.border}` }}>
            {/* Chat header — guide identity + "knows you" badge */}
            <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ background: guide.bg, borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ background: `${guide.color}18`, border: `1px solid ${guide.color}35`, color: guide.color }}>
                {guide.emoji}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{guide.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: guide.color }} />
                  <span className="text-[10px] font-medium" style={{ color: guide.color }}>{guide.role}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${guide.color}10`, color: guide.color, border: `1px solid ${guide.color}20` }}>
                  knows you since day 1
                </span>
                <span className="text-[8px]" style={{ color: "#94A3B8" }}>{guide.tagline}</span>
              </div>
            </div>

            {/* Message list — plays back with a typing indicator between turns */}
            <AnimatePresence mode="wait">
              <motion.div key={activeGuide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 380, minHeight: 200 }}>
                {convo.slice(0, visibleMessages).map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.26 }} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} gap-2`}>
                    {msg.from === "ai" && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-1"
                        style={{ background: `${guide.color}14`, color: guide.color }}>{guide.emoji}</div>
                    )}
                    <div className="max-w-[86%] px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line"
                      style={msg.from === "user"
                        ? { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", color: "#0F172A", borderRadius: "14px 14px 3px 14px" }
                        : { background: guide.msgBg, border: `1px solid ${guide.msgBorder}`, color: "#0F172A", borderRadius: "3px 14px 14px 14px" }
                      }>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {visibleMessages < convo.length && visibleMessages > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0"
                      style={{ background: `${guide.color}14`, color: guide.color }}>{guide.emoji}</div>
                    <div className="px-3.5 py-2.5 flex items-center gap-1.5"
                      style={{ background: guide.msgBg, border: `1px solid ${guide.msgBorder}`, borderRadius: "3px 14px 14px 14px" }}>
                      {[0, 1, 2].map((d) => (
                        <motion.div key={d} className="w-1.5 h-1.5 rounded-full" style={{ background: guide.color }}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.8, delay: d * 0.18, repeat: Infinity }} />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </motion.div>
            </AnimatePresence>

            {/* Example prompts — surface once the scripted convo finishes */}
            {visibleMessages >= convo.length && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="px-4 pt-2 flex flex-wrap gap-1.5"
              >
                {GUIDE_PROMPTS[activeGuide].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInputValue(prompt)}
                    className="text-[10px] px-2.5 py-1 rounded-full transition-all duration-150 hover:scale-105"
                    style={{ background: `${guide.color}10`, border: `1px solid ${guide.color}28`, color: guide.color }}
                  >
                    {prompt}
                  </button>
                ))}
              </motion.div>
            )}

            {/* Decorative composer — illustrative only, not wired to a backend */}
            <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(0,0,0,0.07)", background: "rgba(248,250,252,0.8)" }}>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    activeGuide === "althea"
                      ? "Ask about your training, sleep, or this week's plan…"
                      : "Share what's on your mind, how you're feeling…"
                  }
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                  style={{ color: "#0F172A" }}
                />
                <button
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-105"
                  style={{ background: inputValue.trim() ? `linear-gradient(135deg, ${guide.color}, #0ABAB5)` : "rgba(0,0,0,0.06)", color: inputValue.trim() ? "#fff" : "#94A3B8" }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22 11 13 2 9l20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p className="text-[9px] mt-1" style={{ color: "#94A3B8" }}>
                Powered by real Claude AI in the full app · this is an illustration
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
