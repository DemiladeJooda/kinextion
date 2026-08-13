/**
 * Fixed-window, in-memory rate limiter.
 *
 * ⚠️ Scope: this counts requests *per server instance*. That is correct for a
 * single long-lived Node process (a VPS, a container, `next start`), which is
 * how this app is intended to run. On a multi-instance or serverless
 * deployment each instance keeps its own counter, so the effective limit is
 * `limit × instances` — swap `hit()` for Upstash Redis / Vercel KV before
 * scaling out. REDIS_URL is already in .env.example for exactly this.
 *
 * The chat endpoint is unauthenticated and every call costs real money, so
 * some limit is strictly better than none.
 */

interface Window {
  count: number;
  /** Epoch ms when this window expires. */
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Stop the Map growing without bound on a long-running process. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number): void {
  for (const [key, win] of windows) {
    if (win.resetAt <= now) windows.delete(key);
  }
  // Pathological case: more distinct keys than we ever want to hold. Drop the
  // oldest-inserted entries (Map preserves insertion order).
  if (windows.size > MAX_TRACKED_KEYS) {
    const excess = windows.size - MAX_TRACKED_KEYS;
    let i = 0;
    for (const key of windows.keys()) {
      if (i++ >= excess) break;
      windows.delete(key);
    }
  }
}

export interface RateLimitResult {
  readonly ok: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Seconds until the window resets. */
  readonly retryAfter: number;
}

export function hit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Sweep occasionally rather than on every call.
  if (Math.random() < 0.02) sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    ok: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
  };
}

/**
 * Best-effort client identity for rate limiting.
 *
 * Trusts `x-forwarded-for` / `x-real-ip`, which is correct behind a proxy you
 * control (Vercel, Cloudflare, nginx) and spoofable if the app is exposed
 * directly. Falls back to a single shared bucket rather than letting an
 * unidentifiable caller through unlimited.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
