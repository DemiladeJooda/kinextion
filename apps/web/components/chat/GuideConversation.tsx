"use client";

/**
 * Talking to a guide on the website.
 *
 * Two paths, the same split the phone uses:
 *   Signed in   the data API's /api/chat/me/stream: real memory, saved thread,
 *               and the premium voice when one is set up.
 *   Signed out  this site's /api/chat: stateless, so anyone can try it.
 *
 * Voice comes first and typing is always there. The orb is the interface: it
 * shows whether the guide is waiting, listening, thinking or speaking.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { ArrowUp, Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { track } from "@/lib/analytics";
import type { GuideId } from "./chat-context";

const GUIDE = {
  altheo: { name: "Althea", role: "Health companion", color: "#00C47A", second: "#0ABAB5" },
  kairo: { name: "Kairo", role: "Wellness guide", color: "#A855F7", second: "#3B82F6" },
} as const;

const STARTERS: Record<GuideId, readonly string[]> = {
  altheo: ["I keep skipping the gym", "I slept five hours. Should I train?", "Help me start walking daily"],
  kairo: ["I've been stressed all week", "I feel behind on everything", "Why do I keep starting over?"],
};

type Phase = "idle" | "listening" | "thinking" | "speaking";

interface Msg {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function GuideConversation({
  initialGuide,
  onClose,
}: {
  readonly initialGuide: GuideId;
  readonly onClose: () => void;
}) {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  const [guideId, setGuideId] = useState<GuideId>(initialGuide);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [speakReplies, setSpeakReplies] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const guide = GUIDE[guideId];
  const msgsRef = useRef<Msg[]>([]);
  const conversationRef = useRef<Partial<Record<GuideId, string>>>({});
  const abortRef = useRef<AbortController | null>(null);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgsRef.current = msgs;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
      recognizerRef.current?.stop();
      stopSpeaking();
    };
  }, [onClose, stopSpeaking]);

  /** The natural guide voice; the browser's own only if that fails. */
  const speak = useCallback(
    async (text: string) => {
      const browserVoice = () => {
        const synth = window.speechSynthesis;
        if (!synth) return setPhase("idle");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        utterance.onend = () => setPhase("idle");
        utterance.onerror = () => setPhase("idle");
        setPhase("speaking");
        synth.speak(utterance);
      };

      try {
        const signedIn = Boolean(isSignedIn && apiBase());
        const res = signedIn
          ? await fetch(`${apiBase()}/api/chat/me/speech`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getToken()}` },
              body: JSON.stringify({ persona: guideId, text: text.slice(0, 600) }),
            })
          : await fetch("/api/speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ guide: guideId, text }),
            });
        if (!res.ok) return browserVoice();
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPhase("idle");
        };
        setPhase("speaking");
        await audio.play();
      } catch {
        browserVoice();
      }
    },
    [getToken, guideId, isSignedIn]
  );

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || phase === "thinking") return;

      stopSpeaking();
      setNotice(null);
      setDraft("");
      setPhase("thinking");
      track("chat_demo_message", "site", { guide: guideId, signedIn: Boolean(isSignedIn) });

      const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
      const replyId = `a-${Date.now()}`;
      const history = [...msgsRef.current, userMsg];
      setMsgs([...history, { id: replyId, role: "assistant", content: "" }]);

      const setReply = (content: string) =>
        setMsgs((prev) => prev.map((m) => (m.id === replyId ? { ...m, content } : m)));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let res: Response | null = null;

        if (isSignedIn && apiBase()) {
          const token = await getToken();
          const conversationId = conversationRef.current[guideId];
          res = await fetch(`${apiBase()}/api/chat/me/stream`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              "X-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: JSON.stringify({ persona: guideId, content: text, ...(conversationId ? { conversationId } : {}) }),
            signal: controller.signal,
          }).catch(() => null);
          const assigned = res?.headers.get("X-Conversation-Id");
          if (assigned) conversationRef.current[guideId] = assigned;
        }

        if (!res) {
          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history.map(({ role, content }) => ({ role, content })),
              userName: user?.firstName ?? null,
              guide: guideId,
              surface: "web",
            }),
            signal: controller.signal,
          });
        }

        if (!res.ok) {
          const detail = await res
            .json()
            .then((b: { error?: string }) => b.error)
            .catch(() => null);
          setMsgs((prev) => prev.filter((m) => m.id !== replyId));
          setNotice(detail ?? "That didn't go through. Try again?");
          setPhase("idle");
          track("chat_demo_error", "site", { status: res.status });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setReply(full);
        }

        if (speakReplies && full) void speak(full);
        else setPhase("idle");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[GuideConversation]", err);
        setMsgs((prev) => prev.filter((m) => m.id !== replyId));
        setNotice("Couldn't reach your guide. Check your connection and try again.");
        setPhase("idle");
      }
    },
    [getToken, guideId, isSignedIn, phase, speak, speakReplies, stopSpeaking, user?.firstName]
  );

  const toggleListening = useCallback(() => {
    if (phase === "listening") {
      recognizerRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognizer = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognizer) {
      setNotice("This browser can't listen. Type instead, or try Chrome or Safari.");
      return;
    }

    stopSpeaking();
    setNotice(null);
    const recognizer = new Recognizer();
    recognizer.lang = "en-US";
    recognizer.interimResults = true;
    recognizer.continuous = false;
    let heard = "";
    recognizer.onresult = (e) => {
      heard = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((r) => r[0].transcript)
        .join(" ");
      setDraft(heard);
    };
    recognizer.onerror = () => {
      setPhase("idle");
      setNotice("Couldn't hear that. Check microphone access and try again.");
    };
    recognizer.onend = () => {
      recognizerRef.current = null;
      if (heard.trim()) void send(heard);
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };
    recognizerRef.current = recognizer;
    setPhase("listening");
    recognizer.start();
  }, [phase, send, stopSpeaking]);

  const switchGuide = (id: GuideId) => {
    if (id === guideId) return;
    abortRef.current?.abort();
    stopSpeaking();
    setGuideId(id);
    setMsgs([]);
    setNotice(null);
    setPhase("idle");
  };

  const statusLine: Record<Phase, string> = {
    idle: msgs.length ? "Your turn" : "Tap to talk",
    listening: "Listening…",
    thinking: `${guide.name} is thinking…`,
    speaking: `${guide.name} is speaking`,
  };

  const lastReply = [...msgs].reverse().find((m) => m.role === "assistant" && m.content);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Talk to ${guide.name}`}
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "#05070F" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* The room takes the guide's colour. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: `radial-gradient(ellipse 70% 55% at 50% 38%, ${guide.color}26 0%, ${guide.second}12 42%, transparent 72%)`,
        }}
        transition={{ duration: 0.7 }}
      />

      <header className="relative flex items-center justify-between gap-3 px-4 sm:px-6 h-16 shrink-0">
        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.06)" }}>
          {(Object.keys(GUIDE) as GuideId[]).map((id) => (
            <button
              key={id}
              onClick={() => switchGuide(id)}
              aria-pressed={id === guideId}
              className="relative px-4 h-9 rounded-full text-sm font-semibold cursor-pointer"
              style={{ color: id === guideId ? "#05070F" : "rgba(255,255,255,0.65)" }}
            >
              {id === guideId ? (
                <motion.span
                  layoutId="guide-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: GUIDE[id].color }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                />
              ) : null}
              <span className="relative">{GUIDE[id].name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (speakReplies) stopSpeaking();
              setSpeakReplies((v) => !v);
            }}
            aria-label={speakReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/10 text-white/70"
          >
            {speakReplies ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/10 text-white/70"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 flex flex-col items-center px-4 sm:px-6">
        <button
          onClick={toggleListening}
          aria-label={phase === "listening" ? "Stop listening" : "Start talking"}
          className="relative shrink-0 mt-2 sm:mt-6 cursor-pointer rounded-full"
          style={{ width: "min(34vh, 240px)", height: "min(34vh, 240px)" }}
        >
          <Orb color={guide.color} second={guide.second} phase={phase} />
        </button>

        <p className="mt-3 text-sm font-medium" style={{ color: guide.color }} aria-live="polite">
          {statusLine[phase]}
        </p>

        <div ref={scrollRef} className="mt-4 w-full max-w-xl flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-3 pb-4">
          {msgs.length === 0 ? (
            <motion.div
              key={guideId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {STARTERS[guideId].map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="px-4 py-2.5 rounded-full text-sm text-white/80 cursor-pointer transition-colors hover:text-white"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {s}
                </button>
              ))}
            </motion.div>
          ) : null}

          <AnimatePresence initial={false}>
            {msgs.map((m) =>
              m.content ? (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <p
                    className="max-w-[85%] text-[15px] leading-relaxed whitespace-pre-wrap"
                    style={
                      m.role === "user"
                        ? { color: "#FFFFFF", background: "rgba(255,255,255,0.09)", padding: "10px 16px", borderRadius: 20 }
                        : { color: m.id === lastReply?.id ? "#FFFFFF" : "rgba(255,255,255,0.62)" }
                    }
                  >
                    {m.content}
                  </p>
                </motion.div>
              ) : null
            )}
          </AnimatePresence>
        </div>

        {notice ? (
          <p role="alert" className="text-sm text-center mb-2" style={{ color: "#FCA5A5" }}>
            {notice}
          </p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="w-full max-w-xl shrink-0 pb-3 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={toggleListening}
            aria-label={phase === "listening" ? "Stop listening" : "Talk"}
            className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: phase === "listening" ? guide.color : "rgba(255,255,255,0.08)", color: phase === "listening" ? "#05070F" : "#FFFFFF" }}
          >
            {phase === "listening" ? <Square size={16} /> : <Mic size={19} />}
          </button>
          <label className="sr-only" htmlFor="guide-input">
            Message {guide.name}
          </label>
          <input
            id="guide-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Or type to ${guide.name}…`}
            maxLength={2000}
            autoComplete="off"
            className="flex-1 min-w-0 h-12 px-5 rounded-full text-[15px] text-white outline-none placeholder:text-white/40"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || phase === "thinking"}
            aria-label="Send"
            className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30"
            style={{ background: guide.color, color: "#05070F" }}
          >
            <ArrowUp size={20} />
          </button>
        </form>

        <p className="pb-3 text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
          {isSignedIn
            ? "Signed in: your guide remembers this. "
            : "Demo: nothing is saved. Sign in and your guide remembers you. "}
          Not medical advice.
        </p>
      </div>
    </motion.div>
  );
}

/** Rings that breathe at rest, swell while listening and ripple while speaking. */
function Orb({ color, second, phase }: { readonly color: string; readonly second: string; readonly phase: Phase }) {
  const speed = phase === "idle" ? 4.5 : phase === "thinking" ? 1.4 : phase === "listening" ? 1.1 : 0.9;
  const swell = phase === "idle" ? 1.05 : phase === "thinking" ? 1.08 : 1.2;

  return (
    <div className="absolute inset-0">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ inset: `${i * 12}%`, border: `1px solid ${i === 0 ? second : color}55` }}
          animate={{ scale: [1, swell, 1], opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: speed, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
      <motion.span
        className="absolute rounded-full"
        style={{
          inset: "32%",
          background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${color} 34%, ${second} 72%, #05070F 118%)`,
          boxShadow: `0 0 70px ${color}88`,
        }}
        animate={{ scale: [1, phase === "idle" ? 1.04 : 1.14, 1], rotate: phase === "thinking" ? 360 : 0 }}
        transition={{
          scale: { duration: speed * 0.75, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 2.4, repeat: Infinity, ease: "linear" },
        }}
      />
    </div>
  );
}
