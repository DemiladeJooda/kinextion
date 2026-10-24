/**
 * Voice for the guides: hear the user, speak the reply.
 *
 * Listening uses the phone's own speech recogniser through
 * expo-speech-recognition, so it costs nothing. Recognition runs on the
 * phone wherever it supports that; otherwise the phone's own speech service
 * (Apple's or Google's) does it. Kinextion only ever receives the text.
 * Speaking uses the phone's voice (expo-speech), or a premium hosted voice
 * when the API has one set up. The premium voice always falls back to the
 * device voice, so a missing key or a bad connection never leaves a guide
 * silent.
 *
 * The recogniser is a native module. A build made before it was added
 * doesn't have it, so it's loaded defensively: without it, voice reports
 * itself unavailable and the chat opens in typing mode instead of crashing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import type { Persona } from "@kinextion/shared";
import { dataApiBaseUrl } from "../services/client";

type RecognitionModule = typeof import("expo-speech-recognition");
type SpeechModule = typeof import("expo-speech");

let recognition: RecognitionModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  recognition = require("expo-speech-recognition") as RecognitionModule;
  if (!recognition.ExpoSpeechRecognitionModule) recognition = null;
} catch {
  recognition = null;
}

// The device voice is a native module too; a build without it can still
// listen and show replies, it just can't read them aloud.
let Speech: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require("expo-speech") as SpeechModule;
} catch {
  Speech = null;
}

/** Whether this build can listen at all. */
export const voiceSupported = recognition !== null;
/** Whether this build can read replies aloud with the phone's voice. */
export const deviceSpeechSupported = Speech !== null;

// ─── Listening ────────────────────────────────────────────────────────────────

export type ListenState = "idle" | "listening";

/**
 * Listen for one thing the user says. `onFinal` gets the whole utterance
 * once they stop talking (or `stop()` is called); `partial` shows the words
 * as they come.
 */
export function useListener({ onFinal, contextualStrings }: { onFinal: (text: string) => void; contextualStrings?: string[] }) {
  const [state, setState] = useState<ListenState>("idle");
  const [partial, setPartial] = useState("");
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const transcript = useRef("");
  const cancelled = useRef(false);
  const final = useRef(onFinal);
  final.current = onFinal;

  useEffect(() => {
    if (!recognition) return;
    const m = recognition.ExpoSpeechRecognitionModule;
    const subs = [
      m.addListener("start", () => {
        setState("listening");
        setError(null);
      }),
      m.addListener("result", (e) => {
        const text = e.results[0]?.transcript ?? "";
        transcript.current = text;
        setPartial(text);
      }),
      m.addListener("volumechange", (e) => setVolume(Math.max(0, Math.min(1, e.value / 10)))),
      m.addListener("error", (e) => {
        // "no-speech" and "aborted" are ordinary: they just didn't say anything.
        if (e.error !== "no-speech" && e.error !== "aborted") {
          setError(e.error === "not-allowed" ? "Microphone access is off for Kinextion." : "Couldn't hear that. Try again?");
        }
      }),
      m.addListener("end", () => {
        setState("idle");
        setVolume(0);
        const text = transcript.current.trim();
        transcript.current = "";
        setPartial("");
        if (text && !cancelled.current) final.current(text);
        cancelled.current = false;
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const start = useCallback(async () => {
    if (!recognition) return false;
    const m = recognition.ExpoSpeechRecognitionModule;
    const perm = await m.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone access is off for Kinextion. You can turn it on in Settings, or type instead.");
      return false;
    }
    cancelled.current = false;
    transcript.current = "";
    m.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      // Keep the audio on the phone when it can do recognition itself.
      requiresOnDeviceRecognition: m.supportsOnDeviceRecognition(),
      contextualStrings: ["Altheo", "Kairo", "Kinextion", ...(contextualStrings ?? [])],
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      // Play replies through the speaker, not the earpiece, after listening.
      iosCategory: {
        category: "playAndRecord",
        categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
        mode: "default",
      },
    });
    return true;
  }, [contextualStrings]);

  /** Stop and send what was heard. */
  const stop = useCallback(() => recognition?.ExpoSpeechRecognitionModule.stop(), []);
  /** Stop and throw it away. */
  const cancel = useCallback(() => {
    cancelled.current = true;
    recognition?.ExpoSpeechRecognitionModule.abort();
  }, []);

  return { state, partial, volume, error, start, stop, cancel, clearError: () => setError(null) };
}

// ─── Speaking ─────────────────────────────────────────────────────────────────

/** Calmer and slower for Kairo, a touch brighter for Altheo. */
const DEVICE_STYLE: Record<Persona, { rate: number; pitch: number }> = {
  altheo: { rate: 1.0, pitch: 1.0 },
  kairo: { rate: 0.92, pitch: 0.95 },
};

let deviceVoice: string | null | undefined;
/** The best English voice on the phone: an enhanced one if it has it. */
async function pickDeviceVoice(): Promise<string | null> {
  if (deviceVoice !== undefined) return deviceVoice;
  if (!Speech) return (deviceVoice = null);
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => v.language?.toLowerCase().startsWith("en-us"));
    const best = english.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? english[0];
    deviceVoice = best?.identifier ?? null;
  } catch {
    deviceVoice = null;
  }
  return deviceVoice;
}

export interface Speaker {
  /** Queue one sentence. */
  say(sentence: string): void;
  /** Call when the reply has finished streaming; `onIdle` fires once everything queued is spoken. */
  end(): void;
  /** Stop talking now and drop the queue. */
  stop(): void;
}

/**
 * Speaks queued sentences one after another. `premium` names the hosted
 * voice route when the API has one; each sentence falls back to the device
 * voice if fetching it fails.
 */
export function createSpeaker({
  persona,
  premium,
  getToken,
  onSpeaking,
  onIdle,
}: {
  persona: Persona;
  premium: boolean;
  getToken: () => Promise<string | null>;
  onSpeaking: (speaking: boolean) => void;
  onIdle: () => void;
}): Speaker {
  const queue: string[] = [];
  let busy = false;
  let ended = false;
  let stopped = false;
  let player: AudioPlayer | null = null;
  let finish: (() => void) | null = null;

  const next = async () => {
    if (stopped) return;
    const sentence = queue.shift();
    if (!sentence) {
      busy = false;
      onSpeaking(false);
      if (ended) onIdle();
      return;
    }
    busy = true;
    onSpeaking(true);
    const played = premium ? await playPremium(sentence) : false;
    if (!played && !stopped) await playDevice(sentence);
    void next();
  };

  const playDevice = async (text: string) => {
    const tts = Speech;
    if (!tts) return;
    const voice = await pickDeviceVoice();
    await new Promise<void>((resolve) => {
      finish = resolve;
      tts.speak(text, {
        ...(voice ? { voice } : {}),
        ...DEVICE_STYLE[persona],
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
    finish = null;
  };

  const playPremium = async (text: string): Promise<boolean> => {
    try {
      const token = await getToken();
      const res = await fetch(`${dataApiBaseUrl()}/api/chat/me/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ persona, text }),
      });
      if (!res.ok || stopped) return false;
      const file = new File(Paths.cache, `guide-${Date.now()}.mp3`);
      file.write(new Uint8Array(await res.arrayBuffer()));
      await setAudioModeAsync({ playsInSilentMode: true });
      await new Promise<void>((resolve) => {
        finish = resolve;
        player = createAudioPlayer(file.uri);
        const sub = player.addListener("playbackStatusUpdate", (s) => {
          if (s.didJustFinish) {
            sub.remove();
            resolve();
          }
        });
        player.play();
      });
      player?.remove();
      player = null;
      finish = null;
      try {
        file.delete();
      } catch {
        // cache is cleared by the OS anyway
      }
      return true;
    } catch {
      return false;
    }
  };

  return {
    say(sentence) {
      if (stopped || !sentence.trim()) return;
      queue.push(sentence);
      if (!busy) void next();
    },
    end() {
      ended = true;
      if (!busy && queue.length === 0) onIdle();
    },
    stop() {
      stopped = true;
      queue.length = 0;
      void Speech?.stop();
      player?.pause();
      player?.remove();
      player = null;
      finish?.();
      busy = false;
      onSpeaking(false);
    },
  };
}
