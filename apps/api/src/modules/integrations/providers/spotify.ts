import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/** Spotify wants client credentials as a Basic auth header, not a JSON body. */
function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface RecentlyPlayedItem {
  played_at: string;
  track: { duration_ms: number };
}

/**
 * Listening minutes per day, not fitness data — this is life-context, same
 * spirit as the calendar providers, not a wearable metric. `metricType`
 * stays distinct ("listening_minutes") so it never gets averaged in with a
 * body signal by anything reading the generic metrics list.
 */
export const spotify: ProviderAdapter = {
  id: "spotify",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user-read-recently-played");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri): Promise<OAuthTokens> {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`Spotify token exchange failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: [],
    };
  },

  async refresh(refreshToken): Promise<OAuthTokens> {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`Spotify token refresh failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: [],
    };
  },

  async fetchMetrics(accessToken, _since): Promise<WearableMetricInput[]> {
    // Spotify's recently-played endpoint is capped at the last 50 plays with
    // no date filter, so `since` can't narrow the request — only the result.
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Spotify recently-played fetch failed (${res.status})`);
    const data = (await res.json()) as { items: RecentlyPlayedItem[] };

    const minutesByDate = new Map<string, number>();
    for (const item of data.items) {
      const date = item.played_at.slice(0, 10);
      minutesByDate.set(date, (minutesByDate.get(date) ?? 0) + item.track.duration_ms / 60_000);
    }

    return [...minutesByDate.entries()].map(([date, minutes]) => ({
      metricType: "listening_minutes",
      date,
      value: Math.round(minutes),
      unit: "min",
    }));
  },
};
