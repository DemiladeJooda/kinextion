import { strava } from "./strava.js";
import { whoop } from "./whoop.js";
import { oura } from "./oura.js";
import { spotify } from "./spotify.js";
import { googleCalendar } from "./google-calendar.js";
import { outlookCalendar } from "./outlook-calendar.js";
import type { ProviderAdapter } from "./types.js";

export const PROVIDERS: Record<string, ProviderAdapter> = {
  strava,
  whoop,
  oura,
  spotify,
  google_calendar: googleCalendar,
  outlook_calendar: outlookCalendar,
};

/**
 * Providers that read a calendar rather than a body.
 *
 * Kept as a set so the app can group them under their own heading with their
 * own disclosure — connecting a work calendar is a different decision from
 * connecting a running watch, and shouldn't sit in the same list unexplained.
 */
export const CALENDAR_PROVIDERS = new Set(["google_calendar", "outlook_calendar"]);

export type { ProviderAdapter, OAuthTokens, WearableMetricInput } from "./types.js";
