/**
 * Outlook / Microsoft 365 calendar — read-only, reduced to rhythm.
 *
 * Same contract as the Google adapter: `Calendars.Read`, and every event goes
 * through deriveRhythm so only five numbers a day survive to storage.
 *
 * One Graph-specific wrinkle handled here: Graph returns event times in UTC
 * unless you ask otherwise, and UTC would make "your first meeting is at 14:00"
 * wrong for most of the world. So the adapter reads the mailbox's own time
 * zone first and asks Graph to render times in it.
 */

import type { OAuthTokens, ProviderAdapter, WearableMetricInput } from "./types.js";
import { deriveRhythm, rhythmWindow, type CalendarEvent } from "./calendar-rhythm.js";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;

/** "common" lets both personal and work/school accounts connect. */
const TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;

/** offline_access is what makes a refresh token appear at all. */
const SCOPE = "offline_access Calendars.Read MailboxSettings.Read";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface GraphEvent {
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
}

async function postForm(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`Microsoft token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

/** The mailbox's configured zone, so Graph can render local wall-clock times. */
async function mailboxTimeZone(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings/timeZone", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { value?: string };
    return body.value ?? null;
  } catch {
    return null;
  }
}

export const outlookCalendar: ProviderAdapter = {
  id: "outlook_calendar",

  isConfigured: () => !!CLIENT_ID && !!CLIENT_SECRET,

  getAuthorizeUrl(state, redirectUri) {
    const url = new URL(`${AUTH_BASE}/authorize`);
    url.searchParams.set("client_id", CLIENT_ID ?? "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", SCOPE);
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
      scope: SCOPE,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: data.scope ? data.scope.split(" ") : SCOPE.split(" "),
    };
  },

  async refresh(refreshToken): Promise<OAuthTokens> {
    const data = await postForm({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPE,
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      externalUserId: null,
      scopes: data.scope ? data.scope.split(" ") : SCOPE.split(" "),
    };
  },

  async fetchMetrics(accessToken, since): Promise<WearableMetricInput[]> {
    const { from, to } = rhythmWindow(since);
    const zone = await mailboxTimeZone(accessToken);

    const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
    url.searchParams.set("startDateTime", from.toISOString());
    url.searchParams.set("endDateTime", to.toISOString());
    url.searchParams.set("$top", "250");
    url.searchParams.set("$orderby", "start/dateTime");
    // Ask for only the fields rhythm needs. Titles and attendees are never
    // requested, so they never reach this process at all.
    url.searchParams.set("$select", "start,end,isAllDay,isCancelled,showAs");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Graph renders start/end in this zone; without it, everything is UTC.
        ...(zone ? { Prefer: `outlook.timezone="${zone}"` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Outlook calendar fetch failed (${res.status})`);

    const body = (await res.json()) as { value?: GraphEvent[] };

    const events: CalendarEvent[] = (body.value ?? [])
      // "free" and "workingElsewhere" are on the calendar but aren't
      // commitments that block a habit.
      .filter((e) => !e.isCancelled && e.showAs !== "free" && e.showAs !== "workingElsewhere")
      .map((e) => ({
        start: e.start?.dateTime ?? "",
        end: e.end?.dateTime ?? "",
        allDay: Boolean(e.isAllDay),
      }))
      .filter((e) => e.allDay || (e.start && e.end));

    return deriveRhythm(events, "outlook_calendar");
  },
};
