import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { id?: number };
}

interface StravaActivity {
  start_date: string;
  moving_time: number;
  type: string;
  distance?: number;
  calories?: number;
}

export const strava: ProviderAdapter = {
  id: "strava",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL("https://www.strava.com/oauth/authorize");
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", "read,activity:read_all");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code): Promise<OAuthTokens> {
    const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      externalUserId: data.athlete?.id != null ? String(data.athlete.id) : null,
      scopes: [],
    };
  },

  async refresh(refreshToken): Promise<OAuthTokens> {
    const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Strava token refresh failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      externalUserId: null,
      scopes: [],
    };
  },

  async fetchMetrics(accessToken, since): Promise<WearableMetricInput[]> {
    const after = Math.floor(since.getTime() / 1000);
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Strava activities fetch failed (${res.status})`);
    const activities = (await res.json()) as StravaActivity[];

    return activities.map((a) => ({
      metricType: "workout",
      date: a.start_date.slice(0, 10),
      value: Math.round(a.moving_time / 60),
      unit: "min",
      raw: a as unknown as Record<string, unknown>,
    }));
  },
};
