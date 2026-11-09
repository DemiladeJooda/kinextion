import { GUIDE_SPEECH, speakable } from "@kinextion/shared";
import { clientKey, hit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * A guide's reply, spoken, for visitors trying the demo signed out. Signed-in
 * people use the data API's /api/chat/me/speech.
 *
 * Billed per use and open to the public, so it's tightly limited.
 */
const MAX_CHARS = 600;
const LIMIT = 12;
const WINDOW_MS = 60_000;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "No voice set up." }, { status: 501 });
  if (!hit(`speech:${clientKey(req)}`, LIMIT, WINDOW_MS).ok) return Response.json({ error: "Too many requests." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; guide?: unknown } | null;
  const guide = body?.guide === "kairo" ? "kairo" : "altheo";
  const text = typeof body?.text === "string" ? speakable(body.text).slice(0, MAX_CHARS) : "";
  if (!text) return Response.json({ error: "Nothing to say." }, { status: 400 });

  const style = GUIDE_SPEECH[guide];
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: style.voice,
      input: text,
      instructions: style.instructions,
      response_format: "mp3",
    }),
    signal: req.signal,
  });

  if (!res.ok || !res.body) return Response.json({ error: "The voice didn't come through." }, { status: 502 });
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
