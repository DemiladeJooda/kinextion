/**
 * First-party analytics.
 *
 * No third-party script, no cookie, no fingerprint, no IP stored. What gets
 * sent is an event name, which tab it happened on, and a random id that lives
 * in `sessionStorage` — so it dies with the browser tab and can't follow a
 * visitor between visits. That's deliberately weaker than what an analytics
 * vendor would give you: it can answer "which tab converts" and "where do
 * people drop", and it cannot answer "who was that", which is the trade this
 * product should be making on a page about mental health.
 *
 * Do Not Track and Global Privacy Control are honoured by switching the whole
 * module off rather than by sending a flag along with the data.
 */

import type { AnalyticsEventName } from "@kinextion/shared";

const SESSION_KEY = "kx_session";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 50;

interface QueuedEvent {
  name: AnalyticsEventName;
  tab?: string;
  props?: Record<string, string | number | boolean>;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

/** Respect the browser's stated preference, whichever way it's expressed. */
function optedOut(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & {
    doNotTrack?: string;
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes" || nav.globalPrivacyControl === true;
}

/**
 * The session id.
 *
 * `sessionStorage`, not `localStorage`: a per-tab lifetime is what keeps this
 * a funnel measurement rather than a visitor profile. Wrapped because private
 * modes and locked-down browsers throw on access rather than returning null.
 */
function sessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function send(useBeacon: boolean) {
  if (queue.length === 0) return;

  const id = sessionId();
  const base = apiBase();
  if (!id || !base) {
    queue = [];
    return;
  }

  const body = JSON.stringify({ sessionId: id, events: queue.slice(0, MAX_BATCH) });
  queue = queue.slice(MAX_BATCH);

  // On page hide, `fetch` is routinely cancelled mid-flight — and the visitor
  // who leaves is exactly the drop-off this exists to measure, so that's the
  // one event we can least afford to lose. sendBeacon survives unload.
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(`${base}/api/events`, new Blob([body], { type: "application/json" }));
      return;
    } catch {
      // Fall through to fetch.
    }
  }

  void fetch(`${base}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface an error to a visitor.
  });
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    send(false);
  }, FLUSH_INTERVAL_MS);
}

/** Flush on the way out, once per page. */
function wireUnload() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("pagehide", () => send(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send(true);
  });
}

export function track(
  name: AnalyticsEventName,
  tab?: string,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined" || optedOut()) return;

  wireUnload();
  queue.push({ name, tab, props });

  // A full batch goes now rather than waiting out the timer.
  if (queue.length >= MAX_BATCH) send(false);
  else scheduleFlush();
}

/** True when events are actually being collected — used to label the UI honestly. */
export function analyticsEnabled(): boolean {
  return typeof window !== "undefined" && !optedOut() && Boolean(apiBase());
}

/**
 * Fire `session_start` at most once per session.
 *
 * The obvious version — track it from a mount effect — counts page loads, not
 * sessions: a reload keeps the same session id from sessionStorage but mounts
 * the component again, so one visitor reading three pages arrives in the data
 * as three sessions and every per-session rate is wrong. The flag lives beside
 * the id in sessionStorage so the two have the same lifetime.
 */
const STARTED_KEY = "kx_session_started";

export function trackSessionStart(): void {
  if (typeof window === "undefined" || optedOut()) return;
  try {
    if (sessionStorage.getItem(STARTED_KEY)) return;
    sessionStorage.setItem(STARTED_KEY, "1");
  } catch {
    // Storage unavailable — the session id would be missing too, so the batch
    // is dropped at send time anyway. Don't double-count by falling through.
    return;
  }
  track("session_start");
}
