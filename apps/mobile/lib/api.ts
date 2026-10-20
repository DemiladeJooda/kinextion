/**
 * API client for the Kinextion backend.
 *
 * The app talks to the Next.js app's `/api/chat` route rather than calling
 * Anthropic directly — the API key must never ship inside a mobile bundle,
 * where anyone can extract it from the APK/IPA and spend against the account.
 */

import Constants from "expo-constants";
import { fetch as expoFetch } from "expo/fetch";
import type { GuideId } from "@kinextion/ai-core";
import { dataApiBaseUrl } from "../services/client";
import { DEMO_MODE } from "./demo/session";
import { demoStreamChat } from "./demo/chat";

/**
 * Resolve the API origin.
 *
 * Production/staging: set `EXPO_PUBLIC_API_URL` (inlined at build time).
 * Local dev: falls back to the machine running Metro, so a physical device on
 * the same Wi-Fi reaches the dev server without anyone hand-editing an IP.
 * `localhost` would resolve to the phone itself.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  // e.g. "192.168.0.164:8081" — the host Metro is served from.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older manifest shape, still emitted by some clients.
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;

  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : null;
  if (host) return `http://${host}:3000`;

  // Simulator on the same machine.
  return "http://localhost:3000";
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChatOptions {
  readonly guide: GuideId;
  readonly messages: ChatTurn[];
  readonly userName?: string | null;
  /** Called with the full text so far, each time more arrives. */
  readonly onDelta: (fullText: string) => void;
  readonly signal?: AbortSignal;
  /**
   * Clerk session token. When present the request goes to the data API, which
   * persists the exchange and loads the user's memory into context. Without
   * one it falls back to the stateless web route — the guide still answers,
   * it just won't remember anything.
   */
  readonly token?: string | null;
  /** Existing conversation to continue; omitted starts a new one. */
  readonly conversationId?: string | null;
  /**
   * Set when the chat was opened from a community's weekly question, so the
   * guide knows what the user is working on. Membership is checked server-side.
   */
  readonly topicId?: string | null;
}

export interface StreamChatResult {
  readonly text: string;
  /** Server-assigned id — pass back on the next turn to continue the thread. */
  readonly conversationId: string | null;
}

export class ChatError extends Error {
  readonly code: string;
  constructor(message: string, code = "unknown") {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

/**
 * Stream a reply from a guide.
 *
 * Resolves with the complete text. Throws `ChatError` carrying a message that
 * is already safe and sensible to show the user — the route does that mapping
 * server-side, so the app never has to interpret HTTP status codes.
 */
export async function streamChat({
  guide,
  messages,
  userName,
  onDelta,
  signal,
  token,
  conversationId,
  topicId,
}: StreamChatOptions): Promise<StreamChatResult> {
  if (DEMO_MODE) {
    const last = messages[messages.length - 1]?.content ?? "";
    const text = await demoStreamChat(guide, last, onDelta, signal);
    return { text, conversationId: conversationId ?? "demo-conversation" };
  }

  let res: Response;

  // Signed-in users get the persistent route: their memory is loaded into
  // context and the exchange is saved. Signed-out falls back to the stateless
  // web route so the feature still works rather than erroring.
  const authenticated = Boolean(token);
  const url = authenticated
    ? `${dataApiBaseUrl()}/api/chat/me/stream`
    : `${apiBaseUrl()}/api/chat`;

  const body = authenticated
    ? {
        persona: guide,
        content: messages[messages.length - 1]?.content ?? "",
        ...(conversationId ? { conversationId } : {}),
        ...(topicId ? { topicId } : {}),
      }
    : { messages, userName, guide, surface: "app" };

  try {
    res = (await expoFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })) as unknown as Response;
  } catch (err) {
    if (signal?.aborted) throw new ChatError("Cancelled.", "aborted");
    throw new ChatError(
      "Couldn't reach Kinextion. Check your connection and try again.",
      "network"
    );
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { error?: string; code?: string }) => b)
      .catch(() => null);
    throw new ChatError(
      detail?.error ?? "Something went wrong. Try again.",
      detail?.code ?? String(res.status)
    );
  }

  // The server assigns this on a new thread; pass it back to continue.
  const newConversationId = res.headers.get("X-Conversation-Id") ?? conversationId ?? null;
  const stream = res.body;

  // expo/fetch gives us a real ReadableStream. If a runtime ever hands back a
  // response without one, fall back to a single buffered read so the feature
  // degrades to non-streaming rather than breaking.
  if (!stream) {
    const text = await res.text();
    onDelta(text);
    return { text, conversationId: newConversationId };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let full = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onDelta(full);
    }
  } catch (err) {
    if (signal?.aborted) return { text: full, conversationId: newConversationId };
    // Partial text is better than none — hand back what arrived.
    if (full) return { text: full, conversationId: newConversationId };
    throw new ChatError("The reply got cut off. Try again.", "stream_interrupted");
  } finally {
    void reader.cancel().catch(() => {});
  }

  return { text: full, conversationId: newConversationId };
}
