"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useTransform, type MotionValue } from "motion/react";
import { Bell, FileText } from "lucide-react";
import {
  DEMO_HABITS,
  EXAMPLE_LIVES,
  SIM_RESEARCH,
  addDays,
  daysUntilAutomatic,
  simulatePersonal,
  type SimOutcome,
} from "@kinextion/shared";
import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";
import NotificationStack from "@/components/kokonutui/notification-stack";
import { useOpenChat, type GuideId } from "@/components/chat/chat-context";
import { EarlyAccess } from "@/components/marketing/EarlyAccess";
import { EASE, Heading, Reveal, ScrollStage } from "@/components/motion/primitives";

export function HowItWorksSection() {
  return (
    <section className="relative dark">
      <div className="section-container pt-16 sm:pt-24 pb-10">
        <Heading label="How it works" color="#0ABAB5" title="Two guides." muted="Two different ways of knowing you." />
      </div>

      <TwoLenses />

      <ScrollStage length={4}>{(p) => <HabitBuilder progress={p} />}</ScrollStage>

      <LiveWeek />
      <AlsoInTheApp />

      <EarlyAccess source="how-it-works" accent="#0ABAB5" line="See it work on your own week." />
    </section>
  );
}

// ─── Two guides ───────────────────────────────────────────────────────────────

type Focus = GuideId | "both";

const CONTEXT: readonly { readonly label: string; readonly focus: Focus }[] = [
  { label: "Who you're becoming", focus: "both" },
  { label: "Your why", focus: "both" },
  { label: "Everything you've said", focus: "both" },
  { label: "Your habits", focus: "both" },
  { label: "Sleep & recovery", focus: "altheo" },
  { label: "Workouts", focus: "altheo" },
  { label: "Steps", focus: "altheo" },
  { label: "Injuries & limits", focus: "altheo" },
  { label: "Equipment you have", focus: "altheo" },
  { label: "Days you can train", focus: "altheo" },
  { label: "Mood check-ins", focus: "kairo" },
  { label: "Stress", focus: "kairo" },
  { label: "Journal entries", focus: "kairo" },
  { label: "What keeps repeating", focus: "kairo" },
  { label: "Gratitude & reflection", focus: "kairo" },
  { label: "What matters to you", focus: "kairo" },
];

const LENS = {
  altheo: {
    name: "Althea",
    color: "#00C47A",
    role: "Your body and your plan",
    question: "What can today hold?",
    style: "Direct. Gives you the next move.",
    bestFor: ["Deciding what to do today", "Adjusting when you're tired or hurt", "Making a habit small enough to keep"],
    sounds: "Skip the heavy session. Ten-minute walk after lunch still counts.",
  },
  kairo: {
    name: "Kairo",
    color: "#A855F7",
    role: "Your head and your patterns",
    question: "What's underneath this?",
    style: "Patient. Asks more than it tells.",
    bestFor: ["Working out why you keep stopping", "Talking through a hard week", "Noticing a pattern you can't see"],
    sounds: "Three days isn't a verdict. What got loud this week?",
  },
} as const;

const SITUATIONS: readonly { readonly text: string; readonly guide: GuideId }[] = [
  { text: "I don't know what to do today", guide: "altheo" },
  { text: "I keep skipping and feel bad about it", guide: "kairo" },
  { text: "My knee hurts when I squat", guide: "altheo" },
  { text: "I can't switch off at night", guide: "kairo" },
  { text: "I want to get stronger", guide: "altheo" },
  { text: "I'm not sure why this matters to me", guide: "kairo" },
];

function TwoLenses() {
  const openChat = useOpenChat();
  const [active, setActive] = useState<GuideId>("altheo");
  const [situation, setSituation] = useState<string | null>(null);
  const lens = LENS[active];

  const ordered = useMemo(() => {
    const rank = (f: Focus) => (f === active ? 0 : f === "both" ? 1 : 2);
    return [...CONTEXT].sort((a, b) => rank(a.focus) - rank(b.focus));
  }, [active]);

  return (
    <div className="section-container pb-24 max-w-6xl">
      <Reveal>
        <div className="flex justify-center gap-8 sm:gap-14">
          {(Object.keys(LENS) as GuideId[]).map((id) => (
            <button
              key={id}
              onClick={() => {
                setActive(id);
                setSituation(null);
              }}
              aria-pressed={id === active}
              className="cursor-pointer font-semibold transition-colors"
              style={{ fontSize: "clamp(2.4rem, 6vw, 4.6rem)", letterSpacing: "-0.04em", color: id === active ? LENS[id].color : "rgba(255,255,255,0.22)" }}
            >
              {LENS[id].name}
            </button>
          ))}
        </div>
      </Reveal>

      <motion.div
        className="mt-8 rounded-[2rem] p-6 sm:p-10 grid lg:grid-cols-[1.15fr_1fr] gap-10"
        animate={{ background: `linear-gradient(150deg, ${lens.color}22 0%, rgba(255,255,255,0.025) 65%)`, borderColor: `${lens.color}44` }}
        transition={{ duration: 0.5 }}
        style={{ border: "1px solid" }}
      >
        <div>
          <p className="text-sm text-white/60 mb-4">What {lens.name} pays most attention to</p>
          <div className="flex flex-wrap gap-2">
            {ordered.map((c) => {
              const lit = c.focus === active;
              const shared = c.focus === "both";
              return (
                <motion.span
                  key={c.label}
                  layout
                  transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
                  className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                  style={{
                    background: lit ? lens.color : shared ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                    color: lit ? "#05070F" : shared ? "#FFFFFF" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {c.label}
                </motion.span>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-4 text-[12px] text-white/55">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: lens.color }} /> {lens.name}&apos;s focus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white/30" /> They share these
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <p className="text-sm" style={{ color: lens.color }}>
              {lens.role}
            </p>
            <p className="mt-1 font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              &ldquo;{lens.question}&rdquo;
            </p>
            <p className="mt-2 text-white/70">{lens.style}</p>

            <p className="mt-6 text-sm text-white/60">Go to {lens.name} for</p>
            <ul className="mt-2 space-y-1.5">
              {lens.bestFor.map((b) => (
                <li key={b} className="text-white text-[15px] flex gap-2.5 items-start">
                  <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lens.color }} />
                  {b}
                </li>
              ))}
            </ul>

            <button onClick={() => openChat(active)} className="mt-6 px-6 h-11 rounded-full font-semibold text-sm cursor-pointer" style={{ background: lens.color, color: "#05070F" }}>
              Talk to {lens.name}
            </button>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Reveal className="mt-10 text-center">
        <p className="text-white font-medium text-lg">Not sure who to ask? Tap what&apos;s going on.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {SITUATIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => {
                setActive(s.guide);
                setSituation(s.text);
              }}
              aria-pressed={situation === s.text}
              className="px-4 py-2.5 rounded-full text-sm cursor-pointer transition-colors"
              style={{ background: situation === s.text ? LENS[s.guide].color : "rgba(255,255,255,0.06)", color: situation === s.text ? "#05070F" : "rgba(255,255,255,0.75)" }}
            >
              {s.text}
            </button>
          ))}
        </div>
        <p className="mt-4 h-6 text-sm" style={{ color: lens.color }}>
          {situation ? `Start with ${lens.name}. Both guides share what they know about you.` : " "}
        </p>
      </Reveal>
    </div>
  );
}

// ─── A habit assembling itself ────────────────────────────────────────────────

const PARTS = [
  { tag: "Who", text: "I'm someone who moves every day,", color: "#0ABAB5" },
  { tag: "Anchor", text: "so after I pour my coffee,", color: "#3B82F6" },
  { tag: "Tiny", text: "I walk for ten minutes.", color: "#00C47A" },
  { tag: "Bad day", text: "Even to the end of the street counts.", color: "#F59E0B" },
] as const;

function HabitBuilder({ progress }: { readonly progress: MotionValue<number> }) {
  return (
    <div className="section-container h-full flex flex-col justify-center max-w-4xl">
      <p className="text-center text-sm text-white/50 mb-8">Building a habit, piece by piece</p>
      <div className="space-y-2 sm:space-y-4">
        {PARTS.map((part, i) => (
          <HabitLine key={part.tag} part={part} index={i} progress={progress} />
        ))}
      </div>
    </div>
  );
}

function HabitLine({
  part,
  index,
  progress,
}: {
  readonly part: (typeof PARTS)[number];
  readonly index: number;
  readonly progress: MotionValue<number>;
}) {
  const start = index / PARTS.length;
  const end = start + 0.18;
  const opacity = useTransform(progress, [start, end], [0.08, 1]);
  const x = useTransform(progress, [start, end], [index % 2 ? 60 : -60, 0]);
  const tagOpacity = useTransform(progress, [start, end], [0, 1]);

  return (
    <motion.div style={{ opacity, x }}>
      <motion.p className="text-xs font-semibold mb-0.5" style={{ color: part.color, opacity: tagOpacity }}>
        {part.tag}
      </motion.p>
      <p className="font-semibold text-white" style={{ fontSize: "clamp(1.7rem, 5vw, 3.8rem)", lineHeight: 1.08, letterSpacing: "-0.03em" }}>
        {part.text}
      </p>
    </motion.div>
  );
}

// ─── Four weeks you can change, and where they could lead ─────────────────────

const WEEKS = 4;
const HISTORY_DAYS = WEEKS * 7;
const LOOK_AHEAD = 70;
const HISTORY_START = "2026-01-05";

const CYCLE: Record<SimOutcome, SimOutcome> = { full: "tiny", tiny: "missed", missed: "full", rest: "full" };

const OUTCOME_STYLE: Record<SimOutcome, { readonly bg: string; readonly scale: number; readonly label: string }> = {
  full: { bg: "#00C47A", scale: 1, label: "Done" },
  tiny: { bg: "#F59E0B", scale: 0.9, label: "Tiny version" },
  missed: { bg: "rgba(255,255,255,0.08)", scale: 0.82, label: "Missed" },
  rest: { bg: "rgba(255,255,255,0.08)", scale: 0.82, label: "Rest" },
};

const FUTURE_COLORS: Record<string, string> = { pace: "#FFFFFF", most: "#00C47A", tiny: "#F59E0B", rough: "#A855F7" };

const STARTING_WEEKS = ((): readonly SimOutcome[] => {
  const days: SimOutcome[] = Array.from({ length: HISTORY_DAYS }, () => "full");
  for (const i of [4, 10, 19, 25]) days[i] = "missed";
  for (const i of [8, 16, 23]) days[i] = "tiny";
  return days;
})();

function weekLine(days: readonly SimOutcome[]): string {
  const showed = (w: readonly SimOutcome[]) => w.filter((d) => d === "full" || d === "tiny").length;
  const thisWeek = days.slice(-7);
  const change = showed(thisWeek) - showed(days.slice(-14, -7));
  const tiny = thisWeek.filter((d) => d === "tiny").length;
  const tinyNote = tiny ? ` ${tiny === 1 ? "One was" : `${tiny} were`} the tiny version, and that still counted.` : "";
  const trend = change > 0 ? `Up ${change} on last week.` : change < 0 ? `Down ${-change} on last week, and nothing reset.` : "Same as last week.";
  return `${showed(thisWeek)} of 7 days this week. ${trend}${tinyNote}`;
}

function LiveWeek() {
  const [days, setDays] = useState<readonly SimOutcome[]>(STARTING_WEEKS);
  const [hovered, setHovered] = useState<string | null>(null);

  const sim = useMemo(() => {
    const habit = DEMO_HABITS[1];
    return simulatePersonal({
      habit,
      life: EXAMPLE_LIVES[0],
      start: HISTORY_START,
      history: days.map((outcome, i) => ({ date: addDays(HISTORY_START, i), outcome })),
      checks: [],
      ahead: LOOK_AHEAD,
    });
  }, [days]);

  const rows = useMemo(
    () =>
      Array.from({ length: HISTORY_DAYS + LOOK_AHEAD }, (_, i) => {
        const row: Record<string, unknown> = { date: new Date(Date.UTC(2026, 0, 5 + i)) };
        for (const f of sim.futures) row[f.path.id] = f.days[i]?.automaticity ?? 1;
        return row;
      }),
    [sim]
  );

  let chain = 0;
  for (let d = HISTORY_DAYS - 1; d >= 0 && days[d] !== "missed"; d--) chain++;
  const showedUp = days.filter((d) => d !== "missed").length;

  const toggle = (index: number) => setDays((prev) => prev.map((d, i) => (i === index ? CYCLE[d] : d)));

  return (
    <div className="section-container py-20 max-w-6xl">
      <Heading title="Miss a day." muted="Watch what doesn't happen." />

      <div className="mt-12 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-10 items-start">
        <Reveal>
          <p className="text-sm text-white/60 mb-3">Your last four weeks. Tap a day to change it.</p>
          <div className="grid grid-cols-7 gap-2 max-w-sm">
            {days.map((d, i) => (
              <motion.button
                key={i}
                onClick={() => toggle(i)}
                aria-label={`Day ${i + 1}: ${OUTCOME_STYLE[d].label}. Tap to change.`}
                className="aspect-square rounded-xl cursor-pointer"
                animate={{ background: OUTCOME_STYLE[d].bg, scale: OUTCOME_STYLE[d].scale }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", bounce: 0.45, duration: 0.4 }}
              />
            ))}
          </div>

          <div className="mt-3 flex gap-4 text-[12px] text-white/60">
            {(["full", "tiny", "missed"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[4px]" style={{ background: k === "missed" ? "rgba(255,255,255,0.2)" : OUTCOME_STYLE[k].bg }} />
                {OUTCOME_STYLE[k].label}
              </span>
            ))}
          </div>

          <motion.p
            key={weekLine(days)}
            className="mt-7 font-medium text-white text-balance"
            style={{ fontSize: "clamp(1.25rem, 2.1vw, 1.65rem)", lineHeight: 1.25, letterSpacing: "-0.015em" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {weekLine(days)}
          </motion.p>

          <div className="mt-6 flex gap-10">
            <div>
              <p className="font-bold tabular-nums" style={{ color: "#00C47A", fontSize: "2.6rem", lineHeight: 1 }}>
                {showedUp}
              </p>
              <p className="mt-1 text-[13px] text-white">days you showed up</p>
            </div>
            <div>
              <p className="font-bold tabular-nums text-white/40" style={{ fontSize: "2.6rem", lineHeight: 1 }}>
                {chain}
              </p>
              <p className="mt-1 text-[13px] text-white/45">an all-or-nothing streak</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-sm text-white/60 mb-1">Where that could lead, as the habit becomes automatic</p>
          <LineChart data={rows} xDataKey="date" aspectRatio="8 / 5" animationDuration={1100} margin={{ left: 8, right: 8, top: 16, bottom: 16 }}>
            {sim.futures.map((f) => (
              <Line key={f.path.id} dataKey={f.path.id} stroke={FUTURE_COLORS[f.path.id] ?? "#0ABAB5"} strokeWidth={hovered === f.path.id ? 3.5 : 2.2} showHighlight={false} />
            ))}
          </LineChart>

          <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {sim.futures.map((f) => {
              const days_ = daysUntilAutomatic(f, HISTORY_DAYS);
              return (
                <button
                  key={f.path.id}
                  onMouseEnter={() => setHovered(f.path.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(f.path.id)}
                  onBlur={() => setHovered(null)}
                  className="flex items-start gap-2.5 text-left cursor-default"
                >
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: FUTURE_COLORS[f.path.id] ?? "#0ABAB5" }} />
                  <span>
                    <span className="block text-[14px] text-white font-medium">{f.path.name}</span>
                    <span className="block text-[12.5px] text-white/55 tabular-nums">
                      {days_ === null ? "Still building by day 70" : days_ === 0 ? "Feels automatic now" : `Automatic in about ${days_} days`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>

      <p className="mt-8 text-center text-[11px] text-white/40">
        Runs the app&apos;s simulator live with an example habit. An illustration, not a prediction. Range from {SIM_RESEARCH.source}.
      </p>
    </div>
  );
}

// ─── The rest ─────────────────────────────────────────────────────────────────

const NUDGES = [
  { id: "1", app: "Kinextion", title: "After your coffee", body: "Ten minutes. That's the whole thing.", time: "now", icon: <Bell size={16} /> },
  { id: "2", app: "Althea", title: "Your Strava run counted", body: "Logged your habit for you.", time: "2h", icon: <Bell size={16} /> },
  { id: "3", app: "Kairo", title: "Room opens tomorrow", body: "This week's question is in.", time: "5h", icon: <Bell size={16} /> },
];

function AlsoInTheApp() {
  return (
    <div className="section-container py-20 max-w-5xl">
      <div className="grid md:grid-cols-2 gap-10 md:gap-6 items-center">
        <Reveal>
          <h3 className="font-semibold text-white mb-8 text-balance" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)" }}>
            Reminders at the moment you decide.
          </h3>
          <NotificationStack notifications={NUDGES} />
          <p className="mt-3 text-[11px] text-white/40">Swipe them away. Sample reminders.</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[2rem] p-8" style={{ background: "linear-gradient(160deg, #A855F726, rgba(255,255,255,0.03) 70%)", border: "1px solid #A855F733" }}>
            <FileText size={28} color="#A855F7" />
            <h3 className="mt-5 font-semibold text-white text-balance" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)" }}>
              Give your therapist a head start.
            </h3>
            <p className="mt-3 text-white/70">You choose what goes in. You send it. Nothing is shared by default.</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
