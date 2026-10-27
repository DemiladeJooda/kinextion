/**
 * Talking with the guides, not typing at them.
 *
 * Listening happens on the phone (the OS speech recogniser: free, on-device
 * where the phone supports it, and Kinextion only receives the text). What
 * the server adds is two things:
 *
 *   1. A spoken style. A reply that reads well as a chat bubble — bullets,
 *      bold, an emoji — sounds awful read aloud. Voice turns are told so.
 *   2. An optional premium voice. The phone's own voice works everywhere at
 *      no cost; a hosted voice (ElevenLabs, built here) sounds far more
 *      human but bills per character. It switches on only when its key is
 *      set, and the app falls back to the device voice whenever it's off or
 *      fails, so nothing depends on it.
 */

import { speakable, type Persona } from "@kinextion/shared";

/** Appended to the system prompt when the user is talking out loud. */
export const VOICE_PROMPT = `## They're talking to you out loud
They spoke this message, and they'll hear your reply read aloud. Talk the way a person talks:
- Two to four short sentences. Say the one thing that matters most.
- No lists, headings, bold, links or emoji. Nothing that only works on a screen.
- Numbers and times the way you'd say them: "about seven", "half past six".
- At most one question, at the end.
- Speech-to-text makes mistakes. If a word looks wrong, go with the likely meaning; if you can't tell, ask.`;

/** Longest stretch the app sends to be spoken in one request. */
export const MAX_SPEECH_CHARS = 600;

export interface SpeechProvider {
  id: string;
  isConfigured(): boolean;
  /** Spoken audio for the text, in the given guide's voice. */
  synthesize(text: string, persona: Persona, signal?: AbortSignal): Promise<{ audio: Buffer; contentType: string }>;
}

/**
 * ElevenLabs text-to-speech. Needs ELEVENLABS_API_KEY, and a voice id per
 * guide (ELEVENLABS_VOICE_ALTHEO / ELEVENLABS_VOICE_KAIRO) chosen in their
 * voice library. The flash model is their low-latency one, which matters
 * more than the last bit of quality in a back-and-forth conversation.
 */
export const elevenLabs: SpeechProvider = {
  id: "elevenlabs",
  isConfigured: () =>
    Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ALTHEO && process.env.ELEVENLABS_VOICE_KAIRO),
  async synthesize(text, persona, signal) {
    const voice = persona === "kairo" ? process.env.ELEVENLABS_VOICE_KAIRO : process.env.ELEVENLABS_VOICE_ALTHEO;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice ?? "")}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5",
        }),
        signal,
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs speech failed (${res.status})`);
    return { audio: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
  },
};

/** The premium voice in use, or null when none is set up. */
export function premiumVoice(): SpeechProvider | null {
  return elevenLabs.isConfigured() ? elevenLabs : null;
}

// ─── Listening on the server ─────────────────────────────────────────────────
//
// The phone's recogniser is a native module that Expo Go doesn't include,
// and some phones can't run it. There the app records a short clip and sends
// it here instead. The clip is transcribed and dropped; only the text is
// kept, as the chat message itself.

/** Longest clip accepted, ~2 minutes of compressed speech. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export interface TranscriptionProvider {
  id: string;
  isConfigured(): boolean;
  transcribe(audio: Buffer, contentType: string, signal?: AbortSignal): Promise<string>;
}

const fileFrom = (audio: Buffer, contentType: string) =>
  new Blob([new Uint8Array(audio)], { type: contentType });
const extensionFor = (contentType: string) => (contentType.includes("wav") ? "wav" : contentType.includes("webm") ? "webm" : "m4a");

/** ElevenLabs Scribe. Same key as the premium voice; no voice ids needed. */
export const elevenLabsScribe: TranscriptionProvider = {
  id: "elevenlabs",
  isConfigured: () => Boolean(process.env.ELEVENLABS_API_KEY),
  async transcribe(audio, contentType, signal) {
    const form = new FormData();
    form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1");
    form.append("language_code", "en");
    form.append("tag_audio_events", "false");
    form.append("file", fileFrom(audio, contentType), `speech.${extensionFor(contentType)}`);
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
      body: form,
      signal,
    });
    if (!res.ok) throw new Error(`ElevenLabs transcription failed (${res.status})`);
    const body = (await res.json()) as { text?: string };
    return body.text?.trim() ?? "";
  },
};

/** OpenAI's transcription model, for when that's the key on hand. */
export const openAITranscribe: TranscriptionProvider = {
  id: "openai",
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
  async transcribe(audio, contentType, signal) {
    const form = new FormData();
    form.append("model", process.env.OPENAI_STT_MODEL ?? "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("prompt", "A person talking to their wellness guides, Altheo and Kairo, in the Kinextion app.");
    form.append("file", fileFrom(audio, contentType), `speech.${extensionFor(contentType)}`);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` },
      body: form,
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI transcription failed (${res.status})`);
    const body = (await res.json()) as { text?: string };
    return body.text?.trim() ?? "";
  },
};

/** The server-side listener in use, or null when no key is set. */
export function transcriber(): TranscriptionProvider | null {
  return [elevenLabsScribe, openAITranscribe].find((p) => p.isConfigured()) ?? null;
}

export { speakable };
