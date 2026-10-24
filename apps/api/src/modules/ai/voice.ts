/**
 * Talking with the guides, not typing at them.
 *
 * Listening happens on the phone (the OS speech recogniser: free, and the
 * audio never leaves the device). What the server adds is two things:
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

export { speakable };
