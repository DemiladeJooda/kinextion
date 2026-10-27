import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";

const CLIENT_ID = process.env.OURA_CLIENT_ID;
const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface OuraDailyActivity {
  day: string;
  steps?: number;
}

interface OuraDailySleep {
  day: string;
  score?: number;
}

/** A sleep period; the main night is `long_sleep`. */
interface OuraSleepPeriod {
  day: string;
  type?: string;
  total_sleep_duration?: number | null;
  average_hrv?: number | null;
  lowest_heart_rate?: number | null;
}

export const oura: ProviderAdapter = {
  id: "oura",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL("https://cloud.ouraring.com/oauth/authorize");
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "daily heartrate");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri): Promise<OAuthTokens> {
    const res = await fetch("https://api.ouraring.com/oauth/token", {
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
    if (!res.ok) throw new Error(`Oura token exchange failed (${res.status})`);
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
    const res = await fetch("https://api.ouraring.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID ?? "",
        client_secret: CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Oura token refresh failed (${res.status})`);
    const data = (await res.json()) as TokenResponse;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: [],
    };
  },

  async fetchMetrics(accessToken, since): Promise<WearableMetricInput[]> {
    const startDate = since.toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Oura sleep fetch failed (${res.status})`);
    const body = (await res.json()) as { data?: OuraDailySleep[] };

    const metrics: WearableMetricInput[] = (body.data ?? [])
      .filter((d): d is Required<OuraDailySleep> => d.score != null)
      .map((d) => ({
        metricType: "sleep_score",
        date: d.day,
        value: d.score,
        raw: d as unknown as Record<string, unknown>,
      }));

    const activity = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (activity.ok) {
      const ab = (await activity.json()) as { data?: OuraDailyActivity[] };
      for (const a of ab.data ?? []) {
        if (a.steps != null) metrics.push({ metricType: "steps", date: a.day, value: a.steps, unit: "steps" });
      }
    }

    // Readiness, and the night's own numbers: time asleep, overnight HRV,
    // and the lowest heart rate (Oura's resting heart rate). Each is extra:
    // if one call fails, the rest of the sync still lands.
    const readiness = await fetch(
      `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (readiness.ok) {
      const rb = (await readiness.json()) as { data?: OuraDailySleep[] };
      for (const r of rb.data ?? []) {
        if (r.score != null) metrics.push({ metricType: "readiness", date: r.day, value: r.score });
      }
    }
    const sleep = await fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (sleep.ok) {
      const sb = (await sleep.json()) as { data?: OuraSleepPeriod[] };
      for (const s of (sb.data ?? []).filter((p) => p.type === "long_sleep")) {
        if (s.total_sleep_duration != null) {
          metrics.push({ metricType: "sleep_duration", date: s.day, value: Math.round(s.total_sleep_duration / 60), unit: "min" });
        }
        if (s.average_hrv != null) metrics.push({ metricType: "hrv", date: s.day, value: s.average_hrv, unit: "ms" });
        if (s.lowest_heart_rate != null) {
          metrics.push({ metricType: "resting_heart_rate", date: s.day, value: s.lowest_heart_rate, unit: "bpm" });
        }
      }
    }
    return metrics;
  },
};
