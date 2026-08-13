"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
const SURVEY_URL = "https://docs.google.com/forms/d/1HGHbA5ClONIySoOE-lcQ5EQ-ovgHkQNVi7E4nF-StAs/preview";


// ─── Research sources ─────────────────────────────────────────────────────────
const SOURCES = [
  {
    id: "atomic-habits",
    type: "Book",
    color: "#00C47A",
    title: "Atomic Habits",
    author: "James Clear",
    year: "2018",
    publisher: "Avery / Penguin Random House",
    topic: "Habit Formation",
    tagline: "Identity-based consistency outperforms motivation-based goals by every measurable metric.",
    keyFindings: [
      "\"You don't rise to the level of your goals, you fall to the level of your systems.\"",
      "\"Every action you take is a vote for the type of person you wish to become.\"",
      "Habits anchored to existing routines show 3× the 90-day retention vs. standalone commitments.",
      "A 1% improvement daily compounds to a 37× gain by the end of a year.",
    ],
    kinextionLink: "Powers Althea's habit-streak architecture, micro-recommendation engine, and identity framing.",
  },
  {
    id: "why-we-sleep",
    type: "Book",
    color: "#3B82F6",
    title: "Why We Sleep",
    author: "Matthew Walker, PhD",
    year: "2017",
    publisher: "Scribner",
    topic: "Sleep Science",
    tagline: "Sleep is the single most effective thing you can do to reset your brain and body each day.",
    keyFindings: [
      "After 17–19 hours without sleep, performance equals someone who is legally drunk.",
      "\"The shorter your sleep, the shorter your life.\" — sleep deprivation raises cancer, Alzheimer's, and diabetes risk.",
      "Adults sleeping fewer than 6 hours/night are 4× more likely to catch a cold when exposed to a rhinovirus.",
      "Deep NREM consolidates motor memory; REM processes emotional memory — both happen only in sleep.",
    ],
    kinextionLink: "Drives Kinextion's sleep-staging priority signal — HRV coaching starts here.",
  },
  {
    id: "harvard-study",
    type: "Longitudinal Study",
    color: "#A855F7",
    title: "Harvard Study of Adult Development",
    author: "Robert Waldinger et al.",
    year: "1938 – present",
    publisher: "Harvard Medical School / JAMA Psychiatry",
    topic: "Social Health",
    tagline: "The longest-running happiness study ever conducted — 85+ years, one clear answer.",
    keyFindings: [
      "\"Good relationships keep us happier and healthier. Period.\" — 85 years, 724 men tracked.",
      "Loneliness was the strongest predictor of cognitive decline in old age — ahead of cholesterol and blood pressure.",
      "People most satisfied in their relationships at age 50 were the healthiest at age 80.",
      "Social isolation in midlife is as harmful to health as smoking 15 cigarettes a day.",
    ],
    kinextionLink: "The scientific backbone of Kinextion's pod model and AI-guided accountability loop.",
  },
  {
    id: "christakis-2007",
    type: "Peer-Reviewed Study",
    color: "#0ABAB5",
    title: "The Spread of Obesity in a Large Social Network over 32 Years",
    author: "Christakis & Fowler",
    year: "2007",
    publisher: "New England Journal of Medicine",
    topic: "Social Contagion",
    tagline: "Health behaviors spread through social networks with the same mechanics as infection.",
    keyFindings: [
      "If a close friend becomes obese, your own risk of obesity increases by 57%.",
      "Social influence on health behavior extends up to three degrees of separation in a network.",
      "Exercise habits, eating patterns, smoking cessation, and happiness all spread through social graphs.",
      "The effect is strongest when behavior is mutually visible — peers who regularly see each other.",
    ],
    kinextionLink: "Why pods are matched by goal alignment — the same network dynamics that spread poor habits accelerate good ones.",
  },
  {
    id: "outlive",
    type: "Book",
    color: "#F59E0B",
    title: "Outlive: The Science and Art of Longevity",
    author: "Peter Attia, MD",
    year: "2023",
    publisher: "Harmony Books",
    topic: "Longevity Medicine",
    tagline: "Longevity medicine must begin decades before the onset of disease — not after diagnosis.",
    keyFindings: [
      "VO₂ max is the single most powerful predictor of longevity — more than smoking status or blood pressure.",
      "The lowest VO₂ max quintile carries 5× the all-cause mortality risk of the highest quintile.",
      "Zone 2 aerobic training builds mitochondrial density — the cellular machinery of energy and longevity.",
      "Muscle mass in your 70s predicts independence and fall risk. You build it in your 30s — or you don't.",
    ],
    kinextionLink: "Grounds Althea's training load calibration and HRV-based readiness framework.",
  },
  {
    id: "holt-lunstad-2015",
    type: "Meta-Analysis",
    color: "#EC4899",
    title: "Loneliness and Social Isolation as Risk Factors for Mortality",
    author: "Holt-Lunstad et al.",
    year: "2015",
    publisher: "Perspectives on Psychological Science",
    topic: "Isolation & Mortality",
    tagline: "Social isolation is a greater mortality risk than obesity, physical inactivity, or air pollution.",
    keyFindings: [
      "Social isolation increases premature mortality risk by 26% — equivalent to smoking 15 cigarettes per day.",
      "The analysis covered 3.4 million people across 148 independent studies — the largest review of its kind.",
      "The health burden of loneliness surpasses well-established risks including obesity and inactivity.",
      "Subjective loneliness (feeling alone) is equally damaging as objective isolation — perception matters.",
    ],
    kinextionLink: "Quantifies why the pod is not a feature — it's a health infrastructure decision.",
  },
  {
    id: "fogg-tiny-habits",
    type: "Book",
    color: "#EF4444",
    title: "Tiny Habits",
    author: "BJ Fogg, PhD (Stanford Behavior Design Lab)",
    year: "2019",
    publisher: "Houghton Mifflin Harcourt",
    topic: "Behavior Design",
    tagline: "Motivation is an unreliable foundation for behavior change. Design for the day it fails.",
    keyFindings: [
      "Behavior = Motivation × Ability × Prompt. If any one factor hits zero, the behavior doesn't happen.",
      "Willpower is finite and unreliable — designing around its absence is more effective than relying on it.",
      "Celebration immediately after a behavior fires a neural reward that rewires the circuit for repetition.",
      "The most durable habits are 'anchor habits' — tiny actions anchored to existing, reliable routines.",
    ],
    kinextionLink: "The design logic behind Kinextion's morning brief, check-in timing, and streak architecture.",
  },
  {
    id: "nummenmaa-2014",
    type: "Peer-Reviewed Study",
    color: "#8B5CF6",
    title: "Bodily Maps of Emotions",
    author: "Nummenmaa et al.",
    year: "2014",
    publisher: "Proceedings of the National Academy of Sciences (PNAS)",
    topic: "Emotion & Biology",
    tagline: "Emotions produce consistent, measurable physiological changes — mappable, predictable, and readable.",
    keyFindings: [
      "Across cultures, specific emotions activate identical body regions — anger in the chest, depression deactivates limbs.",
      "Bodily sensations are not symptoms of emotion — they are constitutive of it.",
      "Physiological emotion signals (HRV, skin conductance, temperature) can be read without self-report.",
      "The body's emotional response often precedes conscious emotional awareness by several seconds.",
    ],
    kinextionLink: "The science behind why Kairo checks your physical signals before asking how you're feeling.",
  },
  {
    id: "mcgonigal-2011",
    type: "Book",
    color: "#EC4899",
    title: "The Willpower Instinct",
    author: "Kelly McGonigal, PhD (Stanford)",
    year: "2011",
    publisher: "Avery / Penguin",
    topic: "Self-Regulation",
    tagline: "Willpower isn't a virtue — it's a physiological resource that depletes, and HRV is the measure of it.",
    keyFindings: [
      "Heart rate variability (HRV) is the biological marker of willpower capacity — low HRV means low reserves.",
      "Chronic stress degrades willpower and self-compassion simultaneously — the double bind of burnout.",
      "Self-compassion after failure predicts better long-term behavior change than self-criticism or guilt.",
      "Surfing the urge — observing without acting — outperforms white-knuckling restraint for lasting change.",
    ],
    kinextionLink: "The reason Kairo responds to a missed day with curiosity rather than pressure — and it's measurable.",
  },
  {
    id: "hari-2018",
    type: "Book",
    color: "#F59E0B",
    title: "Lost Connections",
    author: "Johann Hari",
    year: "2018",
    publisher: "Bloomsbury Publishing",
    topic: "Belonging & Mental Health",
    tagline: "Depression and anxiety are not malfunctions — they are signals of unmet human needs.",
    keyFindings: [
      "Nine root causes of depression and anxiety were identified — seven are social and environmental, not biological.",
      "Disconnection from meaningful work, community, and nature are primary drivers of chronic low wellbeing.",
      "Social prescribing — using community as medicine — shows outcomes equivalent to antidepressants in 6-month trials.",
      "Reconnection to people, purpose, and values produces lasting change where medication alone does not.",
    ],
    kinextionLink: "Grounds Kairo's role: not a chat feature — a reconnection mechanism for the people who've gone quiet.",
  },
  {
    id: "loehr-schwartz-2003",
    type: "Book",
    color: "#0ABAB5",
    title: "The Power of Full Engagement",
    author: "Jim Loehr & Tony Schwartz",
    year: "2003",
    publisher: "Free Press / Simon & Schuster",
    topic: "Energy Management",
    tagline: "High performance is built on managing energy, not time — and recovery is the other half of performance.",
    keyFindings: [
      "Physical, emotional, mental, and spiritual energy must all be managed — optimizing one without the others fails.",
      "Elite performers train their capacity for stress AND their capacity for recovery in equal deliberate measure.",
      "Human beings are designed to oscillate between effort and recovery — chronic stress without recovery creates decline.",
      "Highly engaged people disengage fully and regularly — strategic rest is the engine of sustainable output.",
    ],
    kinextionLink: "The design logic behind Althea pushing and Kairo recovering — the oscillation IS the system.",
  },
  {
    id: "plews-2012",
    type: "Peer-Reviewed Study",
    color: "#EF4444",
    title: "Heart Rate Variability in Elite Endurance Performance",
    author: "Plews et al.",
    year: "2012",
    publisher: "International Journal of Sports Physiology and Performance",
    topic: "HRV & Training Readiness",
    tagline: "HRV-guided training outperforms fixed periodization by adapting to the athlete's actual daily readiness.",
    keyFindings: [
      "Daily HRV monitoring produced 11% greater VO₂ max gains vs. traditional fixed training loads.",
      "Athletes pushed hard on high-readiness days and recovered on low ones — net performance compounded.",
      "HRV decline precedes illness and overtraining by 24–48 hours — the earliest warning signal available.",
      "Intraindividual HRV change is more predictive of readiness than absolute HRV values across athletes.",
    ],
    kinextionLink: "The foundation of Althea's daily load decisions — every session is HRV-contextualized, not calendar-driven.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
export function ResearchSection() {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [activeSource,  setActiveSource]  = useState<string | null>(null);
  const [treeSeen,      setTreeSeen]      = useState(false);

  const displaySource = hoveredSource ?? activeSource ?? "atomic-habits";
  const sourceData    = SOURCES.find((s) => s.id === displaySource) ?? SOURCES[0];


  return (
    <section className="tab-section">
      <div className="section-container relative z-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mb-12">
          <p className="section-label" style={{ color: "#3B82F6" }}>Research & Evidence</p>
          <h2 className="font-bold mb-3 text-balance" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#0F172A" }}>
            We didn&apos;t guess.{" "}
            <span style={{ color: "#64748B" }}>We studied.</span>
          </h2>
          <p className="text-base max-w-2xl text-balance" style={{ color: "#475569" }}>
            Every feature in Kinextion is grounded in peer-reviewed research. Explore the science — interactively.
          </p>
        </motion.div>

        {/* ── Stats bar ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-28">
          {[
            { value: "12+", label: "Peer-reviewed studies referenced" },
            { value: "3",   label: "PhD advisors across disciplines"  },
            { value: "4",   label: "Academic institutions represented" },
            { value: "40+", label: "Years combined research expertise" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5 text-center" style={{ border: "1px solid rgba(59,130,246,0.12)" }}>
              <p className="text-3xl font-extrabold mb-1" style={{ backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "#64748B" }}>{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ════════════════ GROWTH TREE — actual tree shape ════════════════ */}
        <div className="mb-36">
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}
            className="text-center mb-16">
            <p className="section-label mb-2" style={{ color: "#00C47A" }}>The Growth Tree</p>
            <h3 className="font-semibold" style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "#0F172A" }}>
              Every feature is part of one living system.
            </h3>
            <p className="text-sm mt-2 max-w-xl mx-auto text-balance" style={{ color: "#64748B" }}>
              From the signals Kinextion reads (roots) → through Althea &amp; Kairo&apos;s synthesis (trunk) → into features and coaching (branches) → to what you actually live (fruits).
            </p>
          </motion.div>

          {/* SVG Tree */}
          <motion.div
            className="relative mx-auto"
            style={{ maxWidth: 700, height: 590 }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            onViewportEnter={() => setTreeSeen(true)}
            transition={{ duration: 0.5 }}
          >
            <svg viewBox="0 0 700 590" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">

              {/* ── Ambient background glow ── */}
              <defs>
                <radialGradient id="treeGlow" cx="50%" cy="55%" r="48%">
                  <stop offset="0%" stopColor="rgba(0,196,122,0.07)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <radialGradient id="rootGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(10,186,181,0.05)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <ellipse cx="350" cy="295" rx="295" ry="220" fill="url(#treeGlow)" />
              <ellipse cx="350" cy="490" rx="250" ry="75" fill="url(#rootGlow)" />

              {/* ── ROOTS (data signals Kinextion reads) ── */}
              {treeSeen && (
                <>
                  <motion.line x1="350" y1="450" x2="350" y2="476"
                    stroke="#0ABAB5" strokeWidth="3" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }} />
                  <motion.path d="M350,464 Q282,476 218,486"
                    stroke="#0ABAB5" strokeWidth="2.5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.22, duration: 0.55 }} />
                  <motion.path d="M350,464 Q418,476 482,486"
                    stroke="#0ABAB5" strokeWidth="2.5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.22, duration: 0.55 }} />
                  <motion.path d="M218,486 Q168,496 130,505"
                    stroke="#0ABAB5" strokeWidth="2" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }} />
                  <motion.path d="M482,486 Q532,496 570,505"
                    stroke="#0ABAB5" strokeWidth="2" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }} />

                  {/* ── TRUNK — AI synthesis ── */}
                  <motion.line x1="350" y1="450" x2="350" y2="252"
                    stroke="#A855F7" strokeWidth="8" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.65, duration: 0.9, ease: "easeOut" }} />

                  {/* ── MAIN BRANCHES — features ── */}
                  <motion.path d="M350,290 Q290,260 218,232"
                    stroke="#3B82F6" strokeWidth="5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.22, duration: 0.58 }} />
                  <motion.path d="M350,290 Q410,260 482,232"
                    stroke="#3B82F6" strokeWidth="5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.22, duration: 0.58 }} />
                  <motion.path d="M350,340 Q280,315 192,300"
                    stroke="#3B82F6" strokeWidth="4" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.38, duration: 0.58 }} />
                  <motion.path d="M350,340 Q420,315 508,300"
                    stroke="#3B82F6" strokeWidth="4" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.38, duration: 0.58 }} />
                  <motion.line x1="350" y1="252" x2="350" y2="178"
                    stroke="#00C47A" strokeWidth="4" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.56, duration: 0.5 }} />

                  {/* ── SUB-BRANCHES — outcomes ── */}
                  <motion.path d="M350,186 Q315,163 270,138"
                    stroke="#00C47A" strokeWidth="3" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.86, duration: 0.48 }} />
                  <motion.path d="M350,186 Q385,163 430,138"
                    stroke="#00C47A" strokeWidth="3" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.86, duration: 0.48 }} />
                  <motion.line x1="350" y1="178" x2="350" y2="108"
                    stroke="#00C47A" strokeWidth="3" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.96, duration: 0.42 }} />
                  <motion.path d="M218,232 Q168,213 130,196"
                    stroke="#00C47A" strokeWidth="2.5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.96, duration: 0.45 }} />
                  <motion.path d="M482,232 Q532,213 570,196"
                    stroke="#00C47A" strokeWidth="2.5" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 1.96, duration: 0.45 }} />
                </>
              )}

              {/* ── ROOT ZONE LABELS ── */}
              {treeSeen && (
                <>
                  <motion.foreignObject x="224" y="433" width="252" height="28"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.5 }}>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                        style={{ background: "rgba(10,186,181,0.10)", border: "1px solid rgba(10,186,181,0.28)", color: "#0ABAB5" }}>
                        🌱 What Kinextion reads
                      </div>
                    </div>
                  </motion.foreignObject>

                  {/* 5 signal chips — spread across the root zone */}
                  {[
                    { x: 20,  y: 505, label: "Sleep & HRV"    },
                    { x: 143, y: 494, label: "Life Context"    },
                    { x: 292, y: 484, label: "Emotional State" },
                    { x: 436, y: 494, label: "Habit Patterns"  },
                    { x: 558, y: 505, label: "Pod Activity"    },
                  ].map((chip, i) => (
                    <motion.foreignObject key={chip.label} x={chip.x} y={chip.y} width="112" height="26"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.44 + i * 0.09, duration: 0.42 }}>
                      <div className="flex justify-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold"
                          style={{ background: "rgba(10,186,181,0.08)", border: "1px solid rgba(10,186,181,0.24)", color: "#0ABAB5" }}>
                          {chip.label}
                        </span>
                      </div>
                    </motion.foreignObject>
                  ))}
                </>
              )}

              {/* ── TRUNK LABEL — AI Synthesis ── */}
              {treeSeen && (
                <motion.foreignObject x="356" y="336" width="192" height="68"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0, duration: 0.5 }}>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                      style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.28)", color: "#A855F7" }}>
                      🧠 AI Synthesis
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 pl-1">
                    {["Althea", "Kairo"].map((g) => (
                      <span key={g}
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)", color: "#A855F7" }}>
                        {g}
                      </span>
                    ))}
                  </div>
                </motion.foreignObject>
              )}

              {/* ── BRANCH LABELS — Features ── */}
              {treeSeen && (
                <>
                  <motion.foreignObject x="12" y="248" width="175" height="60"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5, duration: 0.5 }}>
                    <div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold mb-1.5"
                        style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)", color: "#3B82F6" }}>
                        ⚡ Coaching
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {["Micro Coaching", "Your Shift"].map((label) => (
                          <span key={label}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", color: "#3B82F6" }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.foreignObject>

                  <motion.foreignObject x="513" y="248" width="180" height="60"
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.5, duration: 0.5 }}>
                    <div>
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold mb-1.5"
                        style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)", color: "#3B82F6" }}>
                        🌿 Experience
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {["Smart Referee", "Environment Design"].map((label) => (
                          <span key={label}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", color: "#3B82F6" }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.foreignObject>

                  <motion.foreignObject x="98" y="338" width="136" height="28"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 1.58, duration: 0.45 }}>
                    <div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"
                        style={{ background: "rgba(10,186,181,0.09)", border: "1px solid rgba(10,186,181,0.24)", color: "#0ABAB5" }}>
                        🫂 Community Pods
                      </span>
                    </div>
                  </motion.foreignObject>
                </>
              )}

              {/* ── CROWN / FRUITS — what you receive ── */}
              {treeSeen && (
                <>
                  <motion.foreignObject x="264" y="28" width="172" height="28"
                    initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.15, duration: 0.5 }}>
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(0,196,122,0.12)", border: "1px solid rgba(0,196,122,0.30)", color: "#00C47A" }}>
                        🍃 What You Receive
                      </div>
                    </div>
                  </motion.foreignObject>

                  {[
                    { x: 72,  y: 167, label: "Better Sleep",    w: 104 },
                    { x: 192, y: 110, label: "Consistency",     w: 100 },
                    { x: 304, y: 80,  label: "Longevity",       w: 92  },
                    { x: 412, y: 110, label: "Real Connection", w: 114 },
                    { x: 536, y: 167, label: "Self-Insight",    w: 100 },
                  ].map((fruit, i) => (
                    <motion.foreignObject key={fruit.label} x={fruit.x} y={fruit.y} width={fruit.w} height="28"
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2.24 + i * 0.1, type: "spring", stiffness: 300, damping: 18 }}>
                      <div className="flex justify-center">
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: "rgba(0,196,122,0.12)", border: "1.5px solid rgba(0,196,122,0.32)", color: "#00C47A", boxShadow: "0 0 10px rgba(0,196,122,0.12)" }}>
                          {fruit.label}
                        </span>
                      </div>
                    </motion.foreignObject>
                  ))}
                </>
              )}
            </svg>
          </motion.div>
        </div>

        {/* ════════════════ RESEARCH LIBRARY ════════════════ */}
        <div className="mb-36">
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }}
            className="text-center mb-14">
            <p className="section-label mb-2" style={{ color: "#A855F7" }}>The Source Material</p>
            <h3 className="font-semibold" style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "#0F172A" }}>
              The research that built this.
            </h3>
            <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "#64748B" }}>
              Books, peer-reviewed studies, and longitudinal data. Hover or click any source to read what it actually says.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_1.25fr] gap-6 items-start">

            {/* ── Source card grid ── */}
            <div className="grid grid-cols-2 gap-3">
              {SOURCES.map((src, i) => {
                const isActive = displaySource === src.id;
                return (
                  <motion.div key={src.id}
                    initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.055, duration: 0.35 }}
                    className="glass-card rounded-2xl p-4 cursor-pointer select-none relative overflow-hidden transition-all duration-200"
                    style={{
                      border: `1px solid ${isActive ? src.color + "55" : "rgba(0,0,0,0.07)"}`,
                      boxShadow: isActive ? `0 4px 24px ${src.color}18` : "none",
                      transform: isActive ? "translateY(-2px)" : "none",
                    }}
                    onMouseEnter={() => setHoveredSource(src.id)}
                    onMouseLeave={() => setHoveredSource(null)}
                    onClick={() => setActiveSource(src.id === activeSource ? null : src.id)}>

                    {/* Color accent bar */}
                    <motion.div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                      animate={{ opacity: isActive ? 1 : 0 }}
                      style={{ background: `linear-gradient(90deg, transparent, ${src.color}, transparent)` }} />

                    {/* Type + topic */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
                        style={{ background: `${src.color}12`, color: src.color, border: `1px solid ${src.color}22` }}>
                        {src.type}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-xs font-bold leading-snug mb-1"
                      style={{ color: isActive ? src.color : "#0F172A" }}>
                      {src.title}
                    </p>

                    {/* Author + year */}
                    <p className="text-[10px] leading-snug mb-2" style={{ color: "#64748B" }}>
                      {src.author} · {src.year}
                    </p>

                    {/* Topic chip */}
                    <span className="text-[9px] font-semibold" style={{ color: isActive ? src.color : "#94A3B8" }}>
                      {src.topic}
                    </span>

                    {isActive && (
                      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                        className="absolute bottom-0 left-4 right-4 h-px rounded-full"
                        style={{ background: src.color, transformOrigin: "left" }}
                        transition={{ duration: 0.3 }} />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* ── Detail reading panel ── */}
            <AnimatePresence>
              <motion.div key={displaySource}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}
                className="rounded-3xl overflow-hidden sticky top-6"
                style={{ border: `1px solid ${sourceData.color}22`, background: "#FFFFFF", boxShadow: `0 8px 40px ${sourceData.color}10` }}>

                {/* Panel header */}
                <div className="px-6 py-4 flex items-center gap-3"
                  style={{ background: `${sourceData.color}08`, borderBottom: `1px solid ${sourceData.color}16` }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sourceData.color }} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: sourceData.color }}>
                    {sourceData.type} · {sourceData.topic}
                  </span>
                  <span className="ml-auto text-[9px] font-semibold" style={{ color: "#94A3B8" }}>{sourceData.year}</span>
                </div>

                <div className="p-6">
                  {/* Title block */}
                  <div className="mb-5 pb-5" style={{ borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
                    <h4 className="font-bold text-lg leading-snug mb-1" style={{ color: "#0F172A" }}>
                      {sourceData.title}
                    </h4>
                    <p className="text-sm" style={{ color: "#64748B" }}>{sourceData.author}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>{sourceData.publisher}</p>
                  </div>

                  {/* Tagline */}
                  <p className="text-sm font-semibold italic leading-relaxed mb-6"
                    style={{ color: sourceData.color }}>
                    {sourceData.tagline}
                  </p>

                  {/* Key findings */}
                  <div className="mb-5">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] mb-3" style={{ color: "#94A3B8" }}>
                      Key findings
                    </p>
                    <div className="space-y-3">
                      {sourceData.keyFindings.map((finding, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: sourceData.color }} />
                          <p className="text-xs leading-relaxed" style={{ color: "#334155" }}>{finding}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Kinextion connection */}
                  <div className="rounded-xl p-4"
                    style={{ background: `${sourceData.color}08`, border: `1px solid ${sourceData.color}18` }}>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: sourceData.color }}>
                      How this informs Kinextion
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                      {sourceData.kinextionLink}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Survey CTA ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="glass-card-vivid p-8 max-w-2xl mx-auto mt-14 mb-32" style={{ border: "1px solid rgba(59,130,246,0.16)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)" }}>📋</div>
            <div className="flex-1">
              <h3 className="font-bold mb-1" style={{ color: "#0F172A" }}>Help shape the research</h3>
              <p className="text-sm" style={{ color: "#475569" }}>Share your wellness journey and struggles. Every response directly informs how we build Kinextion.</p>
            </div>
            <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-80"
              style={{ background: "rgba(59,130,246,0.08)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.24)" }}>
              Take the Survey <span className="text-sm">↗</span>
            </a>
          </div>
          <p className="text-[11px] mt-4" style={{ color: "#94A3B8" }}>Takes ~3 minutes. Fully anonymous.</p>
        </motion.div>

      </div>
    </section>
  );
}
