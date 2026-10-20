import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";

const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface WhoopRecoveryRecord {
  created_at: string;
  score?: { hrv_rmssd_milli?: number; resting_heart_rate?: number };
}

export const whoop: ProviderAdapter = {
  id: "whoop",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "read:recovery read:sleep read:profile offline");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri): Promise<OAuthTokens> {
    const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID ?? "",
        client_secret: CLIENT_SECRET ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`Whoop token exchange failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
    };
  },

  async refresh(refreshToken): Promise<OAuthTokens> {
    const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID ?? "",
        client_secret: CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Whoop token refresh failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
    };
  },

  async fetchMetrics(accessToken, since): Promise<WearableMetricInput[]> {
    const res = await fetch(
      `https://api.prod.whoop.com/developer/v1/recovery?start=${since.toISOString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Whoop recovery fetch failed (${res.status})`);
    const body = (await res.json()) as { records?: WhoopRecoveryRecord[] };

    const metrics: WearableMetricInput[] = [];
    for (const r of body.records ?? []) {
      const date = r.created_at.slice(0, 10);
      const raw = r as unknown as Record<string, unknown>;
      if (r.score?.hrv_rmssd_milli != null) {
        metrics.push({ metricType: "hrv", date, value: r.score.hrv_rmssd_milli, unit: "ms", raw });
      }
      if (r.score?.resting_heart_rate != null) {
        metrics.push({
          metricType: "resting_heart_rate",
          date,
          value: r.score.resting_heart_rate,
          unit: "bpm",
          raw,
        });
      }
    }
    return metrics;
  },
};
