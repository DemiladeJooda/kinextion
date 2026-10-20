/**
 * Google Calendar — read-only, reduced to rhythm.
 *
 * Requests `calendar.readonly` because Google has no narrower scope for
 * reading event times. What we *do* with that access is the actual limit:
 * every event goes through deriveRhythm, which keeps five numbers a day and
 * discards the rest before anything is stored. See calendar-rhythm.ts.
 */

import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";
import { deriveRhythm, rhythmWindow, type CalendarEvent } from "./calendar-rhythm.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface GoogleEvent {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  transparency?: string;
}

async function postForm(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export const googleCalendar: ProviderAdapter = {
  id: "google_calendar",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    // Without both of these Google returns a refresh token only on the very
    // first consent, and a reconnect months later would silently expire.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code, redirectUri): Promise<OAuthTokens> {
    const data = await postForm({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      // Deliberately not stored: identifying the Google account isn't needed
      // to read free/busy shape, so it isn't collected.
      externalUserId: null,
      scopes: data.scope ? data.scope.split(" ") : [SCOPE],
    };
  },

  async refresh(refreshToken): Promise<OAuthTokens> {
    const data = await postForm({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    return {
      accessToken: data.access_token,
      // Google doesn't reissue one on refresh — keep the one we have.
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: data.scope ? data.scope.split(" ") : [SCOPE],
    };
  },

  async fetchMetrics(accessToken, since): Promise<WearableMetricInput[]> {
    const { from, to } = rhythmWindow(since);

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", from.toISOString());
    url.searchParams.set("timeMax", to.toISOString());
    // Expands recurring events into instances — a weekly standup should count
    // on every week it actually occupies, not once.
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Calendar fetch failed (${res.status})`);

    const body = (await res.json()) as { items?: GoogleEvent[] };

    const events: CalendarEvent[] = (body.items ?? [])
      // Cancelled events aren't commitments; "transparent" ones are marked
      // free by the user, so treating them as busy would misread the day.
      .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent")
      .map((e) => ({
        start: e.start?.dateTime ?? "",
        end: e.end?.dateTime ?? "",
        allDay: !e.start?.dateTime,
      }))
      .filter((e) => e.allDay || (e.start && e.end));

    return deriveRhythm(events, "google_calendar");
  },
};
