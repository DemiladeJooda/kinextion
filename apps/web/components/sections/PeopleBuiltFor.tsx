"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── 15 US personas ───────────────────────────────────────────────────────────
// Each persona is a realistic "this could be you" portrait used to build empathy:
// who they are, their situation, a verbatim-style quote, the underlying reality
// (pain point), and how Kinextion specifically helps them.
const personas = [
  {
    name: "Tyler, 26", role: "Software Developer · San Francisco",
    situation: "Codes 60+ hrs/week. Has a gym near the office he visits every two months. Knows exactly what to eat, but DoorDash wins every Tuesday night.",
    quote: "I optimize everything at work but I can't get myself to drink water consistently. I don't understand what's wrong with me.",
    color: "#00C47A", initial: "T",
    painPoint: "High achiever who can't crack personal consistency",
    kinextion: "Systems built around optimization, not willpower",
  },
  {
    name: "Ashley, 33", role: "Registered Nurse · Dallas",
    situation: "12-hour shifts leave nothing in the tank. Takes care of patients all day — by the time she gets home, self-care feels selfish, even though she prescribes it daily.",
    quote: "I tell my patients to rest and eat well. I haven't done that myself in three years.",
    color: "#0ABAB5", initial: "A",
    painPoint: "Caregiver burnout with zero energy left for self",
    kinextion: "10-minute check-ins built for between shifts, not around them",
  },
  {
    name: "Marcus, 28", role: "Marketing Manager · New York",
    situation: "Runs campaigns for Fortune 500 brands. Tried Noom, Beachbody, keto, a personal trainer. Killed it for 6 weeks every time — then a big project hits and it all collapses.",
    quote: "The problem isn't finding a program. It's that programs don't survive contact with my actual life.",
    color: "#A855F7", initial: "M",
    painPoint: "Work intensity systematically destroys wellness streaks",
    kinextion: "A system that adapts when your workload spikes — doesn't start over",
  },
  {
    name: "Jennifer, 45", role: "Middle School Teacher · Chicago",
    situation: "Three kids, aging parents, and 28 seventh graders. Health always comes last. Hasn't exercised consistently since 2019 and can feel the difference every single day.",
    quote: "Everyone needs something from me. There's never a moment that's just mine.",
    color: "#3B82F6", initial: "J",
    painPoint: "No bandwidth — every gap fills with someone else's needs",
    kinextion: "Micro sessions that fit in the margins of a full life",
  },
  {
    name: "Jordan, 22", role: "College Senior · Austin",
    situation: "Follows 14 wellness creators. Has tried intermittent fasting, cold plunges, morning routines, and journaling — sometimes all in the same week.",
    quote: "There's so much advice I feel more lost than when I started. I just want someone to tell me what to actually do.",
    color: "#00C47A", initial: "J",
    painPoint: "Information overload with no personalized direction",
    kinextion: "One clear path built for Jordan — not for the algorithm",
  },
  {
    name: "Chris, 39", role: "Regional Sales Manager · Atlanta",
    situation: "240 days a year on the road. Hotel gyms, airport food, client dinners. Loves fitness when he's home. Can't maintain a single thing when he's not.",
    quote: "My healthy self only exists in my apartment. The moment I travel, he disappears.",
    color: "#F59E0B", initial: "C",
    painPoint: "Inconsistent environment destroys consistent habits",
    kinextion: "Adapts to wherever you are — hotel room, airport, home",
  },
  {
    name: "Sam, 31", role: "Stay-at-home Parent · Denver",
    situation: "Was a college athlete. Two kids later, barely recognizes herself in the mirror. Wants her confidence back but can't justify 'selfish' time.",
    quote: "I used to be so disciplined. Now I can't even do a 20-minute workout without guilt.",
    color: "#EC4899", initial: "S",
    painPoint: "Lost identity — guilt overrides every attempt at self-care",
    kinextion: "Reframes self-care as the most productive thing you can do for your family",
  },
  {
    name: "DeShawn, 27", role: "Firefighter · Houston",
    situation: "24-on, 48-off shifts. Peak physical job, but erratic schedule, disrupted sleep, and stress that doesn't turn off after the alarm is silenced.",
    quote: "I'm literally trained to be fit. But my shift schedule makes any routine impossible.",
    color: "#EF4444", initial: "D",
    painPoint: "Non-standard schedule shatters every routine attempt",
    kinextion: "Builds around your shift pattern, not a 9-to-5 assumption",
  },
  {
    name: "Emily, 24", role: "Graduate Student · Boston",
    situation: "Mental health is her biggest blocker. Anxious about her research, socially isolated, knows movement would help — but on the hardest days, starting feels impossible.",
    quote: "I know exercise would make me feel better. I just can't make myself do it on the days I need it most.",
    color: "#0ABAB5", initial: "E",
    painPoint: "Mental health spiral blocks the very actions that would help",
    kinextion: "Kairo meets her where she is before Althea asks anything of her",
  },
  {
    name: "Robert, 52", role: "Operations Director · Seattle",
    situation: "Pre-diabetes diagnosis six months ago. Doctor said 'make changes.' He doesn't know where to start at 52 with a knee that acts up and a metabolism that doesn't cooperate.",
    quote: "I want to do this right this time. I just don't know what 'right' looks like for someone my age.",
    color: "#3B82F6", initial: "R",
    painPoint: "Medical urgency with no personalized starting point",
    kinextion: "Age- and condition-aware plans that start where Robert actually is",
  },
  {
    name: "Aisha, 36", role: "Corporate Attorney · Washington DC",
    situation: "Sleeps 5 hours on good nights. Coffee replaces meals. Her firm culture rewards output over wellness. Something has to change before her body makes the decision for her.",
    quote: "I've billed 2,800 hours this year. I've slept maybe 1,200. The math doesn't work and I know it.",
    color: "#A855F7", initial: "A",
    painPoint: "Career culture actively hostile to sustainable self-care",
    kinextion: "Finds the exact 15 minutes your schedule can absorb — and defends them",
  },
  {
    name: "Connor, 29", role: "Personal Trainer · Miami",
    situation: "Coaches 8 clients a day on recovery and mental health. Goes home depleted. His own mental health has been on the back burner for two years running.",
    quote: "I know every technique in the book. I just can't seem to use them for myself.",
    color: "#00C47A", initial: "C",
    painPoint: "Professional knowledge without personal application",
    kinextion: "Kairo provides the external accountability even experts need",
  },
  {
    name: "Brianna, 20", role: "Pre-Med Student · Columbus",
    situation: "MCAT prep, 18 credit hours, part-time job. Burned out at 20. Knows she can't maintain this pace but doesn't see another option.",
    quote: "I built my whole identity around being the hardworking one. Rest feels like failure.",
    color: "#7B2FBE", initial: "B",
    painPoint: "Identity wrapped in overwork — rest treated as failure",
    kinextion: "Redefines high performance to include sustainable recovery",
  },
  {
    name: "Kevin, 44", role: "Small Business Owner · Phoenix",
    situation: "Built a successful landscaping company from scratch. Sacrificed his health doing it. 60 lbs heavier than he was at 30. Wants to be here for his kids.",
    quote: "I built a business. I should be able to build a healthy body. But I don't have a playbook for this.",
    color: "#F59E0B", initial: "K",
    painPoint: "Successful in business, completely lost outside of it",
    kinextion: "The same systematic approach he uses for business — applied to health",
  },
  {
    name: "Stephanie, 58", role: "Empty Nester · Nashville",
    situation: "Kids left home last year. Reinventing herself for the first time in 25 years. Never prioritized herself. Wants to feel alive again — doesn't know what that looks like now.",
    quote: "I spent 25 years taking care of everyone else. I don't even know what I like anymore.",
    color: "#0ABAB5", initial: "S",
    painPoint: "Lost identity after decades of putting others first",
    kinextion: "Helps rediscover who she is through small, joyful daily wins",
  },
];

// ─── Persona card slide variants ──────────────────────────────────────────────
// The detail card slides in from the side the user is navigating toward
// (`d` = direction: +1 forward, -1 back) and slides out the opposite way.
const personaVariants = {
  enter: (d: number) => ({ x: d > 0 ? "40%" : "-40%", opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (d: number) => ({ x: d > 0 ? "-40%" : "40%", opacity: 0, scale: 0.96 }),
};

// "The people this is built for" — an immersive 3-panel persona carousel.
// Lives on a LIGHT page (Research). Auto-advances, pauses on manual navigation,
// and shows a large centre portrait flanked by the previous/next personas plus
// an expandable detail card below.
export function PeopleBuiltFor() {
  // Index of the centred persona, the last navigation direction, and whether
  // auto-advance is temporarily paused after a manual interaction.
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselDir, setCarouselDir] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance every 4.5s while not paused.
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setCarouselDir(1);
      setCarouselIdx((i) => (i + 1) % personas.length);
    }, 4500);
    return () => clearInterval(id);
  }, [isPaused]);

  // Move one persona forward/back and pause auto-advance for 6s afterwards.
  const advance = (dir: 1 | -1) => {
    setCarouselDir(dir);
    setCarouselIdx((i) => (i + dir + personas.length) % personas.length);
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setIsPaused(false), 6000);
  };

  // Jump directly to a persona (dot click) and pause auto-advance.
  const goTo = (index: number) => {
    setCarouselDir(index > carouselIdx ? 1 : -1);
    setCarouselIdx(index);
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setIsPaused(false), 6000);
  };

  const currentPersona = personas[carouselIdx];
  const prevPersona = personas[(carouselIdx - 1 + personas.length) % personas.length];
  const nextPersona = personas[(carouselIdx + 1) % personas.length];

  return (
    <div className="relative z-10 pt-8 pb-4">
      {/* Divider + heading */}
      <div className="border-t pt-20 mb-14" style={{ borderColor: "rgba(0,0,0,0.07)" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.55 }}
        className="text-center mb-12"
      >
        <p className="section-label" style={{ color: "#A855F7" }}>
          Does any of this feel familiar?
        </p>
        <h3
          className="font-bold mb-4 text-balance"
          style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.8rem)", color: "#0F172A" }}
        >
          The people this is built for.
        </h3>
        <p className="max-w-lg mx-auto text-balance" style={{ color: "#475569" }}>
          Different lives. Different struggles. One shared pattern — a system that was never
          built to handle the full complexity of a real person.
        </p>
      </motion.div>

      <div className="relative max-w-5xl mx-auto">
        {/* Prev arrow */}
        <button
          onClick={() => advance(-1)}
          className="absolute left-0 top-[170px] -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{ background: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.10)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", color: "#475569" }}
          aria-label="Previous persona"
        >
          ←
        </button>

        {/* Next arrow */}
        <button
          onClick={() => advance(1)}
          className="absolute right-0 top-[170px] -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{ background: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.10)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", color: "#475569" }}
          aria-label="Next persona"
        >
          →
        </button>

        {/* 3-panel orbit visual: faded prev (left), large current (centre), faded next (right) */}
        <div className="relative h-[340px] md:h-[380px] flex items-center justify-center overflow-hidden">

          {/* Prev — small, dimmed, slid left */}
          <motion.div
            animate={{ opacity: 0.35, scale: 0.82, x: "-190%" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-1/2 top-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold"
                style={{ background: `${prevPersona.color}10`, border: `1.5px solid ${prevPersona.color}30`, color: prevPersona.color, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}
              >
                {prevPersona.initial}
              </div>
              <p className="mt-4 text-xs md:text-sm font-semibold" style={{ color: "#64748B" }}>{prevPersona.name}</p>
            </div>
          </motion.div>

          {/* Current — large concentric-ring portrait at centre */}
          <motion.div
            animate={{ opacity: 1, scale: 1, x: "0%" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="relative w-[220px] h-[220px] md:w-[280px] md:h-[280px] rounded-full flex items-center justify-center"
                style={{ background: `radial-gradient(circle at 30% 30%, ${currentPersona.color}18, ${currentPersona.color}08 58%, transparent 100%)` }}
              >
                <div className="absolute inset-[10px] rounded-full" style={{ background: `${currentPersona.color}08`, border: `1px solid ${currentPersona.color}25` }} />
                <div className="absolute inset-[24px] rounded-full" style={{ background: "#FFFFFF", border: `2px solid ${currentPersona.color}25`, boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }} />
                {/* Inner content fades/scales in each time the persona changes */}
                <motion.div
                  key={carouselIdx}
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="relative z-10 flex flex-col items-center px-6"
                >
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-3xl md:text-4xl font-bold mb-4"
                    style={{ background: `${currentPersona.color}12`, border: `2px solid ${currentPersona.color}30`, color: currentPersona.color }}
                  >
                    {currentPersona.initial}
                  </div>
                  <p className="font-bold text-lg md:text-xl leading-tight text-balance" style={{ color: "#0F172A" }}>{currentPersona.name}</p>
                  <p className="text-xs md:text-sm mt-2 max-w-[220px] text-balance" style={{ color: currentPersona.color }}>{currentPersona.role}</p>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Next — small, dimmed, slid right */}
          <motion.div
            animate={{ opacity: 0.35, scale: 0.82, x: "190%" }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-1/2 top-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold"
                style={{ background: `${nextPersona.color}10`, border: `1.5px solid ${nextPersona.color}30`, color: nextPersona.color, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}
              >
                {nextPersona.initial}
              </div>
              <p className="mt-4 text-xs md:text-sm font-semibold" style={{ color: "#64748B" }}>{nextPersona.name}</p>
            </div>
          </motion.div>
        </div>

        {/* Dot indicators — current dot widens; click to jump */}
        <div className="flex items-center justify-center gap-2 mt-2 mb-8">
          {personas.map((persona, index) => (
            <button
              key={persona.name}
              onClick={() => goTo(index)}
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: index === carouselIdx ? 28 : 8, background: index === carouselIdx ? currentPersona.color : "rgba(15,23,42,0.12)" }}
              aria-label={`Go to ${persona.name}`}
            />
          ))}
        </div>

        {/* Detail card with stacked-depth shadow layers behind it */}
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-x-3 top-2 bottom-0 rounded-2xl opacity-10 pointer-events-none" style={{ background: currentPersona.color, border: `1px solid ${currentPersona.color}30`, borderRadius: 14 }} />
          <div className="absolute inset-x-1.5 top-1 bottom-0 rounded-2xl opacity-20 pointer-events-none" style={{ background: currentPersona.color, border: `1px solid ${currentPersona.color}30`, borderRadius: 13 }} />

          <div className="overflow-hidden relative z-10">
            <AnimatePresence mode="wait" custom={carouselDir}>
              <motion.div
                key={carouselIdx}
                custom={carouselDir}
                variants={personaVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.25, 0.1, 0.25, 1] }}
                className="glass-card-vivid p-6 md:p-7 flex flex-col"
                style={{ border: `1px solid ${currentPersona.color}22` }}
              >
                {/* Card header: avatar, name/role, and position counter */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                    style={{ background: `${currentPersona.color}12`, border: `2px solid ${currentPersona.color}35`, color: currentPersona.color }}
                  >
                    {currentPersona.initial}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#0F172A" }}>{currentPersona.name}</p>
                    <p className="text-[11px]" style={{ color: currentPersona.color }}>{currentPersona.role}</p>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${currentPersona.color}08`, border: `1px solid ${currentPersona.color}20`, color: currentPersona.color }}
                    >
                      {carouselIdx + 1} / {personas.length}
                    </span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-4" style={{ color: "#475569" }}>{currentPersona.situation}</p>

                {/* Verbatim-style quote */}
                <div className="rounded-xl p-4 mb-4" style={{ background: `${currentPersona.color}07`, border: `1px solid ${currentPersona.color}18` }}>
                  <p className="text-sm italic leading-relaxed" style={{ color: "#374151" }}>
                    &ldquo;{currentPersona.quote}&rdquo;
                  </p>
                </div>

                {/* Reality (pain point) vs. how Kinextion answers it */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-semibold w-16 shrink-0 mt-0.5" style={{ color: "#EF4444" }}>Reality</span>
                    <span className="text-[12px]" style={{ color: "#64748B" }}>{currentPersona.painPoint}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-semibold w-16 shrink-0 mt-0.5" style={{ color: currentPersona.color }}>Kinextion</span>
                    <span className="text-[12px]" style={{ color: "#374151" }}>{currentPersona.kinextion}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
