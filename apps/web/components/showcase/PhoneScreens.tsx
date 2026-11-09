"use client";

/**
 * A phone showing the app's real flows, drawn in the app's own design tokens
 * (apps/mobile/theme). Sample content only, and labelled as such where shown.
 * When real iPhone recordings exist, they can replace these one at a time.
 */

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Lock, Mic, Sparkles } from "lucide-react";
import { EASE } from "@/components/motion/primitives";

const C = {
  bg: "#070B14",
  surface: "#0E1524",
  border: "rgba(255,255,255,0.07)",
  text: "#F5F8FC",
  muted: "#94A3B8",
  faint: "#5A6B85",
  green: "#00C47A",
  teal: "#0ABAB5",
  purple: "#A855F7",
  amber: "#F59E0B",
};

const PHONE_W = 300;
const PHONE_H = 634;

/**
 * Drawn at one fixed size and scaled as a whole, so a small viewport gets a
 * smaller phone rather than a phone with clipped contents.
 */
export function PhoneFrame({ children, glow = "#0ABAB5" }: { readonly children: ReactNode; readonly glow?: string }) {
  const [scale, setScale] = useState(0.85);

  useEffect(() => {
    const fit = () => {
      const share = window.innerWidth >= 1024 ? 0.82 : 0.6;
      setScale(Math.min(1, (window.innerHeight * share) / PHONE_H));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <motion.div
      className="relative mx-auto"
      style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
      animate={{ filter: `drop-shadow(0 30px 80px ${glow}55)` }}
      transition={{ duration: 0.8 }}
    >
      <div
        className="absolute top-0 left-0 rounded-[3rem] p-[7px] origin-top-left"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, background: "linear-gradient(150deg, #39445A 0%, #10151F 40%, #2A3345 100%)" }}
      >
        <div className="relative w-full h-full rounded-[2.6rem] overflow-hidden" style={{ background: C.bg }}>
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 rounded-full"
            style={{ width: "32%", height: 22, background: "#000" }}
          />
          {children}
        </div>
      </div>
    </motion.div>
  );
}

function Screen({ title, children }: { readonly title?: string; readonly children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 pt-14 px-4 flex flex-col"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {title ? (
        <p className="font-extrabold text-[22px] tracking-[-0.03em] mb-3" style={{ color: C.text }}>
          {title}
        </p>
      ) : null}
      {children}
    </motion.div>
  );
}

const ANSWERS = ["Someone who moves every day", "A calmer parent", "Someone who sleeps", "A person who shows up"];

export function BecomingScreen() {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: C.teal }}>
        Step 3 of 6
      </p>
      <p className="font-extrabold text-[25px] leading-[1.15] tracking-[-0.03em] mb-6" style={{ color: C.text }}>
        Who do you want to become?
      </p>
      <div className="space-y-2.5">
        {ANSWERS.map((a, i) => (
          <motion.div
            key={a}
            className="rounded-2xl px-4 py-3.5 text-[13px] font-semibold"
            initial={{ opacity: 0, x: 18 }}
            animate={{
              opacity: 1,
              x: 0,
              background: i === 0 ? ["rgba(255,255,255,0.05)", "rgba(0,196,122,0.18)"] : "rgba(255,255,255,0.05)",
              color: i === 0 ? [C.muted, "#FFFFFF"] : C.muted,
            }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.45, ease: EASE, background: { delay: 1, duration: 0.4 }, color: { delay: 1, duration: 0.4 } }}
          >
            {a}
          </motion.div>
        ))}
      </div>
    </Screen>
  );
}

const HABITS = [
  { name: "Evening walk", detail: "After dinner · 10 min", accent: C.green },
  { name: "Lights out by 11", detail: "After brushing teeth", accent: C.purple },
  { name: "Stretch", detail: "After my coffee · 2 min", accent: C.amber },
];

export function HabitsScreen() {
  return (
    <Screen title="Today">
      <div className="rounded-2xl p-3.5 flex items-center gap-3 mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90 shrink-0">
          <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <motion.circle
            cx="28"
            cy="28"
            r="23"
            fill="none"
            stroke={C.green}
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 2 / 3 }}
            transition={{ delay: 0.5, duration: 1.3, ease: EASE }}
          />
        </svg>
        <div>
          <p className="text-[11px]" style={{ color: C.muted }}>
            Someone who moves every day
          </p>
          <p className="font-bold text-[15px]" style={{ color: C.text }}>
            2 of 3 done
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {HABITS.map((h, i) => (
          <motion.div
            key={h.name}
            className="rounded-2xl p-3 flex items-center gap-3"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.12, ease: EASE, duration: 0.5 }}
          >
            <motion.span
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              initial={{ background: "rgba(255,255,255,0.06)" }}
              animate={{ background: i < 2 ? h.accent : "rgba(255,255,255,0.06)" }}
              transition={{ delay: 0.8 + i * 0.5, duration: 0.3 }}
            >
              {i < 2 ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.85 + i * 0.5, type: "spring", bounce: 0.6 }}>
                  <Check size={15} color="#05070F" strokeWidth={3} />
                </motion.span>
              ) : null}
            </motion.span>
            <div className="min-w-0">
              <p className="font-semibold text-[13px]" style={{ color: C.text }}>
                {h.name}
              </p>
              <p className="text-[11px]" style={{ color: C.faint }}>
                {h.detail}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-3 self-start rounded-full px-3 py-1.5 text-[11px] font-semibold"
        style={{ background: "rgba(0,196,122,0.12)", color: C.green }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.1, type: "spring", bounce: 0.4 }}
      >
        Missed Tuesday. Still 18 of 21.
      </motion.div>
    </Screen>
  );
}

export function GuideScreen() {
  return (
    <Screen>
      <p className="text-center font-bold text-[15px] mb-1" style={{ color: C.text }}>
        Althea
      </p>
      <p className="text-center text-[11px] mb-4" style={{ color: C.green }}>
        Listening
      </p>
      <div className="relative mx-auto mb-5" style={{ width: 120, height: 120 }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ inset: i * 14, border: `1px solid ${C.green}66` }}
            animate={{ scale: [1, 1.16, 1], opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
        <motion.span
          className="absolute rounded-full"
          style={{ inset: 40, background: `radial-gradient(circle at 35% 30%, #fff, ${C.green} 40%, ${C.teal})`, boxShadow: `0 0 40px ${C.green}` }}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      </div>
      <div className="space-y-2.5">
        <motion.p
          className="ml-auto max-w-[85%] w-fit rounded-2xl px-3.5 py-2 text-[12.5px]"
          style={{ background: "rgba(255,255,255,0.09)", color: C.text }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Only slept five hours. I can&apos;t do the gym today.
        </motion.p>
        <motion.p
          className="text-[13.5px] leading-snug"
          style={{ color: C.text }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          Then we don&apos;t do the gym. Ten-minute walk after lunch. It counts, and your streak&apos;s fine.
        </motion.p>
        <motion.div
          className="rounded-2xl p-3 flex items-center gap-2.5"
          style={{ background: "rgba(0,196,122,0.1)", border: `1px solid ${C.green}33` }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.4, type: "spring", bounce: 0.35 }}
        >
          <Sparkles size={15} color={C.green} />
          <p className="text-[12px] font-semibold" style={{ color: C.text }}>
            Swapped today to a 10-minute walk
          </p>
        </motion.div>
      </div>
      <div className="mt-auto mb-5 flex justify-center">
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: C.green }}>
          <Mic size={20} color="#05070F" />
        </span>
      </div>
    </Screen>
  );
}

const PATHS = [
  { c: C.green, d: "M0 88 C20 70 34 56 54 42 S92 20 120 14 S160 10 180 8" },
  { c: C.teal, d: "M0 88 C24 84 36 70 60 64 S84 62 104 40 S150 18 180 16" },
  { c: C.purple, d: "M0 88 C18 80 28 86 48 72 S86 74 112 50 S154 34 180 26" },
  { c: C.amber, d: "M0 88 C30 86 44 80 70 78 S108 66 128 54 S162 42 180 36" },
  { c: "#EC4899", d: "M0 88 C16 62 30 72 52 60 S76 66 94 44 S148 40 180 22" },
  { c: "#3B82F6", d: "M0 88 C34 88 58 84 84 78 S132 70 150 60 S170 54 180 50" },
];

export function SimulatorScreen() {
  return (
    <Screen title="Six ways there">
      <p className="text-[12px] mb-3" style={{ color: C.muted }}>
        One habit, one life, 90 days. A missed day never resets to zero.
      </p>
      <div className="rounded-2xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <svg viewBox="0 0 180 96" className="w-full">
          <line x1="0" y1="26" x2="180" y2="26" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
          {PATHS.map((p, i) => (
            <motion.path
              key={p.c}
              d={p.d}
              fill="none"
              stroke={p.c}
              strokeWidth="1.8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.14, duration: 1.7, ease: "easeInOut" }}
            />
          ))}
        </svg>
        <p className="text-[10px] mt-1" style={{ color: C.faint }}>
          Dotted line: when it starts to feel automatic
        </p>
      </div>
      <motion.p
        className="mt-3 text-[11px]"
        style={{ color: C.faint }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        An illustration built on published ranges, never a prediction.
      </motion.p>
    </Screen>
  );
}

const RESPONSES = ["Dee · 4 min", "Sam · 6 min", "Ari · 3 min", "Noor · 7 min"];

export function RoomScreen() {
  return (
    <Screen>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: C.teal }}>
        This week&apos;s room
      </p>
      <p className="font-extrabold text-[20px] leading-[1.18] tracking-[-0.025em] mb-4" style={{ color: C.text }}>
        What did you stop doing that made life better?
      </p>
      <div className="rounded-2xl p-3 flex items-center gap-3 mb-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-[3px] flex-1 h-8">
          {Array.from({ length: 26 }, (_, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-full"
              style={{ background: C.teal, height: `${30 + ((i * 37) % 70)}%`, transformOrigin: "center" }}
              initial={{ scaleY: 0.1, opacity: 0.3 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.25 }}
            />
          ))}
        </div>
        <motion.span
          className="text-[11px] font-semibold"
          style={{ color: C.teal }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          Sent
        </motion.span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {RESPONSES.map((r, i) => (
          <motion.div
            key={r}
            className="relative rounded-2xl p-3 h-20 flex items-end overflow-hidden"
            style={{ background: `linear-gradient(150deg, ${[C.teal, C.purple, C.green, C.amber][i]}40, ${C.surface})` }}
            initial={{ filter: "blur(7px)" }}
            animate={{ filter: "blur(0px)" }}
            transition={{ delay: 1.8 + i * 0.15, duration: 0.6 }}
          >
            <span className="text-[11px] font-semibold" style={{ color: C.text }}>
              {r}
            </span>
            <motion.span
              className="absolute top-2 right-2"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 1.7 + i * 0.15 }}
            >
              <Lock size={13} color={C.text} />
            </motion.span>
          </motion.div>
        ))}
      </div>
    </Screen>
  );
}
