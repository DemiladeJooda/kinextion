/**
 * Community — the numbers.
 *
 * Every tunable in the community layer lives here so that changing one is a
 * one-line diff with a test, not a hunt through route handlers. The reasoning
 * behind each is in the build plan; the short version is beside each value.
 */

// ─── The week ────────────────────────────────────────────────────

/**
 * Every community's week turns at the same instant, in this zone.
 *
 * Central because the first communities are in Dallas. A single global week
 * is dramatically simpler to operate and to explain — "rooms open Monday,
 * close Sunday night" — and clients always render deadlines in the viewer's
 * own zone, never this one.
 */
export const COMMUNITY_TIME_ZONE = "America/Chicago";

/**
 * When each stage of a week's cycle begins, as wall-clock time in
 * COMMUNITY_TIME_ZONE.
 *
 * Suggestions and voting happen in the *previous* week so the room itself is
 * open for the whole of its own week. `weekOffset` is relative to the room's
 * ISO week; `isoDay` is 1 (Monday) to 7 (Sunday).
 *
 * No boundary may fall between 01:00 and 03:00 — that's where DST transitions
 * happen in this zone, and a wall time inside the spring-forward gap doesn't
 * exist. schedule.test.ts pins this.
 */
export const CYCLE_SCHEDULE = {
  /** Kairo starts asking what's been on people's minds. */
  gatheringOpens: { weekOffset: -1, isoDay: 3, hour: 0, minute: 0 },
  /** Suggestions close; the four synthesized options go to a vote. */
  votingOpens: { weekOffset: -1, isoDay: 5, hour: 18, minute: 0 },
  /** The winning topic opens and people can speak. */
  roomOpens: { weekOffset: 0, isoDay: 1, hour: 0, minute: 0 },
  /** Sunday evening, so the reveal lands before the week ends for people. */
  roomCloses: { weekOffset: 0, isoDay: 7, hour: 21, minute: 0 },
} as const;

// ─── Founding & admission ────────────────────────────────────────

/**
 * Accepted founders needed before a community becomes real.
 *
 * Set by the privacy promise rather than by sociology: below six, an
 * anonymous admission vote isn't anonymous — with three voters you can work
 * out who objected.
 */
export const FOUNDING_QUORUM = 6;

/** A community that never reaches quorum is archived after this long. */
export const FORMING_EXPIRY_DAYS = 30;

/** Communities one person can have forming at once — founding is an act, not a broadcast. */
export const MAX_FORMING_PER_FOUNDER = 3;

/** Founding invites are single-use and expire. */
export const INVITE_TTL_DAYS = 14;

/**
 * Invites sent while a community was forming can still be accepted this long
 * after it becomes active. A founder who invites eleven friends at once
 * shouldn't see the slowest five sent to admission because six were quicker.
 * No new invites can be created once active, so this can't become a way
 * around recognition.
 */
export const FOUNDING_WINDOW_DAYS = 7;

/** Outstanding invites per forming community — a founding group, not a mailing list. */
export const MAX_OPEN_INVITES = 50;

/** How long a panel has to respond before its silent seats are redrawn. */
export const PANEL_TIMEOUT_HOURS = 72;

/** After a denial, how long before the same person may ask again. */
export const REAPPLY_COOLDOWN_DAYS = 30;

/**
 * Above this roster size, nobody can reasonably be expected to recognise
 * every applicant, so a steward may admit on external proof.
 */
export const STEWARD_FAST_TRACK_ROSTER = 150;

// ─── Topics & ballots ────────────────────────────────────────────

/** Private suggestions one person can make per week's gathering. */
export const MAX_SUGGESTIONS_PER_CYCLE = 3;

/** Options Kairo puts on each week's topic ballot. */
export const TOPIC_OPTION_COUNT = 4;

/** Below this many suggestions, the ballot comes from the prompt bank rather than a model inventing from nothing. */
export const MIN_SUGGESTIONS_FOR_SYNTHESIS = 3;

/** How many past weeks' topics the facilitator avoids repeating. */
export const RECENT_TOPIC_WEEKS = 6;

/** A vote to close a community stays open this long. */
export const CLOSURE_VOTE_DAYS = 7;

/** At least this share of active members must vote for a closure to count. */
export const CLOSURE_MIN_TURNOUT = 0.5;

/** Closing needs this share of the votes cast. Ending a community is not a simple-majority decision. */
export const CLOSURE_SUPERMAJORITY = 2 / 3;

/** After a closure vote fails, how long before another can be proposed — so it can't be used to wear people down. */
export const CLOSURE_COOLDOWN_DAYS = 30;

/**
 * The themes a topic can carry. The facilitator uses them to keep a room's
 * rhythm varied — not to rank, target or monetise anything.
 */
export const TOPIC_THEMES = [
  "relationships",
  "faith",
  "work",
  "money",
  "health",
  "family",
  "identity",
  "culture",
  "community",
  "growth",
  "lighthearted",
] as const;

export type TopicTheme = (typeof TOPIC_THEMES)[number];

/** Themes that give a heavy run of weeks some air. */
export const LIGHT_THEMES: readonly TopicTheme[] = ["lighthearted", "culture", "community"];

// ─── Responses ───────────────────────────────────────────────────

/** The price of entry to a room. Enforced by the client and again by the API. */
export const MIN_RESPONSE_SECONDS = 120;

/** The shape of a real answer — shown in the recorder, never required. */
export const ENCOURAGED_RESPONSE_SECONDS = { min: 300, max: 900 } as const;

/** Recording hard-stops here, with the take preserved. */
export const MAX_RESPONSE_SECONDS = 1200;

/** Public responses disappear this long after the room closes. */
export const PUBLIC_TTL_DAYS = 30;

// ─── Media ───────────────────────────────────────────────────────

/**
 * What the recorder and the uploader may send. Phones record MP4/MOV video and
 * M4A/AAC audio; MP3 covers existing podcast files.
 */
export const MEDIA_MIME_TYPES = {
  video: ["video/mp4", "video/quicktime"],
  audio: ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg"],
} as const;

/**
 * Size ceilings. A talking head at 720p and a modest bitrate is a few hundred
 * megabytes for 15 minutes; these leave room for an existing podcast upload
 * without inviting a raw 4K file.
 */
export const MAX_VIDEO_BYTES = 750 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;

/** Presigned upload URLs last long enough for a slow connection, not a day. */
export const UPLOAD_URL_TTL_SECONDS = 60 * 60;

/** Playback URLs are short-lived and re-issued per request. */
export const PLAYBACK_URL_TTL_SECONDS = 15 * 60;

/** An upload never attached to a response is deleted after this. */
export const ABANDONED_UPLOAD_HOURS = 24;

/** Unfinished uploads one person may have open at once. */
export const MAX_PENDING_UPLOADS = 5;

// ─── Integrity ───────────────────────────────────────────────────

/**
 * Below this share of audible signal, a recording is treated as silent. The
 * recorder meters levels as it records and sends the ratio; a talking head
 * with pauses sits far above it, a phone left face-down sits far below.
 */
export const MIN_SIGNAL_RATIO = 0.15;

/** How long a strike counts. */
export const STRIKE_TTL_DAYS = 30;

/** Strikes within the window that bring a temporary restriction. */
export const STRIKES_FOR_RESTRICTION = 3;

/**
 * How long a restriction lasts. Temporary by design: nothing automatic ever
 * removes a person. Anything beyond this is a human's decision.
 */
export const RESTRICTION_DAYS = 7;

// ─── Chest ───────────────────────────────────────────────────────

/** Open project proposals one member can have at once. */
export const MAX_OPEN_CHEST_PROPOSALS = 2;

/** Proposals needed before a chest vote can be called. */
export const MIN_CHEST_PROPOSALS = 2;

/** At most this many projects go on one chest ballot. */
export const MAX_CHEST_OPTIONS = 6;

/** A chest vote stays open this long. */
export const CHEST_VOTE_DAYS = 7;

// ─── Circles ─────────────────────────────────────────────────────

/**
 * A room is bounded by the listener's week: 12 responses at a 7-minute median
 * is 84 minutes, about a feature film. Past that, people stop finishing the
 * room, so larger communities get more rooms rather than bigger ones.
 */
export const CIRCLE_TARGET = 10;
export const CIRCLE_MAX = 12;
/** Circles smaller than this are merged at close. */
export const CIRCLE_MIN = 8;
