import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  resolveGuideId,
  DEFAULT_GUIDE,
  type ChatSurface,
} from "@kinextion/ai-core";
import { clientKey, hit } from "@/lib/rate-limit";

// Streaming needs a long-lived Node runtime; the edge runtime's shorter
// execution budget cuts replies off mid-sentence.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The chat model.
 *
 * Opus 4.8 is the most capable model and what this experience is tuned for.
 * Thinking is deliberately left off: replies here are 2–4 warm sentences, and
 * the voice mode speaks them aloud, so time-to-first-token matters far more
 * than reasoning depth. If chat volume makes Opus pricing uncomfortable,
 * `claude-sonnet-5` is the drop-in swap — same request shape, no code change
 * beyond this constant.
 */
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 512;

// ─── Request limits ───────────────────────────────────────────────────────────
const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 4_000;
const MAX_TOTAL_CHARS = 24_000;
const MAX_NAME_CHARS = 60;

// ─── Rate limit: 20 messages/minute per IP ────────────────────────────────────
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const anthropic = new Anthropic();

interface InboundMessage {
  role: "user" | "assistant";
  content: string;
}

class BadRequest extends Error {}

function parseMessages(raw: unknown): InboundMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequest("`messages` must be a non-empty array.");
  }
  if (raw.length > MAX_MESSAGES) {
    throw new BadRequest(`Conversation too long (max ${MAX_MESSAGES} messages).`);
  }

  let total = 0;
  const parsed: InboundMessage[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new BadRequest("Each message must be an object.");
    }
    const { role, content } = item as Record<string, unknown>;

    if (role !== "user" && role !== "assistant") {
      throw new BadRequest("Message `role` must be 'user' or 'assistant'.");
    }
    if (typeof content !== "string") {
      throw new BadRequest("Message `content` must be a string.");
    }

    const trimmed = content.trim();
    // Drop empties rather than 400-ing: the client creates an empty assistant
    // placeholder while streaming, and a retry can replay it.
    if (!trimmed) continue;

    if (trimmed.length > MAX_CHARS_PER_MESSAGE) {
      throw new BadRequest(
        `Message too long (max ${MAX_CHARS_PER_MESSAGE} characters).`
      );
    }
    total += trimmed.length;
    if (total > MAX_TOTAL_CHARS) {
      throw new BadRequest("Conversation too long. Start a new chat.");
    }

    parsed.push({ role, content: trimmed });
  }

  // The API requires the conversation to open on a user turn.
  while (parsed.length && parsed[0].role === "assistant") parsed.shift();

  if (parsed.length === 0) {
    throw new BadRequest("No usable messages in request.");
  }
  if (parsed[parsed.length - 1].role !== "user") {
    throw new BadRequest("The last message must be from the user.");
  }

  return parsed;
}

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Map an upstream failure to a status the client can act on, plus a message
 * that is safe to render to an end user.
 *
 * Anything caused by *our* configuration (missing key, unpaid account) is
 * logged loudly with a fix, because the user-facing copy deliberately doesn't
 * leak that detail.
 */
function mapUpstreamError(err: unknown): Response {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(
      "[/api/chat] ANTHROPIC_API_KEY is missing or invalid. " +
        "Set it in the repo-root .env (see .env.example)."
    );
    return json(
      { error: "The guides are unavailable right now.", code: "ai_unconfigured" },
      503
    );
  }

  if (err instanceof Anthropic.PermissionDeniedError) {
    console.error(
      `[/api/chat] API key lacks access to ${MODEL}. Check the key's model permissions.`
    );
    return json(
      { error: "The guides are unavailable right now.", code: "ai_unconfigured" },
      503
    );
  }

  if (err instanceof Anthropic.RateLimitError) {
    console.warn("[/api/chat] Upstream rate limit hit.");
    return json(
      { error: "A lot of people are talking right now. Try again in a moment.", code: "upstream_busy" },
      429,
      { "Retry-After": "10" }
    );
  }

  if (err instanceof Anthropic.BadRequestError) {
    // The most common cause in practice is an unpaid/empty account, which the
    // API reports as a 400 rather than a 402.
    if (/credit balance/i.test(err.message)) {
      console.error(
        "[/api/chat] Anthropic credit balance is empty. " +
          "Add credits at https://console.anthropic.com/settings/billing — " +
          "chat will stay down until then."
      );
      return json(
        { error: "The guides are unavailable right now.", code: "ai_unconfigured" },
        503
      );
    }
    console.error("[/api/chat] Rejected by the API:", err.message);
    return json({ error: "That message couldn't be processed.", code: "bad_request" }, 400);
  }

  if (err instanceof Anthropic.APIConnectionError) {
    console.error("[/api/chat] Could not reach the API:", err.message);
    return json(
      { error: "Couldn't reach the guides. Check your connection and try again.", code: "network" },
      503
    );
  }

  if (err instanceof Anthropic.APIError) {
    console.error(`[/api/chat] API error ${err.status}:`, err.message);
    return json(
      { error: "Something went wrong on our end. Try again in a moment.", code: "upstream_error" },
      503
    );
  }

  console.error("[/api/chat] Unexpected error:", err);
  return json({ error: "Something went wrong. Try again.", code: "unknown" }, 500);
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  // 1. Rate limit before doing any work.
  const limit = hit(clientKey(req), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return json(
      { error: "You're sending messages faster than I can keep up. Give it a second.", code: "rate_limited" },
      429,
      {
        "Retry-After": String(limit.retryAfter),
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": "0",
      }
    );
  }

  // 2. Parse and validate.
  let messages: InboundMessage[];
  let systemPrompt: string;

  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      throw new BadRequest("Body must be a JSON object.");
    }

    const { messages: rawMessages, userName, guide, surface } = body as Record<string, unknown>;

    messages = parseMessages(rawMessages);

    const guideId = resolveGuideId(guide) ?? DEFAULT_GUIDE;
    const resolvedSurface: ChatSurface = surface === "app" ? "app" : "web";
    const name =
      typeof userName === "string" && userName.trim()
        ? userName.trim().slice(0, MAX_NAME_CHARS)
        : null;

    systemPrompt = buildSystemPrompt({
      guide: guideId,
      surface: resolvedSurface,
      userName: name,
    });
  } catch (err) {
    if (err instanceof BadRequest) {
      return json({ error: err.message, code: "invalid_request" }, 400);
    }
    return json({ error: "Malformed request body.", code: "invalid_json" }, 400);
  }

  // 3. Open the stream and pull the first event *before* committing to a 200.
  //    Without this the SDK connects lazily inside the ReadableStream, so an
  //    auth/billing/validation failure arrives after headers are already sent
  //    and the browser sees a truncated body instead of an error it can show.
  let iterator: AsyncIterator<Anthropic.MessageStreamEvent>;
  let first: IteratorResult<Anthropic.MessageStreamEvent>;

  try {
    const stream = anthropic.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      },
      // Client navigates away or hits stop → abort upstream so we stop paying
      // for tokens nobody will read.
      { signal: req.signal }
    );

    iterator = stream[Symbol.asyncIterator]();
    first = await iterator.next();
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return mapUpstreamError(err);
  }

  // 4. Stream text deltas as plain UTF-8.
  const encoder = new TextEncoder();
  let sawText = false;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: Anthropic.MessageStreamEvent) => {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          sawText = true;
          controller.enqueue(encoder.encode(event.delta.text));
        } else if (
          event.type === "message_delta" &&
          event.delta.stop_reason === "refusal" &&
          !sawText
        ) {
          // Safety classifiers declined before producing anything. Say
          // something human rather than closing on an empty bubble.
          controller.enqueue(
            encoder.encode(
              "That's not something I can help with here — but if it's weighing on you, I'm listening."
            )
          );
        }
      };

      try {
        if (!first.done && first.value) push(first.value);

        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          push(next.value);
        }

        if (!sawText) {
          controller.enqueue(
            encoder.encode("I didn't catch that — mind saying it another way?")
          );
        }
      } catch (err) {
        // Headers are long gone by now, so the only honest options are to end
        // the stream or append a note. A client disconnect is not an error.
        if (!req.signal.aborted) {
          console.error("[/api/chat] Stream interrupted:", err);
          if (sawText) {
            controller.enqueue(encoder.encode("\n\n(I got cut off there — say that again?)"));
          } else {
            controller.enqueue(
              encoder.encode("Something went wrong on my end — try again?")
            );
          }
        }
      } finally {
        controller.close();
      }
    },

    cancel() {
      void iterator.return?.();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      // Stops nginx and friends from buffering the stream into one chunk.
      "X-Accel-Buffering": "no",
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}
