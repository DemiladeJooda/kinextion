/**
 * Low-level HTTP client for the Kinextion data API (apps/api — Fastify +
 * Prisma). Distinct from lib/api.ts, which talks to the Next.js chat/vision
 * routes: this one carries the user's Clerk session token and persists real
 * data (habits, mood, score, profile).
 */

import Constants from "expo-constants";

/**
 * Resolve the data API origin. Same "same Wi-Fi as Metro" fallback as
 * lib/api.ts's apiBaseUrl, but pointed at the Fastify server's port (3001)
 * instead of the Next.js app's (3000).
 */
export function dataApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_DATA_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;

  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : null;
  if (host) return `http://${host}:3001`;

  return "http://localhost:3001";
}

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Clerk session JWT. Every route on this API requires one. */
  token: string | null;
  query?: Record<string, string | undefined>;
}

interface ApiEnvelope<T, M = unknown> {
  success: boolean;
  data?: T;
  /** Optional sidecar — details about the response that aren't the response
   *  itself, e.g. which signals a generated recommendation was built from. */
  meta?: M;
  error?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions
): Promise<T> {
  const { data } = await apiRequestWithMeta<T, unknown>(path, options);
  return data;
}

/** Same request, keeping the envelope's `meta` alongside the data. */
export async function apiRequestWithMeta<T, M = unknown>(
  path: string,
  { method = "GET", body, token, query }: RequestOptions
): Promise<{ data: T; meta: M | undefined }> {
  if (!token) {
    throw new ApiRequestError("Not signed in.", 401);
  }

  const url = new URL(`${dataApiBaseUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError("Couldn't reach Kinextion. Check your connection.", 0);
  }

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T, M> | null;

  if (!res.ok || !payload?.success) {
    throw new ApiRequestError(payload?.error ?? `Request failed (${res.status})`, res.status);
  }

  return { data: payload.data as T, meta: payload.meta };
}
