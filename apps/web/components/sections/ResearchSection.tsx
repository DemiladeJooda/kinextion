"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GrowthTree } from "@/components/research-tree";
import { CountUp, EASE, Heading, Reveal } from "@/components/motion/primitives";

const SURVEY_URL = "https://docs.google.com/forms/d/1HGHbA5ClONIySoOE-lcQ5EQ-ovgHkQNVi7E4nF-StAs/preview";

/**
 * Every line here was checked in docs/claims-and-sources.md. Change a finding
 * there first, with its source, and only then here.
 */

type Topic = "Habits" | "Sleep" | "Body" | "People" | "Mind";

interface Source {
  readonly id: string;
  readonly type: "Book" | "Study" | "Studies" | "Meta-analysis" | "Long-running study";
  readonly topic: Topic;
  readonly title: string;
  readonly author: string;
  readonly year: string;
  readonly findings: readonly string[];
  readonly informs: string;
}

const TOPIC_COLOR: Record<Topic, string> = {
  Habits: "#00C47A",
  Sleep: "#3B82F6",
  Body: "#F59E0B",
  People: "#0ABAB5",
  Mind: "#A855F7",
};

const SOURCES: readonly Source[] = [
  {
    id: "implementation",
    type: "Studies",
    topic: "Habits",
    title: "Deciding when and where",
    author: "Milne, Orbell & Sheeran 2002 · Gollwitzer & Sheeran 2006",
    year: "2002–2006",
    findings: [
      "91% of people who wrote down when and where they'd exercise did it, against 35–38% of controls.",
      "A meta-analysis across many behaviours found a medium-to-large effect (d = 0.65).",
    ],
    informs: "Every habit in Kinextion starts with an anchor: after I pour my coffee.",
  },
  {
    id: "lally",
    type: "Study",
    topic: "Habits",
    title: "How are habits formed",
    author: "Lally, van Jaarsveld, Potts & Wardle",
    year: "2010",
    findings: [
      "A habit took a median of 66 days to become automatic, with a range of 18 to 254.",
      "Missing one opportunity did not materially affect the process.",
    ],
    informs: "Why the simulator shows several paths, and why a miss never resets you.",
  },
  {
    id: "fogg",
    type: "Book",
    topic: "Habits",
    title: "Tiny Habits",
    author: "BJ Fogg (behaviour model: Persuasive '09)",
    year: "2019",
    findings: [
      "Behaviour happens when motivation, ability and a prompt meet.",
      "Motivation fluctuates, so design for the day it's low.",
      "Fogg argues that celebrating straight after a behaviour helps it stick.",
    ],
    informs: "Every habit has a tiny version that still counts.",
  },
  {
    id: "sleep",
    type: "Studies",
    topic: "Sleep",
    title: "Sleep, regularity and health",
    author: "Windred 2024 · Prather 2015 · Cappuccio 2010 · Williamson & Feyer 2000",
    year: "2000–2024",
    findings: [
      "In 60,977 people, sleep regularity predicted mortality risk better than sleep duration.",
      "People sleeping under six hours had 4.2× the odds of catching a cold when exposed.",
      "A meta-analysis linked short sleep to 12% higher mortality.",
      "17–19 hours awake is equivalent to about a 0.05% blood-alcohol level.",
    ],
    informs: "Why last night's sleep can change today's plan.",
  },
  {
    id: "mandsager",
    type: "Study",
    topic: "Body",
    title: "Fitness and long-term mortality",
    author: "Mandsager et al., JAMA Network Open",
    year: "2018",
    findings: [
      "The least fit group had about five times the mortality risk of the elite group.",
      "Poor fitness carried risk comparable to or greater than smoking, diabetes and coronary disease.",
      "Muscle mass is also linked to survival in later life (Srikanthan & Karlamangla, 2014).",
    ],
    informs: "Why small, repeated movement is the point, whatever your starting place.",
  },
  {
    id: "kiviniemi",
    type: "Studies",
    topic: "Body",
    title: "Training by daily heart rate variability",
    author: "Kiviniemi et al. 2007 · Plews et al. 2013",
    year: "2007–2013",
    findings: [
      "VO₂peak rose from 56 to 60 ml/kg/min with HRV-guided training, with no significant change on a fixed plan.",
      "How your own HRV changes tells you more than the absolute number.",
    ],
    informs: "Why Althea reads recovery against your own baseline.",
  },
  {
    id: "holt-lunstad",
    type: "Meta-analysis",
    topic: "People",
    title: "Social connection and mortality",
    author: "Holt-Lunstad, Smith & Layton 2010 · Holt-Lunstad et al. 2015",
    year: "2010–2015",
    findings: [
      "Across 148 studies and 308,849 people, strong social ties meant 50% better odds of survival.",
      "Across 70 studies and 3.4 million people: loneliness +26%, isolation +29%, living alone +32% mortality risk.",
    ],
    informs: "Why community is part of the product, not an add-on.",
  },
  {
    id: "harvard",
    type: "Long-running study",
    topic: "People",
    title: "Harvard Study of Adult Development",
    author: "Waldinger & Schulz 2023 · Vaillant & Mukamal 2001",
    year: "1938–present",
    findings: [
      "85 years following 724 men: 268 Harvard students and 456 from Boston.",
      "Relationship satisfaction at 50 predicted health at 80 better than cholesterol did.",
    ],
    informs: "Why the weekly room asks for your voice, not your stats.",
  },
  {
    id: "christakis",
    type: "Studies",
    topic: "People",
    title: "How behaviour spreads between people",
    author: "Christakis & Fowler 2007–08 · Aral & Nicolaides 2017",
    year: "2007–2017",
    findings: [
      "If a close friend became obese, a person's own risk rose 57%, and 171% when both named each other as friends.",
      "Exercise spreads through social networks too.",
      "The causal reading is debated (Cohen-Cole & Fletcher, 2008).",
    ],
    informs: "Why you do this around other people.",
  },
  {
    id: "mcgonigal",
    type: "Studies",
    topic: "Mind",
    title: "Being kind to yourself after a slip",
    author: "Breines & Chen 2012 · Bowen & Marlatt 2009 · Segerstrom & Nes 2007",
    year: "2007–2012",
    findings: [
      "Self-compassion after failure led to more motivation to improve than self-criticism.",
      "In one study, noticing an urge without acting on it reduced smoking.",
      "Heart rate variability is correlated with self-regulation.",
    ],
    informs: "Why Kairo meets a missed day with curiosity, not pressure.",
  },
  {
    id: "nummenmaa",
    type: "Study",
    topic: "Mind",
    title: "Bodily maps of emotions",
    author: "Nummenmaa et al., PNAS",
    year: "2014",
    findings: [
      "About 700 people in West European and East Asian samples mapped emotions to consistent body regions.",
      "The authors argue bodily sensation is part of what an emotion is.",
    ],
    informs: "Why check-ins ask about energy and stress alongside mood.",
  },
  {
    id: "hari",
    type: "Book",
    topic: "Mind",
    title: "Lost Connections",
    author: "Johann Hari",
    year: "2018",
    findings: [
      "Hari argues that most causes of depression and anxiety are social and environmental. This is his thesis, not a consensus.",
      "Evidence on social prescribing is still mixed (Bickerdike et al., 2017).",
    ],
    informs: "A prompt to ask about connection. Never a replacement for care.",
  },
  {
    id: "loehr",
    type: "Book",
    topic: "Mind",
    title: "The Power of Full Engagement",
    author: "Jim Loehr & Tony Schwartz",
    year: "2003",
    findings: [
      "The book's framework: manage energy, and treat recovery as half of performance.",
      "Related research on recovery from work: Sonnentag & Fritz, 2007.",
    ],
    informs: "Why rest days count, and nothing is owed on them.",
  },
];

const TOPICS = ["All", ...Object.keys(TOPIC_COLOR)] as const;

export function ResearchSection() {
  return (
    <section className="relative">
      <div className="section-container pt-20 sm:pt-28 pb-10">
        <Heading label="Research" color="#3B82F6" title="We didn't guess." muted="We studied." />
      </div>

      <WhenAndWhere />
      <SixtySixDays />
      <Together />
      <Regularity />

      <div className="section-container pt-24">
        <Heading title="Every feature is part of one living system." />
        <div className="mt-12">
          <GrowthTree />
        </div>
      </div>

      <Library />
      <Survey />
    </section>
  );
}

// ─── The four findings ────────────────────────────────────────────────────────

function Finding({
  claim,
  visual,
  citation,
  changed,
  color,
  flip = false,
}: {
  readonly claim: string;
  readonly visual: React.ReactNode;
  readonly citation: string;
  readonly changed: string;
  readonly color: string;
  readonly flip?: boolean;
}) {
  return (
    <div className="section-container py-16 sm:py-24 grid lg:grid-cols-2 gap-10 items-center">
      <Reveal className={flip ? "lg:order-2" : undefined}>
        <h3 className="font-semibold text-white text-balance" style={{ fontSize: "clamp(1.9rem, 4vw, 3.2rem)", lineHeight: 1.1 }}>
          {claim}
        </h3>
        <p className="mt-4 text-lg" style={{ color }}>
          {changed}
        </p>
        <p className="mt-3 text-xs text-white/45">{citation}</p>
      </Reveal>
      <Reveal delay={0.1} className={flip ? "lg:order-1" : undefined}>
        {visual}
      </Reveal>
    </div>
  );
}

function Bar({ label, value, color, delay }: { readonly label: string; readonly value: number; readonly color: string; readonly delay: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[15px] text-white/75">{label}</span>
        <CountUp to={value} suffix="%" className="font-bold tabular-nums text-3xl" style={{ color }} />
      </div>
      <div className="h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <motion.div
          className="h-full rounded-full origin-left"
          style={{ width: `${value}%`, background: color }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay, ease: EASE }}
        />
      </div>
    </div>
  );
}

function WhenAndWhere() {
  return (
    <Finding
      claim="Write down when and where, and you're far more likely to do it."
      changed="So every habit starts with an anchor."
      citation="Milne, Orbell & Sheeran, 2002. British Journal of Health Psychology."
      color="#00C47A"
      visual={
        <div className="space-y-7">
          <Bar label="Wrote down when and where" value={91} color="#00C47A" delay={0.1} />
          <Bar label="Didn't" value={38} color="rgba(255,255,255,0.4)" delay={0.3} />
        </div>
      }
    />
  );
}

function SixtySixDays() {
  const position = (day: number) => `${(day / 254) * 100}%`;
  return (
    <Finding
      flip
      claim="A habit takes about 66 days. Or 18. Or 254."
      changed="So there's no 21-day promise here. And a missed day doesn't undo it."
      citation="Lally, van Jaarsveld, Potts & Wardle, 2010. European Journal of Social Psychology."
      color="#00C47A"
      visual={
        <div className="pt-16 pb-10 px-2">
          <div className="relative h-3 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="absolute top-0 bottom-0 rounded-full origin-left"
              style={{ left: position(18), right: 0, background: "linear-gradient(90deg, #00C47A, #0ABAB5 40%, rgba(10,186,181,0.15))" }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: EASE }}
            />
            {[
              { day: 18, label: "18", delay: 0.2 },
              { day: 66, label: "66 days, the median", delay: 0.6, big: true },
              { day: 254, label: "254", delay: 1.2 },
            ].map((m) => (
              <motion.div
                key={m.day}
                className="absolute top-1/2"
                style={{ left: position(m.day) }}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: m.delay, type: "spring", bounce: 0.4 }}
              >
                <span className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white" style={{ boxShadow: "0 0 18px #00C47A" }} />
                <span className={`absolute whitespace-nowrap font-semibold text-white ${m.big ? "-top-12 -translate-x-1/2 text-lg" : m.day === 254 ? "top-6 -translate-x-full text-sm" : "top-6 -translate-x-1/2 text-sm"}`}>
                  {m.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      }
    />
  );
}

const STRONG_TIES_DOTS = Array.from({ length: 48 }, (_, i) => {
  const ring = i < 16 ? 0 : 1;
  const count = ring === 0 ? 16 : 32;
  const index = ring === 0 ? i : i - 16;
  const angle = (index / count) * Math.PI * 2;
  const radius = ring === 0 ? 86 : 138;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
});

function Together() {
  return (
    <Finding
      claim="People with strong social ties had 50% better odds of survival."
      changed="So community is part of the product."
      citation="Holt-Lunstad, Smith & Layton, 2010. PLoS Medicine. 148 studies, 308,849 people."
      color="#0ABAB5"
      visual={
        <div className="relative mx-auto" style={{ width: 320, height: 320, maxWidth: "100%" }}>
          <svg viewBox="-160 -160 320 320" className="absolute inset-0 w-full h-full" aria-hidden>
            {STRONG_TIES_DOTS.map((d, i) => (
              <motion.line
                key={i}
                x1={0}
                y1={0}
                x2={d.x}
                y2={d.y}
                stroke="#0ABAB5"
                strokeOpacity={0.3}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.02, duration: 0.5 }}
              />
            ))}
            {STRONG_TIES_DOTS.map((d, i) => (
              <motion.circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={5}
                fill="#0ABAB5"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.02, type: "spring", bounce: 0.5 }}
              />
            ))}
            <circle r="22" fill="#FFFFFF" />
          </svg>
        </div>
      }
    />
  );
}

function Regularity() {
  const nights = Array.from({ length: 14 }, (_, i) => i);
  return (
    <Finding
      flip
      claim="When you sleep may matter more than how long."
      changed="So sleep rhythm is one of the next signals we're adding."
      citation="Windred et al., 2024. Sleep. 60,977 people."
      color="#3B82F6"
      visual={
        <div className="space-y-6">
          {[
            { label: "Irregular", color: "rgba(255,255,255,0.4)", jitter: 1 },
            { label: "Regular", color: "#3B82F6", jitter: 0.1 },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-[15px] text-white/75 mb-1">{row.label}</p>
              <div className="relative h-20 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                {nights.map((n) => {
                  const offset = (((n * 53) % 21) - 10) * row.jitter;
                  return (
                    <motion.span
                      key={n}
                      className="absolute w-2.5 h-2.5 rounded-full"
                      style={{ left: `${4 + n * 6.8}%`, background: row.color }}
                      initial={{ top: "50%", opacity: 0 }}
                      whileInView={{ top: `calc(46% + ${offset * 2.8}px)`, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: n * 0.05, type: "spring", bounce: 0.3 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-white/45">Illustration: bedtimes over two weeks</p>
        </div>
      }
    />
  );
}

// ─── The library ──────────────────────────────────────────────────────────────

function Library() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("All");
  const [openId, setOpenId] = useState<string>(SOURCES[0].id);

  const visible = useMemo(() => SOURCES.filter((s) => topic === "All" || s.topic === topic), [topic]);
  const open = visible.find((s) => s.id === openId) ?? visible[0];
  const color = TOPIC_COLOR[open.topic];

  return (
    <div className="section-container pt-24 pb-10">
      <Heading title="The sources." muted="Tap one." />

      <Reveal className="mt-8 flex flex-wrap justify-center gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            aria-pressed={t === topic}
            className="px-4 h-10 rounded-full text-sm cursor-pointer transition-colors"
            style={{ background: t === topic ? "#FFFFFF" : "rgba(255,255,255,0.06)", color: t === topic ? "#05070F" : "rgba(255,255,255,0.7)" }}
          >
            {t}
          </button>
        ))}
      </Reveal>

      <div className="mt-8 grid lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {visible.map((s) => {
            const active = s.id === open.id;
            return (
              <motion.button
                key={s.id}
                layout
                onClick={() => setOpenId(s.id)}
                aria-pressed={active}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                className="text-left rounded-2xl p-4 cursor-pointer"
                style={{ background: active ? `${TOPIC_COLOR[s.topic]}26` : "rgba(255,255,255,0.04)", border: `1px solid ${active ? `${TOPIC_COLOR[s.topic]}88` : "rgba(255,255,255,0.08)"}` }}
              >
                <p className="text-xs font-semibold" style={{ color: TOPIC_COLOR[s.topic] }}>
                  {s.type} · {s.year}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-white leading-snug">{s.title}</p>
              </motion.button>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={open.id}
              className="rounded-[2rem] p-6 sm:p-8"
              style={{ background: `linear-gradient(160deg, ${color}1F, rgba(255,255,255,0.03) 70%)`, border: `1px solid ${color}44` }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <h3 className="font-semibold text-white text-2xl">{open.title}</h3>
              <p className="mt-1 text-sm text-white/55">{open.author}</p>
              <ul className="mt-5 space-y-3">
                {open.findings.map((f) => (
                  <li key={f} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] font-medium" style={{ color }}>
                {open.informs}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Survey() {
  return (
    <div className="section-container py-20 text-center">
      <Reveal>
        <h3 className="font-semibold text-white" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.4rem)" }}>
          Help shape the research.
        </h3>
        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block px-7 py-3 rounded-full font-semibold text-sm text-[#05070F] bg-white"
        >
          Take the 3-minute survey ↗
        </a>
      </Reveal>
    </div>
  );
}
