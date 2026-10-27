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
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
// Binary uploads still live in the legacy API (as in services/community.ts).
import * as FileSystem from "expo-file-system/legacy";
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

/**
 * Whether this build can listen with the phone's own recogniser. Without it
 * (Expo Go), voice still works when the API can transcribe: see
 * `listening` from getVoice().
 */
export const voiceSupported = recognition !== null;
/** Whether this build can read replies aloud with the phone's voice. */
export const deviceSpeechSupported = Speech !== null;

// ─── Listening ────────────────────────────────────────────────────────────────

/** `transcribing` only happens on the server path, while the clip is read. */
export type ListenState = "idle" | "listening" | "transcribing";

interface ListenerOptions {
  onFinal: (text: string) => void;
  contextualStrings?: string[];
  /** For the server path, which sends the clip to the API. */
  getToken?: () => Promise<string | null>;
}

/**
 * Listen for one thing the user says. `onFinal` gets the whole utterance
 * once they stop talking (or `stop()` is called). On the phone's recogniser
 * `partial` shows the words as they come; on the server path (Expo Go) the
 * clip is recorded, ends by itself after a pause, and is read by the API.
 */
export const useListener: (options: ListenerOptions) => ReturnType<typeof useNativeListener> = recognition
  ? useNativeListener
  : useRecordedListener;

function useNativeListener({ onFinal, contextualStrings }: ListenerOptions) {
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

  return {
    state: state as ListenState,
    partial,
    volume,
    error,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}

// ─── Listening through the server (Expo Go) ──────────────────────────────────

/** Louder than this (dB) counts as talking. Room noise sits well below it. */
const SPEECH_DB = -38;
/** How long a pause ends the turn, once they've started talking. */
const END_OF_TURN_MS = 1300;
/** Give up quietly if they never start. */
const NO_SPEECH_MS = 8000;
/** A hard stop, so a stuck clip can't run forever. */
const MAX_TURN_MS = 90_000;
const METER_MS = 100;

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

function useRecordedListener({ onFinal, getToken }: ListenerOptions) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [state, setState] = useState<ListenState>("idle");
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const final = useRef(onFinal);
  final.current = onFinal;
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const turn = useRef({ started: 0, heard: 0, lastLoud: 0, active: false });

  const stopMeter = () => {
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
  };

  /** Ends the clip; `send` decides whether it's read or thrown away. */
  const finish = useCallback(
    async (send: boolean) => {
      if (!turn.current.active) return;
      turn.current.active = false;
      stopMeter();
      setVolume(0);
      try {
        await recorder.stop();
      } catch {
        // already stopped
      }
      // Back to playback, so the reply comes out of the speaker.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      const uri = recorder.uri;
      if (!send || !uri || !turn.current.heard) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const text = await transcribe(uri, (await tokenRef.current?.()) ?? null);
        setState("idle");
        if (text) final.current(text);
        else setError("Didn't catch that. Try again?");
      } catch (err) {
        setState("idle");
        setError(err instanceof Error ? err.message : "Couldn't hear that. Try again?");
      } finally {
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    },
    [recorder],
  );

  const start = useCallback(async () => {
    if (turn.current.active) return true;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone access is off for Kinextion. You can turn it on in Settings, or type instead.");
      return false;
    }
    setError(null);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError("Couldn't start the microphone. Try again?");
      return false;
    }
    const now = Date.now();
    turn.current = { started: now, heard: 0, lastLoud: now, active: true };
    setState("listening");

    // Ends the turn the way a person would: a pause after talking.
    meter.current = setInterval(() => {
      const t = turn.current;
      if (!t.active) return;
      const db = recorder.getStatus().metering ?? -160;
      const at = Date.now();
      setVolume(Math.max(0, Math.min(1, (db + 60) / 50)));
      if (db > SPEECH_DB) {
        t.heard += 1;
        t.lastLoud = at;
      }
      if (t.heard >= 3 && at - t.lastLoud > END_OF_TURN_MS) void finish(true);
      else if (!t.heard && at - t.started > NO_SPEECH_MS) void finish(false);
      else if (at - t.started > MAX_TURN_MS) void finish(true);
    }, METER_MS);
    return true;
  }, [recorder, finish]);

  useEffect(
    () => () => {
      stopMeter();
      if (turn.current.active) {
        turn.current.active = false;
        void recorder.stop().catch(() => {});
      }
    },
    [recorder],
  );

  return {
    state,
    // No live words on this path; the orb shows it's listening instead.
    partial: "",
    volume,
    error,
    start,
    /** Stop and send what was heard. */
    stop: () => void finish(true),
    /** Stop and throw it away. */
    cancel: () => void finish(false),
    clearError: () => setError(null),
  };
}

/** The recorded clip, read by the API. Throws a sentence fit to show. */
async function transcribe(uri: string, token: string | null): Promise<string> {
  const res = await FileSystem.uploadAsync(`${dataApiBaseUrl()}/api/chat/me/transcribe`, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": "audio/mp4",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let body: { success?: boolean; data?: { text?: string }; error?: string } | null = null;
  try {
    body = JSON.parse(res.body);
  } catch {
    body = null;
  }
  if (res.status < 200 || res.status >= 300 || !body?.success) {
    throw new Error(body?.error ?? "Couldn't hear that. Try again?");
  }
  return body.data?.text?.trim() ?? "";
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
      await file.write(new Uint8Array(await res.arrayBuffer()));
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
