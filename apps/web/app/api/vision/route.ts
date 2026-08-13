import Anthropic from "@anthropic-ai/sdk";
import { clientKey, hit } from "@/lib/rate-limit";
import {
  VISION_MODES,
  isVisionMode,
  buildVisionPrompt,
  type VisionMode,
} from "@/lib/vision-modes";

/**
 * POST /api/vision — the eye behind Smart Referee, Form Control, and
 * Environment Design.
 *
 * The app sends a single JPEG frame plus whatever state the feature already
 * has (the score so far, which exercise, which mode), and gets back structured
 * JSON: the calls made, and — the part that matters — the visual evidence
 * behind each one. Every number this returns has to be defensible, because the
 * whole product promise is "tap the score and see why it's 11–3".
 *
 * The image never touches disk and is never persisted. It goes to the model
 * and is dropped with the request.
 */

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * Frames are analysed with Sonnet rather than Opus.
 *
 * A referee call arriving three seconds late is a worse product than a
 * slightly less nuanced one arriving now, and this runs on a loop while the
 * camera is open — latency and cost both compound. Swap to `claude-opus-5`
 * here if a mode ever needs the extra reasoning depth.
 */
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

// ─── Limits ───────────────────────────────────────────────────────────────────
/** ~1.4MB of base64 ≈ a 1MB JPEG. The app downscales well below this. */
const MAX_IMAGE_CHARS = 1_400_000;
/** Frames go out on a timer, so this is per-camera-session headroom. */
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

const anthropic = new Anthropic();

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Strip a data-URI prefix if the client sent one, and sniff the media type. */
function parseImage(raw: unknown): { data: string; mediaType: "image/jpeg" | "image/png" } {
  if (typeof raw !== "string" || raw.length < 100) {
    throw new Error("`image` must be a base64-encoded JPEG or PNG.");
  }
  if (raw.length > MAX_IMAGE_CHARS) {
    throw new Error("Frame too large. Capture at a lower quality.");
  }

  const match = /^data:(image\/(?:jpeg|jpg|png));base64,/.exec(raw);
  const data = match ? raw.slice(match[0].length) : raw;
  const mediaType: "image/jpeg" | "image/png" =
    match?.[1] === "image/png" ? "image/png" : "image/jpeg";

  if (!/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 256))) {
    throw new Error("`image` is not valid base64.");
  }
  return { data: data.replace(/\s/g, ""), mediaType };
}

/**
 * Pull the JSON object out of a model reply.
 *
 * Asking for raw JSON works nearly always, but "nearly" is not a contract —
 * a stray sentence before the brace should degrade to a readable error rather
 * than crash the camera screen mid-set.
 */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in reply.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(req: Request) {
  const limit = hit(clientKey(req), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return json(
      { error: "Analysing frames faster than I can keep up. Give it a second.", code: "rate_limited" },
      429,
      { "Retry-After": String(limit.retryAfter) }
    );
  }

  let mode: VisionMode;
  let image: { data: string; mediaType: "image/jpeg" | "image/png" };
  let prompt: string;

  // Parsed separately from validation: an over-limit frame blows up in
  // `req.json()` before any of our own checks run, and a raw parser message
  // ("Unterminated string at position 10485521") is not something to hand back.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(
      { error: "Frame too large or malformed. Capture at a lower quality.", code: "invalid_request" },
      400
    );
  }

  try {
    if (typeof body !== "object" || body === null) throw new Error("Body must be an object.");

    const { mode: rawMode, image: rawImage, state } = body as Record<string, unknown>;
    if (!isVisionMode(rawMode)) {
      throw new Error(`\`mode\` must be one of: ${Object.keys(VISION_MODES).join(", ")}.`);
    }
    mode = rawMode;
    image = parseImage(rawImage);
    prompt = buildVisionPrompt(mode, state);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Malformed request.", code: "invalid_request" },
      400
    );
  }

  let raw: string;
  try {
    const message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: VISION_MODES[mode].system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: image.mediaType, data: image.data },
              },
              { type: "text", text: prompt },
            ],
          },
          // Prefilling the opening brace removes the preamble the model would
          // otherwise write, which both saves tokens and makes parsing exact.
          { role: "assistant", content: "{" },
        ],
      },
      { signal: req.signal }
    );

    raw =
      "{" +
      message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });

    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[/api/vision] ANTHROPIC_API_KEY missing, invalid, or lacking model access.");
      return json({ error: "Analysis is unavailable right now.", code: "ai_unconfigured" }, 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "Too much traffic right now. Try again in a moment.", code: "upstream_busy" }, 429, {
        "Retry-After": "10",
      });
    }
    if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      console.error("[/api/vision] Anthropic credit balance is empty — add credits to restore analysis.");
      return json({ error: "Analysis is unavailable right now.", code: "ai_unconfigured" }, 503);
    }
    console.error("[/api/vision] Upstream failure:", err);
    return json({ error: "Couldn't analyse that frame. Try again.", code: "upstream_error" }, 503);
  }

  try {
    return json(extractJson(raw), 200);
  } catch {
    // A malformed reply is a bug on our side, not something the user can act
    // on — log the shape and hand back something the screen can render.
    console.error("[/api/vision] Unparseable model reply:", raw.slice(0, 400));
    return json({ error: "Couldn't read that frame clearly. Try again.", code: "unparseable" }, 502);
  }
}
