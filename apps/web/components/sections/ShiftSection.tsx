"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@/components/navigation/navigation-context";
import { useUser } from "@clerk/nextjs";
import {
  SIGNAL_CATEGORIES,
  SIGNAL_TIERS,
  category,
  categoryColor,
  tier,
  type CategoryId,
  type TierId,
} from "@/lib/signal-taxonomy";
import { track } from "@/lib/analytics";

// ─── The attention model ──────────────────────────────────────────────────────
// Two encodings, deliberately independent, because they answer two different
// questions — and the old ring-per-category design collapsed them into one, so
// neither got answered:
//
//   COLOUR = what kind of signal this is (the five shared categories).
//   RADIUS = how much of Kinextion's finite attention it earns.
//
// Distance from the centre is the whole argument of this page. Inference,
// context, and storage are all bounded, so a disclosed injury and this
// afternoon's air quality cannot be held the same way. Core signals sit close,
// barely move, and are resident in every reply. Ambient signals whip past on
// the outside and are released the moment they have been used.
type Signal = {
  readonly icon: string;
  readonly label: string;
  readonly sub: string;
  readonly category: CategoryId;
  readonly tier: TierId;
  /** Why this signal earns the tier it sits on — the budget argument, per signal. */
  readonly weight: string;
  readonly collects: readonly string[];
  readonly aids: string;
  // ── Derived at module load from `tier`, so render code stays terse ──
  readonly color: string;
  readonly r: number;
  readonly size: number;
  readonly speed: number;
  readonly delay: number;
};

type SignalSeed = Omit<Signal, "color" | "r" | "size" | "speed" | "delay" | "tier">;

/**
 * Rotation period per tier, in seconds.
 *
 * Inverted from a real orrery, and on purpose: core signals are nearly still
 * because they are *held*, ambient signals move fastest because they are
 * passing through. The motion is carrying the same meaning as the radius.
 */
const TIER_SPEEDS: Record<TierId, number> = {
  core: 132,
  daily: 84,
  pattern: 56,
  ambient: 36,
};

const SIGNALS_BY_TIER: Record<TierId, readonly SignalSeed[]> = {
  // ── Core · constraints and identity. Loaded before every reply. ─────────────
  core: [
    { icon: "🩹", label: "Injury Reports", sub: "Left knee: active · movement filtered", category: "context",
      weight: "An injury isn't a data point, it's a filter. Every movement suggestion has to pass through it, so it can never be the thing that got summarised away.",
      collects: ["Active injury locations", "Pain level & trend", "Movement constraints"],
      aids: "An injury isn't a footnote — it's a standing constraint until cleared. Every exercise recommendation filters through 'does this touch the affected area.'" },
    { icon: "🌙", label: "Cycle Phase", sub: "Luteal phase · recovery priority", category: "body",
      weight: "Phase changes what a workout costs and what a mood means. Forgetting it for half the user base would quietly corrupt everything downstream of it.",
      collects: ["Menstrual cycle phase", "Predicted energy & tolerance windows", "Hormonal shift markers"],
      aids: "Cycle phase has a large effect on training tolerance, sleep, and mood — and it's routinely ignored. Kinextion treats it as a first-class signal." },
    { icon: "🧠", label: "3-yr Memory", sub: "82% pattern match · active", category: "habits",
      weight: "The one thing a new app can't fake and an old one must never lose. Compressed over time, but never dropped — it's what makes year three different from year one.",
      collects: ["Long-term patterns", "What worked before", "Seasonal trends"],
      aids: "Three years of memory means Kinextion spots the spiral early — it has seen this exact pattern in you before." },
    { icon: "💬", label: "Chat History", sub: "47 sessions · last: 2d ago", category: "mind",
      weight: "Everything you've said once. Being asked to re-explain your own life is the fastest way to stop trusting a system, so this tier is the only acceptable home for it.",
      collects: ["Past conversations", "Stated goals & blockers", "Tone & sentiment"],
      aids: "Everything you've told Althea and Kairo stays known — so you never have to re-explain who you are." },
    { icon: "💭", label: "Purpose Check", sub: "Motivation: intrinsic · aligned", category: "mind",
      weight: "Your reason reframes every other signal. It moves slowly, matters permanently, and costs almost nothing to keep — the definition of a core signal.",
      collects: ["Purpose & meaning score", "Motivation framing (intrinsic vs. external)", "Goal alignment trend"],
      aids: "Purpose independently predicts long-term health outcomes. Low scores tell Kinextion to shift framing from discipline to meaning." },
  ],

  // ── Daily · the state of today, at full resolution while it still matters. ──
  daily: [
    { icon: "⌚", label: "Apple Watch", sub: "72 BPM · HRV 41ms ↓ −27ms", category: "body",
      weight: "Full fidelity for a fortnight, because a 27ms drop only means anything against the last ten days. After that the trend is enough and the raw beats go.",
      collects: ["Heart rate & resting HR", "Heart-rate variability", "Workout strain & calories"],
      aids: "Real-time recovery readouts let Kinextion dial today's intensity up or down before you ever feel the crash." },
    { icon: "💍", label: "Oura Ring", sub: "Sleep 71 · deep 52min · REM 18%", category: "body",
      weight: "Last night rewrites today; last month doesn't. Kept sharp for two weeks, then folded into a sleep-debt line that's cheaper to carry and just as useful.",
      collects: ["Sleep stages (deep / REM)", "Resting HR & temperature", "Readiness score"],
      aids: "Sleep architecture is the foundation — one poor night quietly rewrites the entire day's brief." },
    { icon: "🫀", label: "Mood Journal", sub: "Anxious 4/5 · 5-day trend ↑", category: "mind",
      weight: "Held close enough that Kairo sees a fifth hard day while it's still the fifth, rather than reading about it later in a monthly average.",
      collects: ["Daily mood ratings", "Emotional trends", "Triggers & notes"],
      aids: "Mood trends let Kairo step in early — before a hard week quietly becomes a lost month." },
    { icon: "📅", label: "Calendar", sub: "Q3 presentation Thu ⚠ · parents Fri", category: "context",
      weight: "Only the next fortnight is loaded. A meeting you had in March can't change where today's session goes, so it isn't paying rent in the context window.",
      collects: ["Meetings & deadlines", "Travel & commitments", "Open time windows"],
      aids: "Your real schedule lets Kinextion place the session where it'll actually happen — not where it's convenient." },
    { icon: "👨‍👩‍👧", label: "Family Context", sub: "Parents arrive Fri · high-stakes", category: "context",
      weight: "The events are transient; how you tend to handle them isn't. The week is held here, and the pattern it reveals graduates inward to Core.",
      collects: ["Key relationships & events", "High-stakes moments", "Emotional load"],
      aids: "Life context tells Kinextion when to ease off — a system that ignores your family was never built for your life." },
    { icon: "🌡️", label: "Skin Temp", sub: "+0.4°C above baseline · watching", category: "body",
      weight: "A deviation is only readable against a recent baseline. Two weeks of nightly readings is exactly the window that makes it interpretable, and no more.",
      collects: ["Nightly skin temperature trend", "Deviation from personal baseline", "Cycle-phase correlation"],
      aids: "Skin temperature shifts flag illness onset and hormonal change before you feel symptoms — a day's head start on adjusting the plan." },
  ],

  // ── Pattern · only meaningful in aggregate, so only the shape is kept. ──────
  pattern: [
    { icon: "🎯", label: "Goal Progress", sub: "Streak 18d · momentum high", category: "habits",
      weight: "What matters is the slope, not day nine. Kinextion keeps the momentum curve and lets the individual completions age out from underneath it.",
      collects: ["Active streaks", "Momentum trend", "Milestone pace"],
      aids: "Momentum tracking lets Kinextion protect a fragile streak instead of risking the all-or-nothing break." },
    { icon: "🏃", label: "Strava", sub: "5.4 mi · 8:42/mi · high load", category: "habits",
      weight: "Single runs are noise; accumulated load is signal. Stored as a rolling fatigue figure rather than a permanent archive of GPS traces.",
      collects: ["Distance & pace", "Training load", "Route & elevation"],
      aids: "Endurance load feeds the fatigue model so Kinextion never stacks a hard run on an already-tired system." },
    { icon: "👟", label: "Step Count", sub: "4,820 steps · floor 6,000", category: "habits",
      weight: "One 4,800-step day says nothing. A fortnight of them says a great deal — so the fortnight is what gets kept.",
      collects: ["Daily step count", "Non-workout movement credit", "Movement floor vs. target"],
      aids: "Steps give credit to walks, errands, and between-meeting movement — the 'walked the dog instead' story deserves to count." },
    { icon: "🕐", label: "Sleep Rhythm", sub: "Bedtime variance 43min · moderate", category: "habits",
      weight: "Variance is definitionally a pattern — one bedtime carries no information at all, so nothing below the aggregate is worth the storage.",
      collects: ["Bedtime & wake-time consistency", "Circadian rhythm stability", "Compensatory nap patterns"],
      aids: "Bedtime variability predicts next-day fatigue independently of total sleep hours — regularity matters more than most people realise." },
    { icon: "📱", label: "Digital Behavior", sub: "Screen ↑40% · journal 6d silent", category: "mind",
      weight: "Deliberately coarse. Kinextion holds the drift — up 40%, six days quiet — and never the browsing itself, which would be both invasive and useless.",
      collects: ["App & screen-time patterns", "Journaling cadence", "Late-night usage flags"],
      aids: "Behavioural drift is the earliest warning — a six-day journaling silence speaks louder than any check-in." },
    { icon: "🧘", label: "Mindfulness", sub: "Last session 6d ago · needed", category: "mind",
      weight: "Only the gap is interesting. Kinextion keeps the interval between sessions and discards the sessions themselves.",
      collects: ["Session frequency", "Stress & breath-work patterns", "Recovery practices"],
      aids: "Knowing your last calm moment was six days ago, Kinextion surfaces the reset you didn't know you needed." },
    { icon: "🥗", label: "Nutrition Log", sub: "Protein 64g · 1,842 kcal", category: "body",
      weight: "Kept as weekly adequacy rather than a food diary. Holding every meal forever would cost a great deal and change almost no recommendation.",
      collects: ["Protein, carbs & calories", "Meal timing", "Eating rhythm"],
      aids: "Fuel data tells Kinextion whether your body can back the plan — or whether today should be lighter and smarter." },
  ],

  // ── Ambient · conditions, not history. Fetched, used, released. ─────────────
  ambient: [
    { icon: "🌤️", label: "Environment", sub: "AQI 45 · outdoor running ✓", category: "world",
      weight: "Free to look up the moment a session is being placed, and worthless an hour later. No version of this deserves permanent storage.",
      collects: ["Weather conditions & forecast", "Air quality index", "Outdoor activity suitability"],
      aids: "Poor air quality suppresses outdoor recommendations before you discover mid-run that the air is bad. A runner with asthma should not find out at mile two." },
    { icon: "🌿", label: "Nature Exposure", sub: "Outdoor walk 2d ago · overdue", category: "world",
      weight: "Derived on the fly from location and movement rather than tracked as its own record — the cheapest possible way to get the benefit.",
      collects: ["Outdoor time & GPS context", "Natural-environment access", "Park & trail proximity"],
      aids: "Nature walks reduce rumination in ways treadmills don't. When movement is on the menu, Kinextion stacks it with nature where it can." },
    { icon: "🫂", label: "Pod Activity", sub: "3 active this week · Mia's on 21", category: "world",
      weight: "Read live from your pod, never copied into your record. Their data stays theirs — Kinextion only ever sees the current state of the room.",
      collects: ["Community engagement level", "Accountability partner activity", "Social withdrawal signals"],
      aids: "Social withdrawal often precedes broader disengagement. When someone goes quiet in their pod, Kinextion notices before anyone else does." },
    { icon: "☀️", label: "Light Exposure", sub: "Morning light 7:12am · evening dim ✓", category: "context",
      weight: "Estimated from sunrise, location, and screen state at the moment it's needed. No lux history is worth keeping to get a circadian anchor.",
      collects: ["Morning sunlight timing", "Daytime lux estimate", "Evening screen-light exposure"],
      aids: "Light timing sets the circadian anchor for sleep, energy, and mood — one of the highest-leverage levers almost no app tracks." },
    { icon: "🗺️", label: "Travel & Location", sub: "Chicago trip: Tue–Thu · active", category: "context",
      weight: "Where you are right now, not where you've been. Kinextion asks the device when it matters and keeps no location trail whatsoever.",
      collects: ["Current city & travel status", "Time-zone shift", "Nearby training spaces"],
      aids: "Travel mode activates automatically — equipment constraints, jet-lag protocols, and eating-out realism, without you toggling anything." },
    { icon: "💧", label: "Hydration", sub: "Est. 48oz today · below target", category: "body",
      weight: "An estimate reconstructed from heat, exertion, and travel rather than a logged number. Underweighted everywhere else, and still not worth a database row.",
      collects: ["Daily water estimate", "Context: heat, exercise, travel", "Trend vs. personal baseline"],
      aids: "Hydration is chronically underweighted — a quiet variable in headaches, energy dips, and exercise tolerance that most apps miss entirely." },
  ],
};

/**
 * Flatten the tiers into renderable orbs.
 *
 * Radius, size, speed, and phase all derive from the tier, so adding a signal
 * is a one-line edit and the ring rebalances its own spacing rather than
 * needing hand-tuned delays.
 */
const ORBITING: readonly Signal[] = SIGNAL_TIERS.flatMap((t) => {
  const list = SIGNALS_BY_TIER[t.id];
  const speed = TIER_SPEEDS[t.id];
  return list.map((s, i) => ({
    ...s,
    tier: t.id,
    color: categoryColor(s.category),
    r: t.radius,
    size: t.orbSize,
    speed,
    // Negative delay starts each orb already advanced along its orbit, so the
    // ring is evenly populated on first paint rather than filling in.
    delay: -(speed / list.length) * i,
  }));
});

/** Signals belonging to a tier, in orbit order. */
function signalsIn(tierId: TierId): readonly Signal[] {
  return ORBITING.filter((s) => s.tier === tierId);
}

/** The square the orbit needs: outermost diameter plus an orb, plus breathing room. */
const ORBIT_EXTENT =
  2 * SIGNAL_TIERS[SIGNAL_TIERS.length - 1].radius + SIGNAL_TIERS[0].orbSize + 24;

// Kinextion core branding — the aurora gradient that represents the synthesis
// engine at the centre of the system (distinct from either individual guide).
const KIN_GRADIENT = "linear-gradient(135deg, #00C47A 0%, #0ABAB5 50%, #A855F7 100%)";


// ─── Signal detail — the "what we read, why it's held this close" panel ───────
// Docked into the left rail rather than floating over the orbit. The old
// version was a card of text laid on top of the moving orbs, which made both
// harder to read; here the diagram and the reading each get their own column.
function SignalDetail({ signal }: { readonly signal: Signal }) {
  const cat = category(signal.category);
  const t = tier(signal.tier);

  return (
    <motion.div
      key={signal.label}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${signal.color}1F`, border: `1px solid ${signal.color}45` }}
        >
          {signal.icon}
        </span>
        <div className="min-w-0">
          <h4 className="font-semibold text-[15px] leading-tight tracking-[-0.01em]" style={{ color: "#FFFFFF" }}>
            {signal.label}
          </h4>
          <p className="text-[11px] mt-0.5" style={{ color: `${signal.color}CC` }}>
            {cat.icon} {cat.label}
          </p>
        </div>
      </div>

      {/* Live reading */}
      <div
        className="rounded-xl px-3 py-2 mb-5 text-[12px] font-medium flex items-center gap-2"
        style={{ background: `${signal.color}12`, border: `1px solid ${signal.color}2E`, color: signal.color }}
      >
        <motion.span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: signal.color }}
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        {signal.sub}
      </div>

      <RailHeading>What Kinextion reads</RailHeading>
      <ul className="space-y-1.5 mb-5">
        {signal.collects.map((c) => (
          <li
            key={c}
            className="flex items-start gap-2 text-[12px] leading-snug"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ background: signal.color }} />
            {c}
          </li>
        ))}
      </ul>

      <RailHeading>What it changes</RailHeading>
      <p className="text-[12px] leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.66)" }}>
        {signal.aids}
      </p>

      {/* The budget argument — why this one is held at this distance. */}
      <div
        className="rounded-xl p-3.5"
        style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <WeightPips weight={t.weight} color={signal.color} />
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
            {t.label} · {t.retention}
          </span>
        </div>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
          {signal.weight}
        </p>
      </div>
    </motion.div>
  );
}

/** Four pips, filled in proportion to a tier's weight. The budget, at a glance. */
function WeightPips({ weight, color }: { readonly weight: number; readonly color: string }) {
  const filled = Math.round(weight * 4);
  return (
    <span className="flex items-center gap-[3px] shrink-0" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 4,
            height: 4,
            background: i < filled ? color : "rgba(255,255,255,0.16)",
          }}
        />
      ))}
    </span>
  );
}

function RailHeading({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] uppercase tracking-[0.16em] font-semibold mb-2"
      style={{ color: "rgba(255,255,255,0.34)" }}
    >
      {children}
    </p>
  );
}

// ─── Tier rail — the legend, and the argument ─────────────────────────────────
// Four rows, one per attention tier, weighted so the eye reads the hierarchy
// before it reads a word. Hovering a row lights that ring in the orbit; every
// signal on the tier is listed by name, so the full set is legible without
// having to chase moving orbs.
function TierRail({
  activeTier,
  activeSignal,
  onHoverTier,
  onPickSignal,
}: {
  readonly activeTier: TierId;
  readonly activeSignal: Signal | null;
  readonly onHoverTier: (id: TierId | null) => void;
  readonly onPickSignal: (label: string | null) => void;
}) {
  const t = tier(activeTier);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(255,255,255,0.42)" }}>
          Attention budget
        </p>
        <p className="text-[12.5px] leading-relaxed mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>
          {ORBITING.length} signals, held four different ways. Nothing has
          unlimited memory — so the closer a signal sits to the centre, the more
          of Kinextion it gets to occupy.
        </p>
      </div>

      {/* Tier rows */}
      <div className="shrink-0 mt-5 space-y-1">
        {SIGNAL_TIERS.map((row) => {
          const on = row.id === activeTier;
          const count = signalsIn(row.id).length;
          return (
            <button
              key={row.id}
              onMouseEnter={() => onHoverTier(row.id)}
              onFocus={() => onHoverTier(row.id)}
              onClick={() => { onPickSignal(null); onHoverTier(row.id); }}
              className="w-full text-left rounded-xl px-3 py-2.5 transition-colors duration-200 cursor-pointer"
              style={{
                background: on ? "rgba(255,255,255,0.055)" : "transparent",
                border: `1px solid ${on ? "rgba(255,255,255,0.11)" : "transparent"}`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[13px] font-semibold tracking-[-0.01em] transition-colors duration-200"
                  style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.62)" }}
                >
                  {row.label}
                </span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.34)" }}>
                  {row.kicker}
                </span>
                <span className="ml-auto text-[11px] tabular-nums" style={{ color: "rgba(255,255,255,0.34)" }}>
                  {count}
                </span>
              </div>
              {/* Weight bar — the same number that sets the orbit radius. */}
              <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #00C47A, #0ABAB5 55%, #A855F7)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${row.weight * 100}%`, opacity: on ? 1 : 0.45 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail slot — the active signal, or the active tier. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto mt-5 pt-5 scrollbar-hide"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Deliberately NOT `AnimatePresence mode="wait"`. As documented in
            TabLayout, variant-based exits here can fail to report completion,
            which leaves the outgoing panel mounted forever and makes the whole
            rail look frozen. Keying on the content gives the same cross-fade
            with no dependency on an exit lifecycle that can stall. */}
        <div>
          {activeSignal ? (
            <SignalDetail key={activeSignal.label} signal={activeSignal} />
          ) : (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <WeightPips weight={t.weight} color="#0ABAB5" />
                <h4 className="font-semibold text-[15px] tracking-[-0.01em]" style={{ color: "#FFFFFF" }}>
                  {t.label}
                </h4>
              </div>
              <p className="text-[11px] mb-3" style={{ color: "#0ABAB5" }}>
                {t.retention}
              </p>
              <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.62)" }}>
                {t.detail}
              </p>

              <RailHeading>On this ring</RailHeading>
              <div className="flex flex-wrap gap-1.5">
                {signalsIn(t.id).map((s) => (
                  <button
                    key={s.label}
                    onClick={() => onPickSignal(s.label)}
                    className="flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-[11px] transition-colors duration-150 cursor-pointer hover:bg-white/[0.06]"
                    style={{ border: `1px solid ${s.color}30`, color: "rgba(255,255,255,0.78)" }}
                  >
                    <span className="text-[11px] leading-none">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Orbit stage ──────────────────────────────────────────────────────────────
// Deliberately wordless. Every label lives in the rail beside it, so nothing is
// set over a moving surface. Radius and orb size carry the tier; colour carries
// the category; rotation speed carries how transient the signal is.
function OrbitStage({
  activeTier,
  activeLabel,
  onHoverSignal,
  onPickSignal,
  onOpenChat,
}: {
  readonly activeTier: TierId;
  readonly activeLabel: string | null;
  readonly onHoverSignal: (label: string | null) => void;
  readonly onPickSignal: (label: string | null) => void;
  readonly onOpenChat: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // The orbit is drawn at a fixed pixel size and scaled to fit whatever the
  // viewport leaves over, so short laptop screens get the whole system rather
  // than a cropped outer ring.
  useLayoutEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const fit = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(1, Math.min(width, height) / ORBIT_EXTENT));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const paused = activeLabel !== null;

  return (
    // The diagram is a pointer affordance layered on top of information that is
    // fully reachable from the rail's real buttons, so it stays out of the
    // accessibility tree rather than adding 24 unlabelled tab stops.
    <div ref={boxRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="relative"
        style={{
          width: ORBIT_EXTENT,
          height: ORBIT_EXTENT,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {/* Rings. Brightness tracks the tier's weight, so the hierarchy is
            visible before anything is hovered. */}
        {SIGNAL_TIERS.map((t) => {
          const lit = t.id === activeTier;
          return (
            <div
              key={t.id}
              className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
              style={{
                width: t.radius * 2,
                height: t.radius * 2,
                transform: "translate(-50%, -50%)",
                border: `1px solid rgba(255,255,255,${(lit ? 0.24 : 0.09) * (0.45 + t.weight * 0.55)})`,
                boxShadow: lit ? "0 0 26px rgba(10,186,181,0.10) inset" : "none",
                transition: "border-color 0.35s, box-shadow 0.35s",
              }}
            />
          );
        })}

        {/* Core */}
        <div className="absolute top-1/2 left-1/2" style={{ transform: "translate(-50%, -50%)", zIndex: 20 }}>
          <motion.div
            style={{
              position: "absolute", inset: -36, borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(10,186,181,0.30) 0%, transparent 70%)",
              filter: "blur(10px)",
            }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 3.4, repeat: Infinity }}
          />
          <motion.button
            onClick={onOpenChat}
            className="rounded-full flex flex-col items-center justify-center relative z-10 cursor-pointer"
            style={{
              width: 100, height: 100,
              background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.20), rgba(10,186,181,0.12) 60%, transparent 100%)",
              border: "1.5px solid rgba(255,255,255,0.40)",
              boxShadow: "0 0 34px rgba(10,186,181,0.42), 0 0 70px rgba(123,47,190,0.20)",
            }}
            whileHover={{ scale: 1.05 }}
            animate={{
              boxShadow: [
                "0 0 34px rgba(10,186,181,0.42), 0 0 70px rgba(123,47,190,0.20)",
                "0 0 52px rgba(10,186,181,0.62), 0 0 100px rgba(123,47,190,0.32)",
                "0 0 34px rgba(10,186,181,0.42), 0 0 70px rgba(123,47,190,0.20)",
              ],
            }}
            transition={{ duration: 3.4, repeat: Infinity }}
            aria-label="Ask Kinextion"
          >
            <span className="text-xl leading-none">✦</span>
            <span
              className="text-[11px] font-bold mt-1 tracking-[-0.01em]"
              style={{ backgroundImage: KIN_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Kinextion
            </span>
          </motion.button>
        </div>

        {/* Orbs */}
        <div aria-hidden>
        {ORBITING.map((s, i) => {
          const isActive = activeLabel === s.label;
          const dimmed = !isActive && activeTier !== s.tier;
          const t = tier(s.tier);
          return (
            <div
              key={s.label}
              style={{
                position: "absolute", top: "50%", left: "50%", width: 0, height: 0,
                zIndex: isActive ? 30 : 10,
                animation: `${i % 2 === 1 ? "kinextion-orbit-ccw" : "kinextion-orbit"} ${s.speed}s linear infinite`,
                animationDelay: `${s.delay}s`,
                animationPlayState: paused ? "paused" : "running",
                "--orbit-r": `${s.r}px`,
              } as React.CSSProperties}
            >
              <div
                style={{
                  position: "absolute",
                  width: s.size, height: s.size,
                  marginLeft: -s.size / 2, marginTop: -s.size / 2,
                  cursor: "pointer",
                }}
                onMouseEnter={() => onHoverSignal(s.label)}
                onMouseLeave={() => onHoverSignal(null)}
                onClick={() => onPickSignal(isActive ? null : s.label)}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.28 : 1, opacity: dimmed ? 0.4 : 1 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    width: s.size, height: s.size, borderRadius: "50%",
                    // Fill and glow both scale with the tier weight — an ambient
                    // signal is visibly a fainter thing than a core one.
                    background: isActive ? `${s.color}34` : `${s.color}${t.weight > 0.6 ? "20" : "12"}`,
                    border: `1.5px solid ${s.color}${isActive ? "80" : t.weight > 0.6 ? "4A" : "2E"}`,
                    boxShadow: isActive
                      ? `0 0 24px ${s.color}66, 0 0 48px ${s.color}2A`
                      : `0 0 ${Math.round(6 + t.weight * 12)}px ${s.color}${t.weight > 0.6 ? "45" : "22"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: Math.round(s.size * 0.42),
                    transition: "background 0.25s, border-color 0.25s, box-shadow 0.25s",
                  }}
                >
                  {s.icon}
                </motion.div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ─── Compact stacked view, for viewports too narrow for an orrery ─────────────
function TierList({ onOpenChat }: { readonly onOpenChat: () => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3 pb-8">
      {SIGNAL_TIERS.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <WeightPips weight={t.weight} color="#0ABAB5" />
            <h4 className="font-semibold text-sm" style={{ color: "#FFFFFF" }}>{t.label}</h4>
            <span className="ml-auto text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {signalsIn(t.id).length}
            </span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: "#0ABAB5" }}>{t.retention}</p>

          <div className="space-y-1.5">
            {signalsIn(t.id).map((s) => {
              const isOpen = open === s.label;
              return (
                <div key={s.label}>
                  <button
                    onClick={() => setOpen(isOpen ? null : s.label)}
                    className="w-full flex items-center gap-2.5 text-left rounded-lg px-2 py-1.5"
                    style={{ background: isOpen ? `${s.color}12` : "transparent" }}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0"
                      style={{ background: `${s.color}18`, border: `1px solid ${s.color}33` }}
                    >
                      {s.icon}
                    </span>
                    <span className="text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.86)" }}>
                      {s.label}
                    </span>
                    <span className="ml-auto text-[11px] shrink-0" style={{ color: `${s.color}AA` }}>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isOpen ? (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[11.5px] leading-relaxed overflow-hidden pl-11 pr-2 pt-1 pb-2"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        {s.sub} — {s.aids}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={onOpenChat}
        className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white"
        style={{ background: KIN_GRADIENT, boxShadow: "0 8px 30px rgba(10,186,181,0.28)" }}
      >
        ✦ Ask Kinextion
      </button>
    </div>
  );
}

// ─── The stage: rail + orbit, side by side ────────────────────────────────────
function SignalSystem({ onOpenChat }: { readonly onOpenChat: () => void }) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [pinnedLabel, setPinnedLabel] = useState<string | null>(null);
  const [hoveredTier, setHoveredTier] = useState<TierId | null>(null);

  // Pinned wins over hovered, so you can move the mouse across to read.
  const activeLabel = pinnedLabel ?? hoveredLabel;
  const activeSignal = ORBITING.find((s) => s.label === activeLabel) ?? null;
  const activeTier: TierId = activeSignal?.tier ?? hoveredTier ?? "core";

  return (
    <div className="h-full min-h-0 section-container">
      {/* Narrow viewports get the stacked list — a 536px orrery on a phone is
          a decoration, not a diagram. */}
      <div className="lg:hidden h-full overflow-y-auto scrollbar-hide">
        <TierList onOpenChat={onOpenChat} />
      </div>

      <div className="hidden lg:grid h-full min-h-0 grid-cols-[minmax(300px,340px)_1fr] gap-10 items-stretch">
        <div
          className="min-h-0 py-1 pr-1"
          onMouseLeave={() => { setHoveredTier(null); setHoveredLabel(null); }}
        >
          <TierRail
            activeTier={activeTier}
            activeSignal={activeSignal}
            onHoverTier={setHoveredTier}
            onPickSignal={setPinnedLabel}
          />
        </div>

        <div className="relative min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <OrbitStage
              activeTier={activeTier}
              activeLabel={activeLabel}
              onHoverSignal={setHoveredLabel}
              onPickSignal={setPinnedLabel}
              onOpenChat={onOpenChat}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Context tree — the "what Kinextion knows about you" sidebar ───────────────
// Keyed by the shared taxonomy so the sidebar, the orbit rings, and the How It
// Works page always show the same five categories in the same order with the
// same colours and icons.
const CTX_ITEMS: Record<CategoryId, readonly string[]> = {
  body: [
    "🫀 HRV 68ms — 4ms below baseline",
    "💤 Last night: 5h 22min · deep sleep low",
    "🌡️ Skin temp +0.4°C — watching",
    "💧 Hydration below target 3 days running",
  ],
  mind: [
    "😰 Anxious since Monday's meeting",
    "☕ Caffeine up 40% vs. last week",
    "📓 6 days without journaling ⚠",
  ],
  habits: [
    "🔥 14-day streak, best run this year",
    "Morning stretch: 14 of 14 days ✓",
    "Evening wind-down: 9 of 14 — slipping",
    "Protein target: skipped 3 Fridays running",
  ],
  context: [
    "⚠️ Q3 review: Thursday 9am",
    "👨‍👩‍👧 Parents arriving Friday morning",
    "✈️ Chicago: Monday — tight prep window",
  ],
  world: [
    "🏅 Mia hit her 21-day streak today",
    "Nia logged a check-in 2hrs ago",
    "🌤️ AQI 45 — outdoor session is fine today",
  ],
};

const CTX_SECTIONS = SIGNAL_CATEGORIES.map((c) => ({
  id: c.id,
  icon: c.icon,
  label: c.label,
  color: c.color,
  items: CTX_ITEMS[c.id],
}));

// Guide config
const GUIDE_CFG = {
  althea: { name: "Althea", role: "The Coach",    emoji: "⚡", color: "#00C47A", border: "rgba(0,196,122,0.45)", glow: "rgba(0,196,122,0.25)", dot: "rgba(0,196,122,0.55)" },
  kairo:  { name: "Kairo",  role: "The Listener", emoji: "🌊", color: "#A855F7", border: "rgba(168,85,247,0.45)", glow: "rgba(168,85,247,0.25)", dot: "rgba(168,85,247,0.55)" },
} as const;
type Guide = keyof typeof GUIDE_CFG;

// ─── AI Chat Modal ─────────────────────────────────────────────────────────────
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
};

function AIChatModal({
  onClose,
  userName,
}: {
  readonly onClose: () => void;
  readonly userName?: string | null;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const msgsRef = useRef<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<"chat" | "voice">("voice"); // voice-first
  const [activeGuide, setActiveGuide] = useState<Guide>("kairo"); // default Kairo (listener first)
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const greeted = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Keep msgs ref in sync for use inside async callbacks
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs]);

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const best =
      voices.find((v) => v.lang.startsWith("en") && v.localService) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      voices[0];
    if (best) utter.voice = best;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ── Streaming chat ───────────────────────────────────────────────────────────
  const sendMsg = useCallback(
    async (text: string, isGreeting = false) => {
      if (!text.trim() || isStreaming) return;

      // Does the demo help? Greetings are excluded — an auto-sent opener is
      // not a person choosing to try it.
      if (!isGreeting) {
        track("chat_demo_message", "shift", {
          guide: activeGuide,
          turn: msgsRef.current.filter((m) => m.role === "user").length + 1,
        });
      }

      const uId = `u-${Date.now()}`;
      const aId = `a-${Date.now()}`;

      // Snapshot current conversation for the API payload before we mutate state
      const apiPayload = [
        ...msgsRef.current
          .filter((m) => !(m.role === "assistant" && m.content === ""))
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      const userMsg: ChatMsg = { id: uId, role: "user", content: text, hidden: isGreeting };
      const aiPlaceholder: ChatMsg = { id: aId, role: "assistant", content: "" };

      setMsgs((prev) => [...prev, userMsg, aiPlaceholder]);
      setIsStreaming(true);

      // Replaces the streaming placeholder with a single final string.
      const settle = (content: string) =>
        setMsgs((prev) => prev.map((m) => (m.id === aId ? { ...m, content } : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiPayload,
            userName,
            guide: activeGuide,
            surface: "web",
          }),
        });

        // The route reports failures as JSON with a human-readable `error`.
        // Show that rather than a generic apology, so a rate limit reads as a
        // rate limit and an outage reads as an outage.
        if (!res.ok) {
          const detail = await res
            .json()
            .then((b: { error?: string }) => b?.error)
            .catch(() => null);
          track("chat_demo_error", "shift", { status: res.status });
          settle(detail || "Something went wrong on my end — try again?");
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const dec = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += dec.decode(value, { stream: true });
          const snapshot = full;
          setMsgs((prev) =>
            prev.map((m) => (m.id === aId ? { ...m, content: snapshot } : m))
          );
        }

        if (mode === "voice" && full) speakText(full);
      } catch (err) {
        console.error("[AIChatModal]", err);
        settle("I couldn't reach the network just then — try again?");
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, mode, userName, speakText, activeGuide]
  );

  // Re-greet when the user switches guide mid-session
  const prevGuide = useRef<Guide>("kairo");
  useEffect(() => {
    if (!greeted.current) {
      greeted.current = true;
      sendMsg("Hi.", true);
      return;
    }
    if (prevGuide.current !== activeGuide) {
      prevGuide.current = activeGuide;
      // clear conversation, greet fresh with new guide
      setMsgs([]);
      msgsRef.current = [];
      setTimeout(() => sendMsg("Hi.", true), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuide]);

  // Focus text input when switching to chat mode
  useEffect(() => {
    if (mode === "chat") setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  // ── Voice recognition ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any =
      typeof window !== "undefined"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : undefined;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    let finalTranscript = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalTranscript = Array.from(e.results as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join("");
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) sendMsg(finalTranscript.trim());
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [sendMsg]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const handleSend = useCallback(() => {
    if (inputText.trim()) {
      sendMsg(inputText.trim());
      setInputText("");
    }
  }, [inputText, sendMsg]);

  // ── Derived display state ────────────────────────────────────────────────────
  const displayMsgs = msgs.filter((m) => !m.hidden);
  const lastAiMsg = displayMsgs.filter((m) => m.role === "assistant").at(-1);

  const orbLabel = isListening
    ? "Listening…"
    : isStreaming
    ? "Thinking…"
    : isSpeaking
    ? "Speaking… (tap to stop)"
    : "Tap to speak";

  const orbColor = isListening
    ? "#00C47A"
    : isStreaming
    ? "#A855F7"
    : isSpeaking
    ? "#0ABAB5"
    : "rgba(255,255,255,0.28)";

  const gc = GUIDE_CFG[activeGuide];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(2,6,23,0.76)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Aurora bloom — tinted by active guide */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: 900, height: 900,
          transform: "translate(-50%,-50%)", borderRadius: "50%",
          background: `radial-gradient(circle, ${gc.glow} 0%, rgba(10,186,181,0.07) 45%, transparent 72%)`,
          filter: "blur(36px)",
        }}
        animate={{ scale: [0.92, 1.06, 0.92], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Modal — two-column on sm+ (context tree | chat) */}
      <motion.div
        className="relative z-10 flex flex-col w-full"
        style={{
          maxWidth: 760,
          height: "min(92vh, 720px)",
          background: "rgba(4,9,28,0.92)",
          border: `1px solid ${gc.border}`,
          borderRadius: 22,
          boxShadow: `0 32px 80px rgba(0,0,0,0.65), 0 0 80px ${gc.glow}`,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}
        initial={{ opacity: 0, scale: 0.92, y: 22 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 22 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-2 px-4 pt-3.5 pb-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Guide selector pills */}
          <div className="flex items-center gap-1 rounded-full p-0.5 mr-1"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
            {(Object.entries(GUIDE_CFG) as [Guide, typeof GUIDE_CFG[Guide]][]).map(([id, g]) => (
              <button
                key={id}
                onClick={() => { stopSpeaking(); stopListening(); setActiveGuide(id); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200"
                style={{
                  background: activeGuide === id ? `${g.color}22` : "transparent",
                  color: activeGuide === id ? g.color : "rgba(255,255,255,0.35)",
                  border: activeGuide === id ? `1px solid ${g.color}45` : "1px solid transparent",
                }}
              >
                <span>{g.emoji}</span>
                <span className="hidden sm:inline">{g.name}</span>
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Voice ↔ Chat toggle */}
          <div className="flex items-center gap-0.5 rounded-full p-0.5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
            {(["voice", "chat"] as const).map((m) => (
              <button key={m}
                onClick={() => { stopSpeaking(); stopListening(); setMode(m); }}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-200"
                style={{
                  background: mode === m ? "rgba(255,255,255,0.12)" : "transparent",
                  color: mode === m ? "#FFFFFF" : "rgba(255,255,255,0.38)",
                }}>
                {m === "voice" ? "🎙️" : "💬"}
              </button>
            ))}
          </div>

          <button onClick={onClose}
            className="ml-1 w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors hover:bg-white/10 shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)" }}
            aria-label="Close">✕</button>
        </div>

        {/* ── Body: tree + chat ────────────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0">

          {/* LEFT: context tree — visible on sm+ */}
          <div className="hidden sm:flex flex-col w-[210px] shrink-0 overflow-y-auto py-3 px-3"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)", scrollbarWidth: "none" }}>
            <p className="text-[9px] uppercase tracking-widest mb-3 px-1" style={{ color: "rgba(255,255,255,0.30)" }}>
              What {gc.name} knows about you
            </p>

            {/* User chip */}
            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "rgba(255,255,255,0.14)", border: "1.5px solid rgba(255,255,255,0.28)" }}>
                {userName ? userName[0].toUpperCase() : "Y"}
              </div>
              <div>
                <p className="text-[11px] font-bold leading-tight" style={{ color: "#FFFFFF" }}>
                  {userName ?? "You"}
                </p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.40)" }}>Member · 3 months</p>
              </div>
            </div>

            {CTX_SECTIONS.map((sec) => (
              <div key={sec.id} className="mb-3">
                <div className="flex items-center gap-1.5 px-1 mb-1.5">
                  <span className="text-sm">{sec.icon}</span>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sec.color }}>
                    {sec.label}
                  </p>
                </div>
                <div className="space-y-0.5 pl-1" style={{ borderLeft: `2px solid ${sec.color}35` }}>
                  {sec.items.map((item) => (
                    <motion.p
                      key={item}
                      className="text-[10px] leading-relaxed pl-2.5"
                      style={{ color: "rgba(255,255,255,0.55)" }}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {item}
                    </motion.p>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-[9px] text-center mt-2 px-1" style={{ color: "rgba(255,255,255,0.22)" }}>
              Context updates as you talk
            </p>
          </div>

          {/* RIGHT: messages + input */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">

            {/* Guide name banner */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <motion.span style={{ fontSize: 14 }}
                animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2.8, repeat: Infinity }}>
                {gc.emoji}
              </motion.span>
              <span className="text-xs font-bold" style={{ color: gc.color }}>{gc.name}</span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>· {gc.role}</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
              style={{ scrollbarWidth: "none" }}>

              {displayMsgs.length === 0 && (
                <div className="flex items-center gap-1.5 px-1 py-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: gc.color }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
                  ))}
                </div>
              )}

              {displayMsgs.map((msg) => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                  {msg.role === "assistant" ? (
                    <div className="max-w-[88%]">
                      {msg.content === "" ? (
                        <div className="flex items-center gap-1.5 px-1 py-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span key={i} className="w-1.5 h-1.5 rounded-full"
                              style={{ background: gc.color }}
                              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.88)", borderLeft: `2px solid ${gc.dot}`, paddingLeft: 12 }}>
                          {msg.content}
                          {isStreaming && msg.id === lastAiMsg?.id && (
                            <motion.span className="inline-block w-0.5 h-3.5 ml-0.5 align-text-bottom rounded-full"
                              style={{ background: gc.color }}
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.75, repeat: Infinity }} />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      {msg.content}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Input area */}
            {mode === "chat" ? (
              <div className="shrink-0 px-4 pb-4 pt-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <input ref={inputRef} type="text" value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Ask ${gc.name} anything…`}
                    disabled={isStreaming}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{
                      color: "rgba(255,255,255,0.88)", padding: "10px 14px",
                      borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)", caretColor: gc.color,
                    }} />
                  <motion.button onClick={handleSend}
                    disabled={isStreaming || !inputText.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: inputText.trim() && !isStreaming ? gc.color : "rgba(255,255,255,0.06)",
                      color: inputText.trim() && !isStreaming ? "#fff" : "rgba(255,255,255,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    whileHover={{ scale: inputText.trim() && !isStreaming ? 1.07 : 1 }}
                    whileTap={{ scale: 0.96 }} aria-label="Send">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M13 1L6.5 7.5M13 1H8.5M13 1V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 2H2C1.44772 2 1 2.44772 1 3V12C1 12.5523 1.44772 13 2 13H11C11.5523 13 12 12.5523 12 12V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="shrink-0 flex flex-col items-center gap-2.5 pb-5 pt-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <motion.button
                  onClick={isListening ? stopListening : isSpeaking ? stopSpeaking : startListening}
                  className="relative rounded-full flex items-center justify-center"
                  style={{ width: 80, height: 80 }}
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                  disabled={isStreaming} aria-label={orbLabel}>
                  {(isListening || isSpeaking) && (
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${orbColor}`, opacity: 0.55 }}
                      animate={{ scale: [1, 1.48, 1], opacity: [0.55, 0, 0.55] }}
                      transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />
                  )}
                  <div className="w-full h-full rounded-full flex items-center justify-center"
                    style={{
                      background: isListening
                        ? `radial-gradient(circle, ${gc.color}40 0%, ${gc.color}10 70%)`
                        : isSpeaking
                        ? "radial-gradient(circle, rgba(10,186,181,0.40) 0%, rgba(10,186,181,0.10) 70%)"
                        : isStreaming
                        ? `radial-gradient(circle, ${gc.color}30 0%, ${gc.color}08 70%)`
                        : "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 70%)",
                      border: `1.5px solid ${isListening || isSpeaking || isStreaming ? orbColor + "72" : "rgba(255,255,255,0.16)"}`,
                      boxShadow: isListening || isSpeaking ? `0 0 32px ${orbColor}42` : "none",
                      transition: "all 0.3s ease",
                    }}>
                    <span style={{ fontSize: 30 }}>{isSpeaking ? "🔊" : "🎙️"}</span>
                  </div>
                </motion.button>
                <p className="text-xs transition-colors duration-200"
                  style={{ color: orbLabel === "Tap to speak" ? "rgba(255,255,255,0.36)" : orbColor }}>
                  {orbLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 pb-2.5 px-5 text-center"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.18)" }}>
            Kinextion AI · {gc.name} · Powered by Claude
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Solution page ─────────────────────────────────────────────────────────────
// A single non-scrolling viewport: compact header, the signal system filling the
// middle, compact CTA footer. The AI chat modal is launched by tapping the core.
export function ShiftSection() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [chatOpen, setChatOpen] = useState(false);
  const userName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? null;

  return (
    <section
      className="relative flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - var(--nav-height, 56px))" }}
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="shrink-0 text-center px-4 pt-5 sm:pt-7"
      >
        <p className="section-label" style={{ color: "#00C47A", marginBottom: "0.5rem" }}>The Solution</p>
        <h2
          className="font-semibold text-balance leading-[1.08] tracking-[-0.025em]"
          style={{ fontSize: "clamp(1.9rem, 4.4vw, 3.2rem)", color: "#FFFFFF" }}
        >
          Two dozen signals.{" "}
          <span style={{ backgroundImage: KIN_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Held by how much they matter.
          </span>
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.55)" }}>
          No system has unlimited attention. What separates one that knows you
          from one that merely logs you is which signals it refuses to forget.
        </p>
      </motion.div>

      {/* ── Signal system — fills the remaining height ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="relative flex-1 min-h-0 pt-5"
      >
        <SignalSystem onOpenChat={() => setChatOpen(true)} />
      </motion.div>

      {/* ── Slim nav footer ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="shrink-0 flex justify-center px-4 pb-5 sm:pb-6"
      >
        <button
          onClick={() => navigate("how-it-works")}
          className="px-7 py-3 rounded-full font-semibold text-sm transition-all duration-200 hover:bg-white/5"
          style={{ color: "rgba(255,255,255,0.80)", border: "1.5px solid rgba(255,255,255,0.20)" }}
        >
          See How Kinextion Works →
        </button>
      </motion.div>

      {/* AI Chat modal — opens when the Kinextion core is tapped */}
      <AnimatePresence>
        {chatOpen && (
          <AIChatModal
            onClose={() => setChatOpen(false)}
            userName={userName}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
