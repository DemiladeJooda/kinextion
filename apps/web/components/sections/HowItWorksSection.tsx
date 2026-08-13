"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { SIGNAL_CATEGORIES, category, type CategoryId } from "@/lib/signal-taxonomy";
import { useNavigate } from "@/components/navigation/navigation-context";

// ─── Guide data ───────────────────────────────────────────────────────────────
const altheaTraits = [
  { label: "Direct",     desc: "No fluff. Tells you what you need to hear." },
  { label: "Data-first", desc: "Every recommendation comes from your real numbers." },
  { label: "Adaptive",   desc: "Changes your plan when life changes." },
  { label: "Relentless", desc: "Finds a way to keep you moving, even on bad days." },
];

const kairoTraits = [
  { label: "Patient",    desc: "Never rushes you. Meets you where you are." },
  { label: "Perceptive", desc: "Notices what you didn't say, not just what you did." },
  { label: "Grounded",   desc: "Practical techniques, not empty affirmations." },
  { label: "Present",    desc: "Shows up consistently, especially when things are hard." },
];

const metrics = [
  { label: "HRV",    value: "68",  unit: "ms",   trend: "+4",  color: "#00C47A" },
  { label: "Streak", value: "12",  unit: "days", trend: "↑",   color: "#0ABAB5" },
  { label: "Steps",  value: "7.4", unit: "k",    trend: "+8%", color: "#3B82F6" },
];


// ─── Taxonomy signal data ─────────────────────────────────────────────────────
// Every row is tagged with a category id from the shared taxonomy; colour and
// icon are looked up rather than duplicated, so these rows can never drift out
// of sync with the Solution page's orbit rings.
//
// This list is deliberately the *deeper cut* — the sensitive, human signals a
// visitor won't have seen orbiting on the Solution page. Same five buckets,
// next level of detail: that continuity is the point.
type TaxonomyRow = {
  readonly signal: string;
  readonly source: string;
  readonly cat: CategoryId;
  readonly why: string;
};

const TAXONOMY_PRIORITY: readonly TaxonomyRow[] = [
  { signal: "Biological sex",        source: "Onboarding",            cat: "body",    why: "Training science differences — strength curves, recovery rates, body comp, hormonal context." },
  { signal: "Chronic conditions",    source: "Voluntary",             cat: "body",    why: "Hard constraint filter — diabetes, hypertension, cardiovascular issues change what's safe." },
  { signal: "Medications",           source: "Voluntary",             cat: "body",    why: "SSRIs, beta blockers, ADHD stimulants all measurably affect energy, sleep, and heart rate baselines." },
  { signal: "Pregnancy / postpartum / menopause", source: "Onboarding + ongoing", cat: "body", why: "Each is a distinct multi-month physiological state with specific training and emotional needs." },
  { signal: "Eating disorder history", source: "Voluntary",           cat: "mind",    why: "Critical guardrail — disclosed history permanently changes how the system discusses weight and food." },
  { signal: "Mental health diagnoses", source: "Voluntary",           cat: "mind",    why: "Changes how Kairo engages and where escalation ceilings sit. Out of scope to treat; in scope to know." },
  { signal: "Neurodivergence",       source: "Voluntary",             cat: "mind",    why: "~15–20% of users. Different scheduling, language, streak handling, and decision support needed." },
  { signal: "Past program history",  source: "App log + self-report", cat: "habits",  why: "The system should recognize a returning user, remember what worked, skip the generic Day 1 experience." },
  { signal: "Caregiving status",     source: "Onboarding + ongoing",  cat: "context", why: "Caregivers operate at structurally reduced capacity. Caregiving measurably increases mortality risk." },
  { signal: "Notification response pattern", source: "App telemetry", cat: "world",   why: "Which forms of nudge work for this user — rotates style based on what's actually landing." },
];

const TAXONOMY_IMPORTANT: readonly TaxonomyRow[] = [
  { signal: "Chronotype",            source: "Self-report",           cat: "body",    why: "Genuinely biological, not preference. Forcing a 6am workout on a true night chronotype fights biology." },
  { signal: "Sleep latency",         source: "Wearable",              cat: "body",    why: "Chronically long latency points to anxiety/rumination — different intervention than short total sleep." },
  { signal: "Job satisfaction",      source: "Periodic check-in",     cat: "mind",    why: "Top chronic stressor that wellness apps systematically ignore. Naming it is validating and accurate." },
  { signal: "Bereavement / major loss", source: "Conversation",       cat: "mind",    why: "Bereavement is a documented major health stressor. Anniversaries should be flagged for softer treatment." },
  { signal: "Music listening patterns", source: "Spotify / Apple Music opt-in", cat: "mind", why: "Music taste shifts are a real mood barometer — swings into numbing genres precede emotional shifts." },
  { signal: "Cultural background",   source: "Onboarding (optional)", cat: "habits",  why: "Carries distinct upbringing, family, food, communication norms that shape coaching effectiveness." },
  { signal: "Shift work / irregular schedule", source: "Onboarding",  cat: "context", why: "Requires fundamentally different circadian and recovery protocols than standard apps assume." },
  { signal: "Work hours per week",   source: "Self-report",           cat: "context", why: "65-hour weeks are a structural reality, not a discipline problem. Capacity input." },
  { signal: "Workspace ergonomics",  source: "Self-report",           cat: "context", why: "Most desk-worker chronic pain is ergonomic, not training-related. Higher-leverage than stretches." },
  { signal: "Geographic latitude / season", source: "GPS + calendar", cat: "world",   why: "Users at high latitudes have meaningfully different winter circadian challenges." },
];

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    id: "referee",
    icon: "📱",
    name: "Smart Referee",
    tagline: "Your phone becomes the official.",
    color: "#00C47A",
    glow: "rgba(0,196,122,0.25)",
    badge: "Live Now",
    desc: "Prop your phone up and let Kinextion watch your pickleball match, 3-point shootout, or pick-up game. It reads the court, keeps score, calls the faults — and every single call can be opened up to see exactly what it saw.",
    bullets: [
      "Reads the live court and keeps the score",
      "Fault and foul calls with the evidence attached",
      "Tap 11–3 to see how each point was won",
      "Pickleball, tennis, shootout, and pick-up",
      "Disagree with a call? Overturn it in one tap",
    ],
  },
  {
    id: "micro",
    icon: "⚡",
    name: "Micro Recommendations",
    tagline: "1% better. Every single day.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.22)",
    badge: "Core Feature",
    desc: "Forget generic tips. Kinextion delivers one precise, context-aware improvement each day — matched to your actual life, your current state, and where you are in your journey.",
    bullets: [
      "Context-aware — knows your HRV, sleep, and schedule",
      "Micro-sized so they actually happen",
      "Compounds daily into massive change",
      "Adapts when your life shifts",
      "No overwhelm. Just one thing.",
    ],
  },
  {
    id: "form",
    icon: "🏋️",
    name: "Form Control",
    tagline: "Perfect reps. Every time.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.22)",
    badge: "Live Now",
    desc: "Point your phone at yourself and Kinextion watches the set — scoring each checkpoint out of ten, flagging the rep where your knees caved or your back rounded, and showing you exactly what it saw to make that call.",
    bullets: [
      "Per-checkpoint scores, not a vague thumbs up",
      "Squat depth, knee tracking, spine position",
      "Tells you what it saw, not just what's wrong",
      "Stretch range-of-motion measured against last time",
      "Haptics on every correction, so you never look up",
    ],
  },
  {
    id: "environment",
    icon: "🌿",
    name: "Environment Design",
    tagline: "Your space, calibrated to your state.",
    color: "#0ABAB5",
    glow: "rgba(10,186,181,0.20)",
    badge: "Live Now",
    desc: "Point your phone at the room you're actually in. Kinextion reads the light, the clutter, the screens, and what your body needs right now — then tells you the two or three things to change, and why each one matters for the state you're trying to reach.",
    bullets: [
      "Reads your real room from a single photo",
      "Recovery, deep focus, and pre-workout modes",
      "Specific fixes, ranked by how much they'll help",
      "Lighting temperature and tempo targets per state",
      "Every call comes with the reason behind it",
    ],
  },
  {
    id: "more",
    icon: "🚀",
    name: "More Coming Soon",
    tagline: "We're just getting started.",
    color: "#3B82F6",
    glow: "rgba(59,130,246,0.18)",
    badge: "In Development",
    desc: "Kinextion is building a full ecosystem — from wearable deep integration to pod-based accountability challenges. The roadmap goes far. These are the seeds.",
    bullets: [
      "Wearable deep integration (Apple Watch, Oura)",
      "Pod accountability challenges",
      "AI-generated workout programming",
      "Voice-first daily briefs with Althea",
      "Community milestone events",
    ],
  },
] as const;

// ─── Environment mode states (used by the Environment Design feature animation) ─
const ENV_MODES = [
  {
    label: "Recovery Mode",
    icon: "🌙",
    color: "#F59E0B",
    ambientBg: "rgba(251,146,60,0.13)",
    glowColor: "rgba(251,191,36,0.55)",
    music: "Low Light — Sub Focus",
    musicSub: "72 BPM · Ambient",
    light: "Warm 2700K · 30%",
    trigger: "HRV low · elevated cortisol",
    triggerColor: "#EF4444",
  },
  {
    label: "Deep Focus",
    icon: "🎯",
    color: "#3B82F6",
    ambientBg: "rgba(59,130,246,0.10)",
    glowColor: "rgba(96,165,250,0.52)",
    music: "Music For Airports — Brian Eno",
    musicSub: "Ambient · No lyrics",
    light: "Cool White 4500K · 65%",
    trigger: "Q3 review: Thursday 9am",
    triggerColor: "#3B82F6",
  },
  {
    label: "Pre-Workout",
    icon: "⚡",
    color: "#00C47A",
    ambientBg: "rgba(0,196,122,0.10)",
    glowColor: "rgba(0,196,122,0.55)",
    music: "Power Hour — Workout Mix",
    musicSub: "128 BPM · High Energy",
    light: "Daylight 6500K · 100%",
    trigger: "HRV 74ms · sleep quality high",
    triggerColor: "#00C47A",
  },
] as const;

// ─── App hand-off ─────────────────────────────────────────────────────────────
/**
 * Where each feature lives inside the mobile app.
 *
 * Keys match FEATURES[].id; "more" is intentionally absent (it's a roadmap
 * card, not a shipped screen), which is what drives whether the CTA renders.
 */
const APP_SCREENS: Record<string, { where: string; note: string } | undefined> = {
  referee: { where: "Today → Smart Referee", note: "Camera-based. Bring a friend and a court." },
  micro: { where: "Today → Micro Recommendation", note: "Generated live, from your actual day." },
  form: { where: "Today → Form Control", note: "Front camera. Works best propped at hip height." },
  environment: { where: "Today → Environment Design", note: "Point it at the room you're in." },
};

/**
 * Store links.
 *
 * Empty until the app is published — the CTA falls back to the early-access
 * flow rather than shipping a dead link. Set these in the environment once
 * TestFlight / Play Console listings exist.
 */
const IOS_URL = process.env.NEXT_PUBLIC_IOS_APP_URL ?? "";
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? "";

function TryInAppCTA({
  color,
  screen,
}: {
  readonly color: string;
  readonly screen: { where: string; note: string };
}) {
  const navigate = useNavigate();
  const hasStoreLink = Boolean(IOS_URL || ANDROID_URL);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mt-7 rounded-2xl p-4"
      style={{ background: `${color}0A`, border: `1px solid ${color}26` }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold mb-0.5" style={{ color: "#0F172A" }}>
            This one lives in the app
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>
            <span style={{ color, fontWeight: 600 }}>{screen.where}</span> · {screen.note}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3.5">
        {hasStoreLink ? (
          <>
            {IOS_URL ? (
              <a
                href={IOS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold px-4 py-2 rounded-full transition-transform duration-150 hover:scale-105"
                style={{ background: color, color: "#FFFFFF" }}
              >
                Try it on iPhone
              </a>
            ) : null}
            {ANDROID_URL ? (
              <a
                href={ANDROID_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold px-4 py-2 rounded-full transition-transform duration-150 hover:scale-105"
                style={{ background: `${color}14`, border: `1px solid ${color}33`, color }}
              >
                Try it on Android
              </a>
            ) : null}
          </>
        ) : (
          // No store listing yet — send them somewhere real instead of nowhere.
          <button
            onClick={() => navigate("shift")}
            className="text-xs font-bold px-4 py-2 rounded-full transition-transform duration-150 hover:scale-105 cursor-pointer"
            style={{ background: color, color: "#FFFFFF" }}
          >
            Get early access to the app →
          </button>
        )}
      </div>
    </motion.div>
  );
}

type SubTab = "guides" | "system" | "features";

// ─────────────────────────────────────────────────────────────────────────────
export function HowItWorksSection() {
  const [subTab, setSubTab]               = useState<SubTab>("guides");
  const [pillarsReady, setPillarsReady]   = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [featureLocked, setFeatureLocked] = useState(false); // true after user clicks — pauses auto-advance
  const [activeTaxTab, setActiveTaxTab]   = useState<"priority" | "important">("priority");
  const [hoveredTax, setHoveredTax]       = useState<number | null>(null);
  const [envModeIdx, setEnvModeIdx]       = useState(0);

  // Mouse tracking for VS page parallax
  const containerRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const smX  = useSpring(rawX, { stiffness: 50, damping: 20 });
  const smY  = useSpring(rawY, { stiffness: 50, damping: 20 });
  const althParX = useTransform(smX, [0, 1], [-22, 8]);
  const althParY = useTransform(smY, [0, 1], [-10, 10]);
  const kairParX = useTransform(smX, [0, 1], [-8, 22]);
  const kairParY = useTransform(smY, [0, 1], [-10, 10]);
  const lightX   = useTransform(smX, [0, 1], ["20%", "80%"]);
  const lightY   = useTransform(smY, [0, 1], ["20%", "80%"]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - r.left) / r.width);
    rawY.set((e.clientY - r.top) / r.height);
  }, [rawX, rawY]);

  // System tab entrance
  useEffect(() => {
    if (subTab !== "system") return;
    setPillarsReady(false);
    const t = setTimeout(() => setPillarsReady(true), 300);
    return () => clearTimeout(t);
  }, [subTab]);

  // Features tab auto-advance — only while user hasn't clicked; 12 s between shifts
  useEffect(() => {
    if (subTab !== "features" || featureLocked) return;
    const interval = setInterval(() => setActiveFeature((s) => (s + 1) % FEATURES.length), 12000);
    return () => clearInterval(interval);
  }, [subTab, featureLocked]);

  // Re-enable auto-advance 18 s after the last user click
  useEffect(() => {
    if (!featureLocked) return;
    const timer = setTimeout(() => setFeatureLocked(false), 18000);
    return () => clearTimeout(timer);
  }, [featureLocked]);

  // Environment Design mode cycling — 3 states at 2.8s each (fits within 9s auto-advance)
  useEffect(() => {
    if (subTab !== "features" || activeFeature !== 3) return;
    setEnvModeIdx(0);
    const t = setInterval(() => setEnvModeIdx((i) => (i + 1) % ENV_MODES.length), 2800);
    return () => clearInterval(t);
  }, [subTab, activeFeature]);

  const subTabs: { id: SubTab; label: string; color: string; hint: string }[] = [
    { id: "guides",   label: "Your Guides",  color: "#00C47A", hint: "Althea & Kairo"      },
    { id: "system",   label: "The System",   color: "#3B82F6", hint: "How AI thinks"       },
    { id: "features", label: "Features",     color: "#A855F7", hint: "What you get"        },
  ];

  return (
    <section className="tab-section">
      <div className="section-container relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="section-label" style={{ color: "#0ABAB5" }}>How It Works</p>
          <h2 className="font-semibold mb-4 text-balance" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#0F172A" }}>
            Two guides. One system.{" "}
            <span style={{ color: "#64748B" }}>Working in harmony.</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto text-balance" style={{ color: "#475569" }}>
            Every layer of Kinextion feeds into the next — becoming more personalized over time.
          </p>
        </motion.div>

        {/* Sub-tab selector */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3 max-w-xl mx-auto mb-14"
        >
          {subTabs.map((t) => {
            const isActive = subTab === t.id;
            return (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className="relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl text-center transition-all duration-200 cursor-pointer"
                style={{
                  background: isActive ? `${t.color}08` : "rgba(0,0,0,0.03)",
                  border:     isActive ? `1.5px solid ${t.color}35` : "1.5px solid rgba(0,0,0,0.08)",
                  boxShadow:  isActive ? `0 0 16px ${t.color}12` : "none",
                  transform:  isActive ? "translateY(-2px)" : "translateY(0)",
                }}>
                <span className="text-xs font-bold" style={{ color: isActive ? t.color : "#64748B" }}>{t.label}</span>
                <span className="text-[10px]" style={{ color: "#94A3B8" }}>{t.hint}</span>
                <motion.div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                  animate={{ scaleX: isActive ? 1 : 0, opacity: isActive ? 1 : 0 }}
                  style={{ background: t.color, transformOrigin: "left" }} transition={{ duration: 0.3 }} />
              </button>
            );
          })}
        </motion.div>

        {/* Content */}
        <AnimatePresence>

          {/* ══ GUIDES — Mortal Kombat VS page ══ */}
          {subTab === "guides" && (
            <motion.div key="guides" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>

              {/* VS Arena */}
              <div
                ref={containerRef}
                onMouseMove={onMouseMove}
                className="relative rounded-3xl overflow-hidden mb-8"
                style={{
                  background: "linear-gradient(135deg, #060C18 0%, #0D1525 50%, #060C18 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minHeight: 520,
                }}
              >
                {/* Animated background beam from mouse */}
                <motion.div className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse 60% 60% at ${lightX} ${lightY}, rgba(10,186,181,0.06) 0%, transparent 70%)`,
                  }}
                />

                {/* Arena floor glow line */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(0,196,122,0.4), rgba(168,85,247,0.4), transparent)" }} />

                {/* Corner flares */}
                <div className="pointer-events-none absolute top-0 left-0 w-40 h-40"
                  style={{ background: "radial-gradient(circle at top left, rgba(0,196,122,0.12) 0%, transparent 60%)" }} />
                <div className="pointer-events-none absolute top-0 right-0 w-40 h-40"
                  style={{ background: "radial-gradient(circle at top right, rgba(168,85,247,0.12) 0%, transparent 60%)" }} />

                {/* Centre mark. This used to read "VS" over a "Select your
                    guide" caption — an arcade character-select screen, on a
                    page about how a wellness system treats you. The two guides
                    are not opponents and you do not pick one; they share
                    context and both adapt. An ampersand is the accurate mark. */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
                  <motion.div
                    animate={{ opacity: [0.75, 1, 0.75] }}
                    transition={{ duration: 3.6, repeat: Infinity }}
                    className="text-4xl font-light"
                    style={{
                      background: "linear-gradient(135deg, #00C47A 0%, #FFFFFF 50%, #A855F7 100%)",
                      WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 18px rgba(255,255,255,0.25))",
                    }}
                  >&amp;</motion.div>
                  <div className="text-[9px] uppercase tracking-[0.22em] mt-1.5 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.32)" }}>
                    Two ways of being helped
                  </div>
                </div>

                {/* Center vertical divider */}
                <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-px"
                  style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0.14) 70%, transparent)" }} />

                {/* Grid layout */}
                <div className="grid grid-cols-2 min-h-[520px]">

                  {/* ── ALTHEA (left) ── */}
                  <motion.div style={{ x: althParX, y: althParY }} className="relative flex flex-col p-8 lg:p-10">
                    {/* Character name plate */}
                    <motion.div
                      initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                      className="mb-6"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-px flex-1" style={{ background: "linear-gradient(to right, #00C47A50, transparent)" }} />
                        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#00C47A" }}>The Coach</span>
                      </div>
                      <motion.h3
                        className="font-semibold tracking-[-0.035em] leading-[0.95]"
                        style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", color: "#FFFFFF" }}
                        animate={{ textShadow: ["0 0 20px rgba(0,196,122,0.3)", "0 0 40px rgba(0,196,122,0.5)", "0 0 20px rgba(0,196,122,0.3)"] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        Althea
                      </motion.h3>
                      <p className="text-sm font-bold mt-1" style={{ color: "#00C47A" }}>Health Companion</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>Direct · evidence-led · relentless</p>
                    </motion.div>

                    {/* Fighting style / traits */}
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                      className="space-y-3 mb-6"
                    >
                      <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.30)" }}>
                        How Althea works
                      </p>
                      {altheaTraits.map((trait, i) => (
                        <motion.div key={trait.label}
                          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.09 }}
                          className="flex items-start gap-2.5"
                        >
                          <motion.div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: "#00C47A" }}
                            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
                            transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
                          />
                          <div>
                            <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>{trait.label} </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>— {trait.desc}</span>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Live stats / power bar */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                      className="mt-auto"
                    >
                      <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.30)" }}>A day Althea would read</p>
                      <div className="space-y-2">
                        {metrics.map((m, i) => (
                          <div key={m.label} className="flex items-center gap-2">
                            <span className="text-[10px] w-10 shrink-0" style={{ color: "rgba(255,255,255,0.45)" }}>{m.label}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: m.color }}
                                initial={{ width: 0 }}
                                animate={{ width: ["55%", "80%", "68%"][i] }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 1.2, ease: "easeOut" }}
                              />
                            </div>
                            <span className="text-[10px] font-bold shrink-0" style={{ color: m.color }}>
                              {m.value}{m.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Ability badge */}
                      <motion.div
                        className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(0,196,122,0.10)", border: "1px solid rgba(0,196,122,0.25)" }}
                        animate={{ boxShadow: ["0 0 10px rgba(0,196,122,0.1)", "0 0 22px rgba(0,196,122,0.3)", "0 0 10px rgba(0,196,122,0.1)"] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      >
                        <span className="text-xs">⚡</span>
                        <span className="text-[11px] font-bold" style={{ color: "#00C47A" }}>Rewrites the plan when the day changes</span>
                      </motion.div>
                    </motion.div>

                    {/* Corner accent */}
                    <div className="pointer-events-none absolute top-4 left-4 w-8 h-8"
                      style={{
                        borderTop: "2px solid rgba(0,196,122,0.45)",
                        borderLeft: "2px solid rgba(0,196,122,0.45)",
                      }} />
                    <div className="pointer-events-none absolute bottom-4 left-4 w-8 h-8"
                      style={{
                        borderBottom: "2px solid rgba(0,196,122,0.45)",
                        borderLeft: "2px solid rgba(0,196,122,0.45)",
                      }} />
                  </motion.div>

                  {/* ── KAIRO (right) ── */}
                  <motion.div style={{ x: kairParX, y: kairParY }} className="relative flex flex-col p-8 lg:p-10 items-end text-right">
                    {/* Character name plate */}
                    <motion.div
                      initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                      className="mb-6 w-full"
                    >
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#A855F7" }}>The Listener</span>
                        <div className="h-px flex-1" style={{ background: "linear-gradient(to left, #A855F750, transparent)" }} />
                      </div>
                      <motion.h3
                        className="font-semibold tracking-[-0.035em] leading-[0.95]"
                        style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", color: "#FFFFFF" }}
                        animate={{ textShadow: ["0 0 20px rgba(168,85,247,0.3)", "0 0 40px rgba(168,85,247,0.5)", "0 0 20px rgba(168,85,247,0.3)"] }}
                        transition={{ duration: 3.2, repeat: Infinity }}
                      >
                        Kairo
                      </motion.h3>
                      <p className="text-sm font-bold mt-1" style={{ color: "#A855F7" }}>Wellness Guide</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>Patient · perceptive · present</p>
                    </motion.div>

                    {/* Traits */}
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                      className="space-y-3 mb-6 w-full"
                    >
                      <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.30)" }}>
                        How Kairo works
                      </p>
                      {kairoTraits.map((trait, i) => (
                        <motion.div key={trait.label}
                          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.09 }}
                          className="flex items-start gap-2.5 justify-end"
                        >
                          <div>
                            <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>{trait.label} </span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>— {trait.desc}</span>
                          </div>
                          <motion.div
                            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: "#A855F7" }}
                            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
                            transition={{ duration: 2.2 + i * 0.3, repeat: Infinity }}
                          />
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Mood pattern */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                      className="mt-auto w-full"
                    >
                      <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.30)" }}>A week Kairo would read</p>
                      <div className="flex items-end gap-1 h-12 mb-3">
                        {[4, 5, 3, 6, 4, 7, 6].map((h, i) => (
                          <motion.div key={i} className="flex-1 rounded-t"
                            initial={{ height: 0 }} animate={{ height: `${h * 14}%` }}
                            transition={{ delay: 0.6 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                            style={{ background: i === 5 ? "#A855F7" : "rgba(168,85,247,0.25)", minHeight: 4 }} />
                        ))}
                      </div>
                      <div className="flex justify-between mb-3">
                        {["M","T","W","T","F","S","S"].map((d, i) => (
                          <span key={i} className="flex-1 text-center text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{d}</span>
                        ))}
                      </div>

                      <motion.div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.25)" }}
                        animate={{ boxShadow: ["0 0 10px rgba(168,85,247,0.1)", "0 0 22px rgba(168,85,247,0.3)", "0 0 10px rgba(168,85,247,0.1)"] }}
                        transition={{ duration: 2.8, repeat: Infinity }}
                      >
                        <span className="text-xs">🌊</span>
                        <span className="text-[11px] font-bold" style={{ color: "#A855F7" }}>Reads the pattern before you name it</span>
                      </motion.div>
                    </motion.div>

                    {/* Corner accent */}
                    <div className="pointer-events-none absolute top-4 right-4 w-8 h-8"
                      style={{ borderTop: "2px solid rgba(168,85,247,0.45)", borderRight: "2px solid rgba(168,85,247,0.45)" }} />
                    <div className="pointer-events-none absolute bottom-4 right-4 w-8 h-8"
                      style={{ borderBottom: "2px solid rgba(168,85,247,0.45)", borderRight: "2px solid rgba(168,85,247,0.45)" }} />
                  </motion.div>
                </div>

                {/* Bottom bar.
                    Previously two "HP" meters filled to 92% and 88% — numbers
                    that measured nothing, presented in the visual language of
                    data. Invented statistics are the fastest way to make
                    everything real on a page look invented too. What actually
                    connects the two columns is the shared context line, so
                    that is what the bar says now. */}
                <div className="absolute bottom-0 left-0 right-0 px-8 py-3.5 flex items-center justify-center gap-4"
                  style={{ background: "rgba(0,0,0,0.35)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="hidden sm:block h-px flex-1"
                    style={{ background: "linear-gradient(to right, transparent, rgba(0,196,122,0.35))" }} />
                  <span className="text-[10px] uppercase tracking-[0.2em] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                    One shared memory
                  </span>
                  <span className="hidden sm:block h-px flex-1"
                    style={{ background: "linear-gradient(to left, transparent, rgba(168,85,247,0.35))" }} />
                </div>
              </div>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="text-center text-sm mt-4" style={{ color: "#64748B" }}>
                Althea and Kairo share context — so when stress shows up, both guides adapt.
              </motion.p>
            </motion.div>
          )}

          {/* ══ SYSTEM ══ */}
          {subTab === "system" && (
            <motion.div key="system" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>

              {/* ── Taxonomy ── */}
              <motion.div initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: pillarsReady ? 1 : 0, y: pillarsReady ? 0 : 18 }} transition={{ delay: 0.9 }}
                className="mb-20">
                <div className="text-center mb-8">
                  <p className="section-label mb-2" style={{ color: "#A855F7" }}>Signal Taxonomy</p>
                  <h3 className="font-semibold" style={{ fontSize: "clamp(1.4rem, 2.8vw, 1.9rem)", color: "#0F172A" }}>
                    What Kinextion knows about you — and why it matters.
                  </h3>
                  <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "#64748B" }}>
                    Same five categories you saw orbiting on the Solution page — this is
                    the next layer down. The signals here are the sensitive ones, and
                    almost all of them are yours to volunteer. Hover any row for the reason.
                  </p>
                </div>

                {/* Category legend — the bridge back to the Solution page's orbit
                    rings. Same order, same colours, same icons, so a visitor
                    recognises the grouping instead of re-learning it. */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                  {SIGNAL_CATEGORIES.map((c) => (
                    <div key={c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{ background: `${c.color}0D`, border: `1px solid ${c.color}26` }}>
                      <span className="text-[11px]">{c.icon}</span>
                      <span className="text-[11px] font-bold" style={{ color: c.color }}>{c.label}</span>
                    </div>
                  ))}
                </div>

                {/* Tab toggle */}
                <div className="flex gap-1 mb-8 max-w-xs mx-auto p-1 rounded-2xl" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)" }}>
                  {([
                    { id: "priority" as const, label: "Priority Signals", color: "#00C47A" },
                    { id: "important" as const, label: "Also Important", color: "#3B82F6" },
                  ]).map((t) => (
                    <button key={t.id} onClick={() => setActiveTaxTab(t.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer"
                      style={{
                        background: activeTaxTab === t.id ? "#FFFFFF" : "transparent",
                        color: activeTaxTab === t.id ? t.color : "#94A3B8",
                        boxShadow: activeTaxTab === t.id ? "0 1px 8px rgba(0,0,0,0.08)" : "none",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  <motion.div key={activeTaxTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTaxTab === "priority" ? TAXONOMY_PRIORITY : TAXONOMY_IMPORTANT).map((row, i) => {
                        const isHov = hoveredTax === i;
                        const cat = category(row.cat);
                        return (
                          <motion.div key={row.signal}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="rounded-2xl p-4 cursor-pointer transition-all duration-200 group"
                            style={{
                              background: isHov ? `${cat.color}08` : "rgba(0,0,0,0.02)",
                              border: `1px solid ${isHov ? cat.color + "30" : "rgba(0,0,0,0.07)"}`,
                              boxShadow: isHov ? `0 0 18px ${cat.color}12` : "none",
                              transform: isHov ? "translateY(-2px)" : "none",
                            }}
                            onMouseEnter={() => setHoveredTax(i)}
                            onMouseLeave={() => setHoveredTax(null)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: cat.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-bold" style={{ color: "#0F172A" }}>{row.signal}</span>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0"
                                    style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}22`, color: cat.color }}>
                                    {row.source}
                                  </span>
                                  <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 transition-all duration-200"
                                    style={{
                                      background: `${cat.color}08`,
                                      color: isHov ? `${cat.color}BB` : `${cat.color}50`,
                                      border: `1px solid ${isHov ? cat.color + "28" : cat.color + "12"}`,
                                    }}>
                                    {cat.icon} {cat.label}
                                  </span>
                                </div>
                                <motion.p className="text-[11px] leading-relaxed"
                                  animate={{ opacity: isHov ? 1 : 0.55, height: isHov ? "auto" : "1.4em" }}
                                  transition={{ duration: 0.22 }}
                                  style={{ color: "#475569", overflow: "hidden" }}>
                                  {row.why}
                                </motion.p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* ── Data Transparency ── */}
              <div>
                <motion.div initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: pillarsReady ? 1 : 0, y: pillarsReady ? 0 : 18 }} transition={{ delay: 1.1 }}
                  className="text-center mb-8">
                  <p className="section-label mb-2" style={{ color: "#0ABAB5" }}>Transparency</p>
                  <h3 className="font-semibold" style={{ fontSize: "clamp(1.4rem, 2.8vw, 1.9rem)", color: "#0F172A" }}>Your data. Your rules.</h3>
                  <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "#64748B" }}>Radical transparency: what we collect, how we use it, and what you control.</p>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { icon: "🔐", title: "What we collect", color: "#3B82F6", items: ["Biometric data (HRV, sleep, steps)", "Emotional check-ins & mood logs", "Calendar events & deadlines", "Conversation transcripts", "Habit completions & streaks", "Goals you explicitly share"], note: "Collected only with your permission" },
                    { icon: "🧠", title: "How we use it", color: "#00C47A", items: ["Personalize every daily brief", "Detect patterns before you notice them", "Build predictive models (your data only)", "Calibrate Althea's training plans", "Inform Kairo's emotional check-ins", "Improve system accuracy over time"], note: "Never sold. Never used for ads." },
                    { icon: "🎛️", title: "What you control", color: "#A855F7", items: ["Delete any signal or all data", "Pause any integration at any time", "Opt out of 3-year memory", "Mute specific guidance types", "Export everything as JSON", "Full account deletion — instant"], note: "These aren't buried in settings" },
                  ].map((col, i) => (
                    <motion.div key={col.title}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: pillarsReady ? 1 : 0, y: pillarsReady ? 0 : 16 }}
                      transition={{ delay: 1.2 + i * 0.1, duration: 0.45 }}
                      className="glass-card-vivid p-6 rounded-2xl" style={{ border: `1px solid ${col.color}18` }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                          style={{ background: `${col.color}10`, border: `1px solid ${col.color}22` }}>{col.icon}</div>
                        <h4 className="font-bold text-sm" style={{ color: "#0F172A" }}>{col.title}</h4>
                      </div>
                      <div className="space-y-2 mb-4">
                        {col.items.map((item) => (
                          <div key={item} className="flex items-start gap-2 text-xs">
                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: col.color }} />
                            <span style={{ color: "#475569" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] italic px-2 py-1.5 rounded-lg"
                        style={{ color: col.color, background: `${col.color}08`, border: `1px solid ${col.color}18` }}>
                        {col.note}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ FEATURES ══ */}
          {subTab === "features" && (
            <motion.div key="features" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>

              <div className="text-center mb-12">
                <p className="section-label mb-2" style={{ color: "#A855F7" }}>Features</p>
                <h3 className="font-semibold text-balance" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.4rem)", color: "#0F172A" }}>
                  Tools built for the real game.
                </h3>
                <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "#64748B" }}>
                  Not just tracking. Actual intelligence working for your actual life.
                </p>
              </div>

              {/* Feature selector pills */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {FEATURES.map((f, i) => (
                  <button key={f.id} onClick={() => { setActiveFeature(i); setFeatureLocked(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 cursor-pointer"
                    style={{
                      background: activeFeature === i ? `${f.color}12` : "rgba(0,0,0,0.03)",
                      border: `1.5px solid ${activeFeature === i ? f.color + "40" : "rgba(0,0,0,0.08)"}`,
                      boxShadow: activeFeature === i ? `0 0 16px ${f.color}18` : "none",
                    }}>
                    <span>{f.icon}</span>
                    <span className="text-sm font-bold" style={{ color: activeFeature === i ? f.color : "#64748B" }}>{f.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${f.color}15`, color: f.color, border: `1px solid ${f.color}25` }}>
                      {f.badge}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {FEATURES.map((feature, fi) => fi === activeFeature && (
                  <motion.div key={feature.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                    className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center max-w-4xl mx-auto mb-16">

                    {/* Left: detail */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <motion.div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                          animate={{ boxShadow: [`0 0 20px ${feature.color}20`, `0 0 40px ${feature.color}40`, `0 0 20px ${feature.color}20`] }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                          style={{ background: `${feature.color}10`, border: `1.5px solid ${feature.color}30` }}>
                          {feature.icon}
                        </motion.div>
                        <div>
                          <h4 className="font-semibold text-xl tracking-[-0.02em]" style={{ color: "#0F172A" }}>{feature.name}</h4>
                          <p className="text-sm font-medium" style={{ color: feature.color }}>{feature.tagline}</p>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed mb-6" style={{ color: "#475569" }}>{feature.desc}</p>

                      <div className="space-y-2.5">
                        {feature.bullets.map((b, i) => (
                          <motion.div key={b}
                            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-center gap-3">
                            <motion.div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: `${feature.color}12`, border: `1px solid ${feature.color}28` }}
                              animate={{ scale: [1, 1.08, 1] }} transition={{ delay: i * 0.15, duration: 2, repeat: Infinity }}>
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: feature.color }} />
                            </motion.div>
                            <span className="text-sm" style={{ color: "#374151" }}>{b}</span>
                          </motion.div>
                        ))}
                      </div>

                      {/* Hand-off to the app. Every feature that already has a
                          screen gets a direct pointer; the roadmap card doesn't. */}
                      {APP_SCREENS[feature.id] ? (
                        <TryInAppCTA
                          color={feature.color}
                          screen={APP_SCREENS[feature.id]!}
                        />
                      ) : null}
                    </div>

                    {/* Right: bespoke animated visual per feature */}
                    <motion.div
                      className="relative rounded-3xl overflow-hidden"
                      style={{
                        minHeight: 300,
                        background: `radial-gradient(ellipse 80% 80% at 50% 50%, ${feature.color}10 0%, rgba(0,0,0,0.03) 70%)`,
                        border: `1.5px solid ${feature.color}22`,
                      }}
                      animate={{ boxShadow: [`0 0 30px ${feature.color}08`, `0 0 60px ${feature.color}18`, `0 0 30px ${feature.color}08`] }}
                      transition={{ duration: 3, repeat: Infinity }}>

                      {/* ── Tennis court (referee) ── */}
                      {feature.id === "referee" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                          {/* Score */}
                          <div className="flex items-center gap-6 mb-5">
                            {[
                              { label: "YOU", score: 3, color: "#00C47A" },
                              { label: "OPP", score: 2, color: "#EF4444" },
                            ].map((p) => (
                              <div key={p.label} className="flex flex-col items-center gap-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.4)" }}>{p.label}</span>
                                <span className="text-4xl font-semibold tracking-[-0.03em] tabular-nums" style={{ color: p.color }}>{p.score}</span>
                              </div>
                            ))}
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.35)" }}>SET 1</span>
                              <motion.div className="w-2 h-2 rounded-full" style={{ background: "#00C47A" }}
                                animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                            </div>
                          </div>

                          {/* Court top-down view */}
                          <div className="relative w-full" style={{ height: 130 }}>
                            {/* Court outline */}
                            <div className="absolute inset-x-4 inset-y-0 rounded-sm"
                              style={{ border: "2px solid rgba(0,196,122,0.35)", background: "rgba(0,196,122,0.04)" }} />
                            {/* Net */}
                            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-px"
                              style={{ background: "rgba(0,0,0,0.25)", borderTop: "2px dashed rgba(0,0,0,0.18)" }} />
                            {/* Center service line */}
                            <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-px"
                              style={{ background: "rgba(0,196,122,0.20)" }} />

                            {/* Tennis ball bouncing side to side */}
                            <motion.div
                              className="absolute top-1/4 w-5 h-5 rounded-full flex items-center justify-center text-sm"
                              style={{ background: "#C8F037", boxShadow: "0 2px 8px rgba(200,240,55,0.5)" }}
                              animate={{ x: ["10%", "75%", "10%", "75%", "10%"] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
                            </motion.div>

                            {/* Player dots */}
                            <motion.div className="absolute w-3 h-3 rounded-full"
                              style={{ background: "#00C47A", bottom: 14, left: "20%" }}
                              animate={{ y: [0, -8, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
                            <motion.div className="absolute w-3 h-3 rounded-full"
                              style={{ background: "#EF4444", top: 14, right: "20%" }}
                              animate={{ y: [0, 8, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
                          </div>

                          {/* Ref badge */}
                          <motion.div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,196,122,0.22)" }}
                            animate={{ y: [0, -3, 0] }} transition={{ duration: 2.6, repeat: Infinity }}>
                            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00C47A" }}
                              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                            <span className="text-xs font-bold" style={{ color: "#00C47A" }}>Ace detected · Serve +1</span>
                          </motion.div>
                        </div>
                      )}

                      {/* ── Micro Recs: day streak calendar + compound effect ── */}
                      {feature.id === "micro" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-4">
                          {/* Today's rec card */}
                          <motion.div className="w-full rounded-2xl p-4"
                            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)" }}
                            animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                            <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: "#A855F7" }}>Today&apos;s 1%</p>
                            <p className="text-sm font-semibold leading-snug" style={{ color: "#0F172A" }}>
                              Drink 500ml of water before your first meal — your HRV suggests mild dehydration this morning.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: "rgba(168,85,247,0.10)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.22)" }}>
                                HRV-aware
                              </div>
                              <div className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: "rgba(0,196,122,0.08)", color: "#00C47A", border: "1px solid rgba(0,196,122,0.20)" }}>
                                2 min to do
                              </div>
                            </div>
                          </motion.div>

                          {/* Compound bar chart */}
                          <div className="w-full">
                            <p className="text-[9px] uppercase tracking-widest font-bold mb-2" style={{ color: "rgba(0,0,0,0.40)" }}>Compound effect — Day 1 → 60</p>
                            <div className="flex items-end gap-1 h-14">
                              {[2, 3, 3, 4, 5, 5, 6, 7, 8, 9, 10, 13, 16, 20, 26].map((h, i) => (
                                <motion.div key={i} className="flex-1 rounded-t-sm"
                                  initial={{ height: 0 }}
                                  animate={{ height: `${h * 4}%` }}
                                  transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
                                  style={{ background: i > 10 ? "rgba(168,85,247,0.75)" : "rgba(168,85,247,0.22)", minHeight: 3 }} />
                              ))}
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px]" style={{ color: "rgba(0,0,0,0.35)" }}>Day 1</span>
                              <span className="text-[9px] font-bold" style={{ color: "#A855F7" }}>Day 60 · +26% output</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Form Control: stick figure squatting ── */}
                      {feature.id === "form" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          {/* SVG squat figure */}
                          <div className="relative" style={{ width: 160, height: 180 }}>
                            <svg viewBox="0 0 160 180" className="w-full h-full">
                              {/* Barbell */}
                              <motion.g
                                animate={{ y: [0, 2, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                                <rect x="10" y="34" width="140" height="6" rx="3" fill="rgba(245,158,11,0.35)" />
                                <rect x="8" y="30" width="14" height="14" rx="3" fill="rgba(245,158,11,0.55)" />
                                <rect x="138" y="30" width="14" height="14" rx="3" fill="rgba(245,158,11,0.55)" />
                              </motion.g>

                              {/* Head */}
                              <motion.circle cx="80" cy="22" r="11" fill="none" stroke="rgba(245,158,11,0.80)" strokeWidth="2.5"
                                animate={{ cy: [22, 24, 22] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />

                              {/* Torso — upright */}
                              <motion.line x1="80" y1="33" x2="80" y2="85" stroke="rgba(245,158,11,0.80)" strokeWidth="2.5" strokeLinecap="round"
                                animate={{ y1: [33, 35, 33], y2: [85, 87, 85] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />

                              {/* Left arm — on bar */}
                              <motion.line x1="80" y1="50" x2="42" y2="38" stroke="rgba(245,158,11,0.70)" strokeWidth="2" strokeLinecap="round"
                                animate={{ y2: [38, 40, 38] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
                              {/* Right arm — on bar */}
                              <motion.line x1="80" y1="50" x2="118" y2="38" stroke="rgba(245,158,11,0.70)" strokeWidth="2" strokeLinecap="round"
                                animate={{ y2: [38, 40, 38] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />

                              {/* Left leg — bent squat */}
                              <motion.polyline points="80,85 60,118 68,150" fill="none" stroke="rgba(245,158,11,0.80)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                animate={{ points: ["80,85 60,118 68,150", "80,87 62,120 70,152", "80,85 60,118 68,150"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
                              {/* Right leg — bent squat */}
                              <motion.polyline points="80,85 100,118 92,150" fill="none" stroke="rgba(245,158,11,0.80)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                animate={{ points: ["80,85 100,118 92,150", "80,87 102,120 94,152", "80,85 100,118 92,150"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />

                              {/* Knee alignment check lines */}
                              <motion.line x1="68" y1="150" x2="60" y2="118" stroke="rgba(0,196,122,0.50)" strokeWidth="1" strokeDasharray="3 3"
                                animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
                              <motion.line x1="92" y1="150" x2="100" y2="118" stroke="rgba(0,196,122,0.50)" strokeWidth="1" strokeDasharray="3 3"
                                animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: 0.2 }} />

                              {/* Form checkmark */}
                              <motion.circle cx="130" cy="150" r="10" fill="none" stroke="rgba(0,196,122,0.70)" strokeWidth="2"
                                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} />
                              <motion.text x="125" y="154" fontSize="11" fill="rgba(0,196,122,0.90)">✓</motion.text>
                            </svg>

                            {/* AI overlay badge */}
                            <motion.div className="absolute top-0 right-0 px-2 py-1 rounded-lg text-[9px] font-bold"
                              style={{ background: "rgba(0,196,122,0.12)", border: "1px solid rgba(0,196,122,0.30)", color: "#00C47A" }}
                              animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }}>
                              AI WATCHING
                            </motion.div>
                          </div>

                          {/* Form feedback */}
                          <motion.div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,196,122,0.22)" }}
                            animate={{ y: [0, -3, 0] }} transition={{ duration: 2.6, repeat: Infinity }}>
                            <span className="text-[10px]">✅</span>
                            <span className="text-xs font-bold" style={{ color: "#00C47A" }}>Depth good · Knees tracking</span>
                          </motion.div>
                        </div>
                      )}

                      {/* ── Environment Design: room that adapts to your state ── */}
                      {feature.id === "environment" && (
                        <div className="absolute inset-0 flex flex-col px-5 justify-center gap-2.5">

                          {/* Mode badge */}
                          <AnimatePresence>
                            <motion.div key={`env-label-${envModeIdx}`}
                              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}
                              className="flex items-center gap-2 self-center px-3 py-1.5 rounded-full text-xs font-bold"
                              style={{ background: `${ENV_MODES[envModeIdx].color}14`, border: `1px solid ${ENV_MODES[envModeIdx].color}35`, color: ENV_MODES[envModeIdx].color }}>
                              <span>{ENV_MODES[envModeIdx].icon}</span>
                              <span>{ENV_MODES[envModeIdx].label}</span>
                            </motion.div>
                          </AnimatePresence>

                          {/* Room scene */}
                          <div className="relative rounded-2xl overflow-hidden" style={{ height: 112 }}>
                            {/* Ambient background cross-fade */}
                            <AnimatePresence mode="sync">
                              <motion.div key={`env-bg-${envModeIdx}`}
                                className="absolute inset-0"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.7 }}
                                style={{ background: ENV_MODES[envModeIdx].ambientBg, border: `1.5px solid ${ENV_MODES[envModeIdx].color}20`, borderRadius: 16 }} />
                            </AnimatePresence>

                            {/* Ceiling light glow */}
                            <motion.div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                              style={{ width: 110, height: 60, background: `radial-gradient(ellipse at 50% 0%, ${ENV_MODES[envModeIdx].glowColor} 0%, transparent 72%)`, transition: "background 0.7s ease" }}
                              animate={{ opacity: [0.65, 1, 0.65] }} transition={{ duration: 2.2, repeat: Infinity }} />

                            {/* Light fixture */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                              style={{ background: ENV_MODES[envModeIdx].color, boxShadow: `0 0 14px ${ENV_MODES[envModeIdx].glowColor}`, transition: "background 0.5s ease, box-shadow 0.5s ease" }} />

                            {/* Window with ambient light tint */}
                            <div className="absolute top-3 right-5 w-8 h-12 rounded-sm"
                              style={{ background: `${ENV_MODES[envModeIdx].color}1A`, border: `1.5px solid ${ENV_MODES[envModeIdx].color}40`, transition: "all 0.6s ease" }} />

                            {/* Plant silhouette */}
                            <div className="absolute bottom-5 left-7 text-base select-none">🌱</div>

                            {/* Desk */}
                            <div className="absolute bottom-0 left-4 right-4 h-2 rounded-t"
                              style={{ background: `${ENV_MODES[envModeIdx].color}28`, transition: "background 0.5s ease" }} />

                            {/* State dots */}
                            <div className="absolute top-2 right-3 flex gap-1">
                              {ENV_MODES.map((_, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                  style={{ background: i === envModeIdx ? ENV_MODES[envModeIdx].color : "rgba(0,0,0,0.14)" }} />
                              ))}
                            </div>
                          </div>

                          {/* Music player */}
                          <AnimatePresence>
                            <motion.div key={`env-music-${envModeIdx}`}
                              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.28 }}
                              className="flex items-center gap-3 px-3 py-2 rounded-xl"
                              style={{ background: `${ENV_MODES[envModeIdx].color}09`, border: `1px solid ${ENV_MODES[envModeIdx].color}24` }}>
                              <motion.div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm"
                                style={{ background: `${ENV_MODES[envModeIdx].color}20`, border: `1px solid ${ENV_MODES[envModeIdx].color}38` }}
                                animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
                                🎵
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold truncate" style={{ color: "#1E293B" }}>{ENV_MODES[envModeIdx].music}</p>
                                <p className="text-[10px]" style={{ color: "rgba(0,0,0,0.40)" }}>{ENV_MODES[envModeIdx].musicSub}</p>
                              </div>
                              {/* Waveform */}
                              <div className="flex items-end gap-0.5 h-5 shrink-0">
                                {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
                                  <motion.div key={i} className="w-1 rounded-full"
                                    style={{ background: ENV_MODES[envModeIdx].color }}
                                    animate={{ height: [`${h * 2}px`, `${(h + 3) * 2}px`, `${h * 2}px`] }}
                                    transition={{ duration: 0.45 + i * 0.08, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }} />
                                ))}
                              </div>
                            </motion.div>
                          </AnimatePresence>

                          {/* Lighting + trigger row */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-1 min-w-0"
                              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }}>
                              <span className="text-xs">💡</span>
                              <span className="text-[10px] font-medium truncate" style={{ color: "rgba(0,0,0,0.52)" }}>{ENV_MODES[envModeIdx].light}</span>
                            </div>
                            <AnimatePresence>
                              <motion.div key={`env-trigger-${envModeIdx}`}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-1 min-w-0"
                                style={{ background: `${ENV_MODES[envModeIdx].triggerColor}08`, border: `1px solid ${ENV_MODES[envModeIdx].triggerColor}22` }}>
                                <motion.div className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: ENV_MODES[envModeIdx].triggerColor }}
                                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.3, repeat: Infinity }} />
                                <span className="text-[10px] font-medium truncate" style={{ color: ENV_MODES[envModeIdx].triggerColor }}>{ENV_MODES[envModeIdx].trigger}</span>
                              </motion.div>
                            </AnimatePresence>
                          </div>

                        </div>
                      )}

                      {/* ── More Coming Soon ── */}
                      {feature.id === "more" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                          {[1, 2, 3].map((r) => (
                            <motion.div key={r} className="absolute rounded-full pointer-events-none"
                              style={{ width: r * 90, height: r * 90, border: `1px solid rgba(10,186,181,${0.18 - r * 0.04})`, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
                              animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
                              transition={{ duration: 2.5 + r * 0.4, repeat: Infinity, delay: r * 0.3 }} />
                          ))}
                          <motion.div className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                            style={{ background: "rgba(10,186,181,0.10)", border: "2px solid rgba(10,186,181,0.28)", boxShadow: "0 0 32px rgba(10,186,181,0.20)" }}
                            animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity }}>
                            🚀
                          </motion.div>
                          <p className="relative z-10 text-xs text-center" style={{ color: "rgba(0,0,0,0.40)" }}>Roadmap · 2025–2026</p>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </section>
  );
}
