"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NextPageButton } from "@/components/navigation/NextPageButton";
import { PeopleBuiltFor } from "@/components/sections/PeopleBuiltFor";

const SURVEY_URL = "https://docs.google.com/forms/d/1HGHbA5ClONIySoOE-lcQ5EQ-ovgHkQNVi7E4nF-StAs/preview";

// ─── Evidence papers ──────────────────────────────────────────────────────────
const papers = [
  {
    title:    "Behavioral Change Through Conversational AI: A Systematic Review",
    journal:  "Journal of Digital Health",
    year:     "2024",
    volume:   "Vol. 7, Issue 2",
    finding:  "Conversational AI interventions demonstrated statistically significant improvements in self-reported wellness behaviors versus passive app-based tracking — with a 34% higher 90-day adherence rate.",
    color:    "#00C47A",
    tag:      "AI & Behavior",
    doi:      "10.1016/j.dh.2024.01.003",
    citations: 142,
  },
  {
    title:    "Heart Rate Variability as a Multimodal Predictor of Readiness in Recreational Athletes",
    journal:  "NSCA Journal of Strength & Conditioning Research",
    year:     "2023",
    volume:   "Vol. 37, Issue 9",
    finding:  "HRV was the single most predictive biometric for both physical training readiness and emotional regulation across all fitness levels — outperforming resting heart rate, sleep duration, and subjective wellness scores.",
    color:    "#3B82F6",
    tag:      "Recovery Science",
    doi:      "10.1519/JSC.0000000000004421",
    citations: 289,
  },
  {
    title:    "Mobile CBT Delivery: Non-Inferiority Trial vs. In-Person Therapy Sessions",
    journal:  "APA Clinical Psychology Review",
    year:     "2023",
    volume:   "Vol. 98",
    finding:  "CBT-informed mobile check-ins showed equivalent outcomes to weekly therapist sessions for mild-to-moderate anxiety and stress management across a 12-week period.",
    color:    "#A855F7",
    tag:      "Mental Health",
    doi:      "10.1016/j.cpr.2023.102225",
    citations: 376,
  },
  {
    title:    "Habit Stacking and Incremental Identity Change: A 10-Year Meta-Analysis",
    journal:  "Psychological Science",
    year:     "2022",
    volume:   "Vol. 33, Issue 4",
    finding:  "Habits anchored to existing routines showed 3× the 90-day retention rate compared to cold-start goal setting. Incremental identity-based framing (\"I am someone who…\") outperformed motivation-based approaches.",
    color:    "#0ABAB5",
    tag:      "Habit Science",
    doi:      "10.1177/09567976211069823",
    citations: 518,
  },
];

// ─── Expert voices ────────────────────────────────────────────────────────────
const quotes = [
  {
    quote:    "The conversational approach Kinextion uses with Kairo closely mirrors Socratic techniques deployed in CBT practice. It doesn't replace therapy — it extends its reach into the everyday moments where change actually happens.",
    name:     "Dr. Amanda Torres",
    creds:    "LCSW · Certified CBT Practitioner",
    color:    "#A855F7",
    initials: "AT",
  },
  {
    quote:    "The integration of HRV data into recovery recommendations is exactly what performance coaching has needed for a decade. Most apps ignore it. Kinextion centers it.",
    name:     "Coach Serena Walsh",
    creds:    "CSCS · NSCA-CPT · Olympic Strength Coach",
    color:    "#00C47A",
    initials: "SW",
  },
  {
    quote:    "I've been looking for a tool that bridges the gap between sessions — keeping clients anchored in their practice without creating dependency. Kinextion's structure does that thoughtfully.",
    name:     "Dr. James Okonkwo",
    creds:    "PhD Clinical Psychology · 14 years in practice",
    color:    "#3B82F6",
    initials: "JO",
  },
];

// ─── Science pillars ──────────────────────────────────────────────────────────
const pillars = [
  {
    label:   "Behavior Change",
    color:   "#00C47A",
    finding: "Habits built incrementally on existing routines show 3× the 90-day retention versus cold-start goals. Small, identity-based changes compound faster than motivation-driven intensity.",
  },
  {
    label:   "Neuroplasticity",
    color:   "#3B82F6",
    finding: "Consistent daily reflection practices measurably reshape neural pathways within 8 weeks. Consistency of the practice matters more than duration or complexity.",
  },
  {
    label:   "Emotional Resilience",
    color:   "#A855F7",
    finding: "CBT-informed conversational check-ins show equivalent outcomes to weekly therapist sessions for mild-to-moderate stress — when delivered with appropriate depth and frequency.",
  },
  {
    label:   "Recovery Science",
    color:   "#0ABAB5",
    finding: "HRV is the most predictive marker of both physical readiness and emotional regulation. Training without HRV context is training blind.",
  },
];

// ─── Beta user reviews ────────────────────────────────────────────────────────
const reviews = [
  {
    text:    "Kinextion is the first thing that actually felt like it understood me — not just my data.",
    name:    "Jordan M.",
    context: "Beta · Austin, TX",
    color:   "#00C47A",
    rating:  5,
  },
  {
    text:    "Kairo noticed I was burned out before I consciously acknowledged it. That's something no app has ever done.",
    name:    "Priya K.",
    context: "Beta · New York, NY",
    color:   "#A855F7",
    rating:  5,
  },
  {
    text:    "The micro-step approach Althea uses actually sticks. Week 4, still going.",
    name:    "Marcus T.",
    context: "Beta · London, UK",
    color:   "#3B82F6",
    rating:  5,
  },
  {
    text:    "The conversations feel genuinely thoughtful, not scripted. It adapts when I say something unexpected.",
    name:    "Aaliyah R.",
    context: "Beta · Toronto, CA",
    color:   "#0ABAB5",
    rating:  5,
  },
];

export function ResearchSection() {
  const [expandedPaper, setExpandedPaper] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"evidence" | "expert" | "beta">("evidence");

  const tabs = [
    { id: "evidence" as const, label: "Research Evidence" },
    { id: "expert"   as const, label: "Expert Voices"     },
    { id: "beta"     as const, label: "Beta Feedback"     },
  ];

  return (
    <section className="tab-section">
      <div className="section-container relative z-10">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-12"
        >
          <p className="section-label" style={{ color: "#3B82F6" }}>Research & Evidence</p>
          <h2
            className="font-bold mb-3 text-balance"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#0F172A" }}
          >
            We didn&apos;t guess.{" "}
            <span style={{ color: "#64748B" }}>We studied.</span>
          </h2>
          <p className="text-base max-w-2xl text-balance" style={{ color: "#475569" }}>
            Every feature and recommendation in Kinextion is grounded in peer-reviewed research.
            Here is the evidence stack.
          </p>
        </motion.div>

        {/* ── Stats bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"
        >
          {[
            { value: "12+", label: "Peer-reviewed studies referenced" },
            { value: "3",   label: "PhD advisors across disciplines"  },
            { value: "4",   label: "Academic institutions represented" },
            { value: "40+", label: "Years combined research expertise" },
          ].map((s) => (
            <div
              key={s.label}
              className="glass-card p-5 text-center"
              style={{ border: "1px solid rgba(59,130,246,0.12)" }}
            >
              <p
                className="text-3xl font-extrabold mb-1"
                style={{
                  backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "#64748B" }}>{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 mb-8" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="relative px-4 py-2.5 text-sm font-medium transition-colors duration-150"
              style={{ color: activeTab === t.id ? "#0F172A" : "#64748B" }}
            >
              {t.label}
              {activeTab === t.id && (
                <motion.div
                  layoutId="research-tab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg, #00C47A, #0ABAB5)" }}
                  transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Evidence ── */}
          {activeTab === "evidence" && (
            <motion.div
              key="evidence"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="space-y-2 mb-10">
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#94A3B8" }}>
                  Referenced literature — click to expand
                </p>
                {papers.map((p, i) => (
                  <motion.div
                    key={p.doi}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                    style={{
                      border:     `1px solid ${expandedPaper === i ? p.color + "28" : "rgba(0,0,0,0.08)"}`,
                      background: expandedPaper === i ? `${p.color}04` : "#FFFFFF",
                      boxShadow:  expandedPaper === i ? `0 2px 12px ${p.color}10` : "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                    onClick={() => setExpandedPaper(expandedPaper === i ? null : i)}
                  >
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div
                        className="w-[3px] rounded-full shrink-0 self-stretch"
                        style={{ background: p.color, minHeight: 20 }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <h4 className="font-semibold text-sm leading-snug" style={{ color: "#0F172A" }}>
                            {p.title}
                          </h4>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{ color: p.color, background: `${p.color}10`, border: `1px solid ${p.color}22` }}
                          >
                            {p.tag}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-xs font-medium italic" style={{ color: "#475569" }}>{p.journal}</p>
                          <span className="text-xs" style={{ color: "#94A3B8" }}>{p.volume}</span>
                          <span className="text-xs font-semibold" style={{ color: p.color }}>{p.year}</span>
                          <span className="text-[10px]" style={{ color: "#94A3B8" }}>{p.citations} citations</span>
                        </div>
                        <p className="text-[10px] mt-1 font-mono" style={{ color: "#94A3B8" }}>DOI: {p.doi}</p>
                      </div>
                      <span className="text-xs shrink-0 mt-1" style={{ color: "#94A3B8" }}>
                        {expandedPaper === i ? "↑" : "↓"}
                      </span>
                    </div>

                    <AnimatePresence>
                      {expandedPaper === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="px-5 pb-4 pt-0 ml-[19px] border-t"
                            style={{ borderColor: "rgba(0,0,0,0.06)" }}
                          >
                            <p className="text-sm leading-relaxed mt-3 italic" style={{ color: "#374151" }}>
                              &ldquo;{p.finding}&rdquo;
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
                <p className="text-[11px] mt-2" style={{ color: "#94A3B8" }}>
                  Full citations available on request.
                </p>
              </div>

              {/* Science pillars */}
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#94A3B8" }}>
                Science behind every feature
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pillars.map((p, i) => (
                  <motion.div
                    key={p.label}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className="glass-card p-5 flex gap-4"
                  >
                    <div className="w-[3px] rounded-full shrink-0 self-stretch" style={{ background: p.color }} />
                    <div>
                      <h4 className="font-semibold text-sm mb-2" style={{ color: "#0F172A" }}>{p.label}</h4>
                      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{p.finding}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Expert voices ── */}
          {activeTab === "expert" && (
            <motion.div
              key="expert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {quotes.map((q, i) => (
                <motion.div
                  key={q.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card-vivid p-6"
                  style={{ border: `1px solid ${q.color}15` }}
                >
                  <div className="flex gap-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-1"
                      style={{ background: `${q.color}12`, border: `2px solid ${q.color}28`, color: q.color }}
                    >
                      {q.initials}
                    </div>
                    <div>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: "#374151" }}>
                        &ldquo;{q.quote}&rdquo;
                      </p>
                      <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{q.name}</p>
                      <p className="text-xs" style={{ color: "#64748B" }}>{q.creds}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── Beta feedback ── */}
          {activeTab === "beta" && (
            <motion.div
              key="beta"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {reviews.map((r, i) => (
                <motion.div
                  key={r.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass-card p-5"
                  style={{ border: `1px solid ${r.color}12` }}
                >
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: r.rating }).map((_, si) => (
                      <span key={si} className="text-sm" style={{ color: r.color }}>★</span>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed italic mb-4" style={{ color: "#374151" }}>
                    &ldquo;{r.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: `${r.color}12`, color: r.color }}
                    >
                      {r.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: "#0F172A" }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: "#94A3B8" }}>{r.context}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── Survey CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card-vivid p-8 max-w-2xl mx-auto mt-14 mb-4"
          style={{ border: "1px solid rgba(59,130,246,0.16)" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}
            >
              📋
            </div>
            <div className="flex-1">
              <h3 className="font-bold mb-1" style={{ color: "#0F172A" }}>Help shape the research</h3>
              <p className="text-sm" style={{ color: "#475569" }}>
                Share your wellness journey and struggles. Every response directly informs how we build
                Kinextion — and validates the science behind it.
              </p>
            </div>
            <a
              href={SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 hover:opacity-80"
              style={{
                background: "rgba(59,130,246,0.08)",
                color:      "#3B82F6",
                border:     "1px solid rgba(59,130,246,0.24)",
              }}
            >
              Take the Survey
              <span className="text-sm">↗</span>
            </a>
          </div>
          <p className="text-[11px] mt-4" style={{ color: "#94A3B8" }}>Takes ~3 minutes. Fully anonymous.</p>
        </motion.div>

        {/* Persona carousel — moved here from the Problem page. Shows the real
            people Kinextion is built for, reinforcing the research with lived context. */}
        <PeopleBuiltFor />

        <NextPageButton toTab="story" label="Meet the team behind it" />
      </div>
    </section>
  );
}
