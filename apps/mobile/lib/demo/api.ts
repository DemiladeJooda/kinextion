/**
 * The demo backend: an in-memory stand-in for every call in hooks/useApi.ts.
 *
 * The data describes one person about five weeks in — habits with real
 * streaks, a connected ring and calendar, a community week in motion — so a
 * demo can walk every screen without an empty state. It is stateful for the
 * life of the app: tick a habit and the score moves, vote and the ballot
 * remembers, speak and the room opens.
 *
 * Communities are named generically on purpose. Real community content has to
 * come from real, verified groups; nothing here should read as one.
 */

import {
  addDays,
  localDateKey,
  weekStartKey,
  type CheckInInput,
  type CreateHabitInput,
  type UserBackground,
} from "@kinextion/shared";
import type {
  AdmissionSeatView,
  BallotView,
  ChestView,
  CommentView,
  CommunityDetail,
  CommunityGoalView,
  CommunityHistoryView,
  CycleResultView,
  CycleView,
  DiscoverResponseView,
  DiscoverRow,
  DiscoverView,
  MyResponseView,
  MyWeekView,
  RoomView,
  TopicView,
} from "@kinextion/shared";

import type { Api } from "../../hooks/useApi";
import type {
  IntegrationProvider,
  RemoteHabit,
  RemoteHabitLog,
  RemoteAway,
  WeekDot,
  RemoteMoodEntry,
  RemoteNearbyGroup,
  RemotePeriodScore,
  RemoteRecommendation,
  RemoteScore,
  RemoteWearableMetric,
  TherapistCategories,
  TherapistReport,
} from "../../services";
import { getDemoSession, updateDemoSession } from "./session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
/** Ids shaped like cuids — the log schema checks the format. */
const uid = (p: string) => `c${p}${(Date.now() + seq++).toString(36)}demo`;

const day = (offset: number) => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (offset: number, hour = 9) => {
  const d = day(offset);
  d.setHours(hour);
  return d.toISOString();
};
const dateOf = (offset: number) => localDateKey(day(offset));
const todayStr = () => localDateKey(new Date());
/** Deterministic wobble so charts look organic but identical every demo. */
const wobble = (i: number, seed: number) =>
  Math.sin(i * 1.7 + seed) * 0.5 + Math.sin(i * 0.45 + seed * 2) * 0.5;

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Same real, hand-verified Dallas groups as apps/api/src/jobs/seed-nearby-groups.ts
 * — demo mode shows the real thing rather than invented businesses. Keep the
 * two lists in sync if either changes.
 */
const DALLAS_GROUPS: Omit<RemoteNearbyGroup, "distanceKm">[] = [
  {
    id: "demo-214-run-club",
    name: "214 Run Club",
    category: "running",
    description:
      "Free Saturday morning group runs — 8 miles for distance runners, 3-5 miles for everyone else.",
    address: "4825 Cole Ave, Dallas, TX 75205",
    city: "Dallas",
    lat: 32.826576,
    lng: -96.7870713,
    website: "https://www.instagram.com/the214runclub/",
    phone: null,
    schedule: "Saturdays, 7:30am (distance) & 8:30am (3-5 mi)",
    isFree: true,
    sourceUrl:
      "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-oak-cliff-run-crew",
    name: "Oak Cliff Run Crew",
    category: "running",
    description: "Neighborhood run crew based in Oak Cliff, open to all paces.",
    address: "1406 N Zang Blvd, Dallas, TX 75208",
    city: "Dallas",
    lat: 32.7609136,
    lng: -96.8176488,
    website: "https://www.oakcliffruncrew.com/",
    phone: null,
    schedule: "Thursdays 7pm, Sundays 7am",
    isFree: true,
    sourceUrl:
      "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-braindead-running-club",
    name: "Braindead Running Club",
    category: "running",
    description:
      "Casual 3-5 mile Monday run from Westlake Brewing Company through Deep Ellum, Old East Dallas or Klyde Warren Park.",
    address: "2816 Commerce St, Dallas, TX 75226",
    city: "Dallas",
    lat: 32.7830812,
    lng: -96.7824499,
    website: "https://www.westlakebeer.com/",
    phone: null,
    schedule: "Mondays",
    isFree: true,
    sourceUrl:
      "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-pint-striders",
    name: "Pint Striders",
    category: "running",
    description:
      "Social run club meeting at Bar W in Uptown, open to all paces.",
    address: "2926 Maple Ave, Dallas, TX 75201",
    city: "Dallas",
    lat: 32.7980309,
    lng: -96.8069816,
    website: null,
    phone: null,
    schedule: "Thursdays, 6:30pm",
    isFree: true,
    sourceUrl:
      "https://www.dallasites101.com/blog/post/running-clubs-groups-all-levels-dallas-fort-worth/",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-otf-lovers-lane",
    name: "Orangetheory Fitness – Lovers Lane",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "5549 W Lovers Lane, Dallas, TX 75209",
    city: "Dallas",
    lat: 32.851202,
    lng: -96.8372632,
    website: "https://www.orangetheory.com/en-us/locations/dallas-texas-1423",
    phone: "(972) 474-0725",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.orangetheory.com/en-us/locations/dallas-texas-1423",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-otf-uptown",
    name: "Orangetheory Fitness – Uptown",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "4447 N Central Expy #100, Dallas, TX 75205",
    city: "Dallas",
    lat: 32.7995487,
    lng: -96.793447,
    website: "https://www.orangetheory.com/en-us/locations/dallas-texas-1029",
    phone: "(972) 474-0382",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.orangetheory.com/en-us/locations/dallas-texas-1029",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-otf-victory-park",
    name: "Orangetheory Fitness – Victory Park",
    category: "hiit",
    description: "Heart-rate-based group HIIT studio.",
    address: "625 High Market St #100, Dallas, TX 75219",
    city: "Dallas",
    lat: 32.7863983,
    lng: -96.8092258,
    website:
      "https://www.orangetheory.com/en-us/locations/victory-park-texas-1028",
    phone: null,
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl:
      "https://www.orangetheory.com/en-us/locations/victory-park-texas-1028",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-corepower-victory-park",
    name: "CorePower Yoga – Victory Park",
    category: "yoga",
    description: "Heated and power yoga studio.",
    address: "1700 Cedar Springs Rd Suite 110, Dallas, TX 75202",
    city: "Dallas",
    lat: 32.788817,
    lng: -96.805545,
    website:
      "https://www.corepoweryoga.com/yoga-studios/tx/dallas/victory-park",
    phone: null,
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl:
      "https://www.corepoweryoga.com/yoga-studios/tx/dallas/victory-park",
    verifiedAt: "2026-10-06",
  },
  {
    id: "demo-black-swan-lovers-lane",
    name: "Black Swan Yoga – Lovers Lane",
    category: "yoga",
    description: "Donation- and membership-based community yoga studio.",
    address: "5118 W Lovers Lane, Dallas, TX 75209",
    city: "Dallas",
    lat: 32.8509787,
    lng: -96.8228503,
    website: "https://www.blackswanyoga.com/studios/lovers",
    phone: "(214) 233-6283",
    schedule: "Class times vary — book on the app",
    isFree: false,
    sourceUrl: "https://www.blackswanyoga.com/studios/lovers",
    verifiedAt: "2026-10-06",
  },
];

/**
 * Stand-in media for community responses. Swap these for real recorded
 * answers before a demo where the playback itself matters.
 */
export const DEMO_MEDIA = {
  audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  video:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
};

// ─── Habits ───────────────────────────────────────────────────────────────────

const USER_ID = "cdemouser0001";

function habit(
  id: string,
  name: string,
  category: string,
  cue: string,
  loop: { craving: string; response: string; reward: string },
  createdDaysAgo: number,
): RemoteHabit {
  return {
    id,
    userId: USER_ID,
    name,
    category,
    cue,
    ...loop,
    frequency: "daily",
    targetDays: null,
    isActive: true,
    createdAt: iso(-createdDaysAgo),
  };
}

let habits: RemoteHabit[] = [
  habit(
    "chabitwater001",
    "Glass of water on waking",
    "physical",
    "When my alarm goes off",
    {
      craving: "Feel awake before I reach for my phone",
      response: "Drink the glass I left on the nightstand",
      reward: "First tick of the day",
    },
    38,
  ),
  habit(
    "chabitwalk0001",
    "Ten-minute walk after lunch",
    "physical",
    "After I close my laptop for lunch",
    {
      craving: "Clear the afternoon slump",
      response: "Walk the block, no headphones",
      reward: "Coffee on the way back",
    },
    35,
  ),
  habit(
    "chabitbreath01",
    "Two minutes of box breathing",
    "emotional",
    "Before I open email",
    {
      craving: "Start work calm, not reactive",
      response: "Four in, hold, four out, hold",
      reward: "Inbox feels smaller",
    },
    30,
  ),
  habit(
    "chabitread0001",
    "Read 10 pages before bed",
    "mental",
    "When I plug my phone in to charge",
    {
      craving: "Wind down without a screen",
      response: "Book is already on the pillow",
      reward: "Falling asleep faster",
    },
    24,
  ),
  habit(
    "chabitstretch1",
    "Five-minute stretch",
    "physical",
    "While the kettle boils",
    {
      craving: "Loosen up after sitting",
      response: "Hips, hamstrings, shoulders",
      reward: "Tea tastes earned",
    },
    14,
  ),
  habit(
    "chabitgrate001",
    "One line of gratitude",
    "spiritual",
    "After I brush my teeth at night",
    {
      craving: "End the day on something good",
      response: "One line in the notes app",
      reward: "A list worth rereading",
    },
    10,
  ),
];

/** Current streak (ending yesterday), whether it's done today, and past hit rate. */
const HABIT_SHAPE: Record<
  string,
  { streak: number; today: boolean; rate: number }
> = {
  chabitwater001: { streak: 31, today: true, rate: 0.95 },
  chabitwalk0001: { streak: 12, today: true, rate: 0.8 },
  chabitbreath01: { streak: 21, today: false, rate: 0.85 },
  chabitread0001: { streak: 6, today: false, rate: 0.7 },
  chabitstretch1: { streak: 0, today: false, rate: 0.55 },
  chabitgrate001: { streak: 4, today: false, rate: 0.75 },
};

function seedLogs(): RemoteHabitLog[] {
  const out: RemoteHabitLog[] = [];
  habits.forEach((h, hi) => {
    const shape = HABIT_SHAPE[h.id]!;
    const age = Math.round(
      (Date.now() - new Date(h.createdAt).getTime()) / 86_400_000,
    );
    for (let d = 0; d <= age; d++) {
      let completed: boolean;
      if (d === 0) completed = shape.today;
      else if (d <= shape.streak) completed = true;
      else if (d === shape.streak + 1)
        completed = false; // what ended the last run
      else completed = (wobble(d, hi + 1) + 1) / 2 < shape.rate;
      if (d === 0 && !completed) continue;
      out.push({
        id: uid("log"),
        habitId: h.id,
        userId: USER_ID,
        date: dateOf(-d),
        completed,
        notes: null,
      });
    }
  });
  return out;
}

let logs = seedLogs();
let demoReflections: Awaited<ReturnType<Api["listReflections"]>> = [];
let demoPromises: Awaited<ReturnType<Api["listPrecommitments"]>> = [];
let demoChecks: Awaited<ReturnType<Api["listAutomaticity"]>> = [];

// ─── Check-in & score ─────────────────────────────────────────────────────────

let todayEntry: RemoteMoodEntry | null = null;
let workoutToday = true; // Strava synced a morning run

function streakDays() {
  return Math.max(...habits.map((h) => HABIT_SHAPE[h.id]?.streak ?? 0), 0);
}

function computeScore(): RemoteScore {
  const t = todayStr();
  const done = habits.filter((h) =>
    logs.some((l) => l.habitId === h.id && l.date === t && l.completed),
  ).length;
  const moodCheckedIn = !!todayEntry;
  const reflectionDone = !!(todayEntry?.journal || todayEntry?.gratitude);
  const overall = Math.round(
    (habits.length ? (done / habits.length) * 45 : 0) +
      (moodCheckedIn ? 15 : 0) +
      (reflectionDone ? 15 : 0) +
      (workoutToday ? 15 : 0) +
      Math.min(10, streakDays() / 3),
  );
  return {
    id: "cscoretoday01",
    userId: USER_ID,
    date: t,
    overallScore: overall,
    breakdown: {
      habitsCompleted: done,
      habitsTotal: habits.length,
      workoutLogged: workoutToday,
      moodCheckedIn,
      reflectionDone,
      streakDays: streakDays(),
    },
  };
}

function scoreHistory(days: number): RemoteScore[] {
  return Array.from({ length: days }, (_, i) => {
    const offset = -(days - 1 - i);
    if (offset === 0) return computeScore();
    // Climbing from the low 50s to the high 70s, with real bad days in it.
    const trend = 52 + (i / days) * 26;
    return {
      id: `cscore${i}`,
      userId: USER_ID,
      date: dateOf(offset),
      overallScore: Math.round(
        Math.max(20, Math.min(98, trend + wobble(i, 3) * 11)),
      ),
      breakdown: null,
    };
  });
}

const pastEntries: RemoteMoodEntry[] = [
  {
    mood: 8,
    energy: 7,
    stress: 3,
    tags: ["focused", "rested"],
    journal:
      "Walked at lunch even though it rained. Afternoon was noticeably better.",
    gratitude: "Sam covering the standup so I could sleep in.",
  },
  {
    mood: 6,
    energy: 5,
    stress: 6,
    tags: ["scattered"],
    journal:
      "Too many meetings. Skipped the stretch again — the kettle cue doesn't work on office days.",
    gratitude: null,
  },
  {
    mood: 7,
    energy: 6,
    stress: 4,
    tags: ["calm", "grateful"],
    journal: null,
    gratitude: "Dinner with my sister.",
  },
  {
    mood: 4,
    energy: 3,
    stress: 8,
    tags: ["anxious", "drained"],
    journal:
      "Deadline week. Didn't sleep well. Box breathing before email helped more than I expected.",
    gratitude: null,
  },
  {
    mood: 8,
    energy: 8,
    stress: 2,
    tags: ["energised", "connected"],
    journal: "Best run in weeks.",
    gratitude: "The community call — hearing other people say the same thing.",
  },
].map((e, i) => ({
  id: `cmood${i}`,
  userId: USER_ID,
  createdAt: iso(-(i + 1), 21),
  ...e,
}));

// ─── Recommendations ──────────────────────────────────────────────────────────

const RECS: Omit<
  RemoteRecommendation,
  "id" | "createdAt" | "acted" | "dismissed"
>[] = [
  {
    content:
      "Take your 2:30 gap for a 20-minute walk — leave the phone on your desk.",
    category: "physical",
    context:
      "Your calendar has a 45-minute opening at 2:30, and your HRV is up 9% on last week — a good day to move.",
  },
  {
    content:
      "Start tonight's 10 pages by 10:15, on the sofa rather than in bed.",
    category: "mental",
    context:
      "Your sleep score averaged 84 on nights you were reading before 10:30, and 71 on the nights you weren't.",
  },
  {
    content: "Send one message to someone you haven't spoken to this week.",
    category: "emotional",
    context:
      "You tagged a check-in 'connected' on the two days you'd talked to a friend — and on no others.",
  },
];
let recIndex = 0;
let currentRec: RemoteRecommendation | null = null;

function makeRec(): RemoteRecommendation {
  const base = RECS[recIndex % RECS.length]!;
  const alt = RECS[(recIndex + 1) % RECS.length]!;
  return {
    id: uid("rec"),
    createdAt: new Date().toISOString(),
    acted: false,
    dismissed: false,
    ...base,
    alternative: alt.content,
    alternativeCategory: alt.category,
    alternativeContext: alt.context,
    chosenAt: null,
  };
}

const LEARNED = [
  "You act on suggestions that fit a gap already in your calendar.",
  "Evening suggestions get dismissed about twice as often as morning ones.",
  "Anything framed around sleep lands — you've acted on 4 of 5.",
];

const recHistory: RemoteRecommendation[] = [
  [
    "Do the stretch before your first meeting, not with the kettle.",
    "physical",
    true,
    false,
  ],
  ["Put the book on your pillow when you make the bed.", "mental", true, false],
  ["Try a 5-minute body scan after the 4pm call.", "emotional", false, true],
  ["Walk the long way to the station tonight.", "physical", true, false],
  [
    "Write tomorrow's first task down before you close the laptop.",
    "mental",
    true,
    false,
  ],
  ["Call your sister back on the walk home.", "emotional", true, false],
  ["Swap the late coffee for sparkling water.", "physical", false, true],
].map(([content, category, acted, dismissed], i) => ({
  id: `crechist${i}`,
  content: content as string,
  category: category as string,
  context: null,
  acted: acted as boolean,
  dismissed: dismissed as boolean,
  createdAt: iso(-(i + 1), 8),
}));

// ─── Integrations & metrics ───────────────────────────────────────────────────

const connected = new Map<IntegrationProvider, string>([
  ["strava", iso(0, 7)],
  ["oura", iso(0, 7)],
  ["google_calendar", iso(0, 8)],
]);

function series(
  provider: IntegrationProvider,
  metricType: string,
  unit: string | null,
  base: number,
  swing: number,
  seed: number,
  drift = 0,
  every = 1,
): RemoteWearableMetric[] {
  const out: RemoteWearableMetric[] = [];
  for (let i = 0; i < 30; i++) {
    if (i % every !== 0) continue;
    out.push({
      id: `cmet${metricType}${i}`,
      provider,
      metricType,
      date: dateOf(-(29 - i)),
      value: Math.round(base + drift * (i / 29) + wobble(i, seed) * swing),
      unit,
    });
  }
  return out;
}

function metrics(): RemoteWearableMetric[] {
  const all = [
    ...series("oura", "sleep_score", null, 74, 9, 1, 8),
    ...series("oura", "sleep_duration", "min", 410, 45, 2, 20),
    ...series("oura", "hrv", "ms", 48, 7, 3, 6),
    ...series("oura", "resting_heart_rate", "bpm", 61, 3, 4, -3),
    ...series("strava", "workout", "min", 38, 18, 5, 6, 2),
    ...series("strava", "active_calories", "kcal", 420, 140, 6, 40, 2),
    ...series("google_calendar", "calendar_busy_minutes", "min", 330, 110, 7),
    ...series(
      "google_calendar",
      "calendar_longest_free_minutes",
      "min",
      70,
      35,
      8,
    ),
  ];
  return all.filter((m) => connected.has(m.provider));
}

// ─── Therapist ────────────────────────────────────────────────────────────────

let consent: {
  active: boolean;
  categories: TherapistCategories;
  updatedAt: string | null;
} = {
  active: true,
  categories: {
    habits: true,
    moodTrends: true,
    journalExcerpts: false,
    patterns: true,
    score: true,
  },
  updatedAt: iso(-12),
};

function report(id: string, endOffset: number, days: number): TherapistReport {
  return {
    id,
    periodStart: iso(endOffset - days),
    periodEnd: iso(endOffset),
    createdAt: iso(endOffset, 18),
    summary: {
      periodStart: iso(endOffset - days),
      periodEnd: iso(endOffset),
      categories: consent.categories,
      habits: {
        total: habits.length,
        completionRate: 0.78,
        longestActiveStreak: 31,
      },
      moodTrends: {
        entries: 26,
        averageMood: 6.8,
        averageEnergy: 6.1,
        averageStress: 4.6,
        commonTags: ["focused", "anxious", "grateful"],
      },
      journalExcerpts: consent.categories.journalExcerpts
        ? pastEntries
            .filter((e) => e.journal)
            .map((e) => ({
              date: e.createdAt,
              journal: e.journal ?? undefined,
            }))
        : undefined,
      patterns: [
        "Stress runs highest on days with more than six hours booked.",
        "Mood is about a point higher after a night with a sleep score above 80.",
      ],
      score: { average: 68, trend: "up" },
    },
  };
}

const reports: TherapistReport[] = [
  report("creport0002", -2, 30),
  report("creport0001", -32, 30),
];

// ─── Community ────────────────────────────────────────────────────────────────

const COMMUNITIES = {
  run: {
    id: "ccommrun00001",
    slug: "sunday-run-club",
    name: "Sunday Run Club",
    description:
      "Friends who started running together and kept going. The run is the excuse; the conversation after is the point.",
    members: 14,
  },
  pages: {
    id: "ccommpages001",
    slug: "morning-pages",
    name: "Morning Pages",
    description: "A writing circle that grew out of a shared notebook habit.",
    members: 9,
  },
  parents: {
    id: "ccommparent01",
    slug: "new-parents",
    name: "New Parents",
    description:
      "People a year or two into parenthood, figuring out where their own health fits.",
    members: 11,
  },
} as const;

type CommunityKey = keyof typeof COMMUNITIES;
const ref = (k: CommunityKey) => ({
  id: COMMUNITIES[k].id,
  name: COMMUNITIES[k].name,
  slug: COMMUNITIES[k].slug,
});

function weekKey(offsetWeeks: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetWeeks * 7);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const TOPIC_ID = "ctopicrun0001";
const TOPIC_TEXT = "What's something you've stopped apologising for?";

let activeChoice: string | null = COMMUNITIES.run.id;
const suggestions: Record<string, { text: string; createdAt: string }[]> = {};

let demoGoal: CommunityGoalView | null = {
  id: "cgoaldemo0001",
  title: "Four weeks together",
  targetWeeks: 4,
  progressWeeks: 2,
  rewardLabel: "Free class at a partner studio",
  achievedAt: null,
  createdAt: iso(-14),
};

let ADMISSION_SEATS: AdmissionSeatView[] = [
  {
    joinRequestId: "cjreqdemo0001",
    community: ref("parents"),
    applicant: { displayName: "Priya" },
    note: "A friend of Hannah's — we met through the same parenting group.",
    respondBy: iso(2, 20),
  },
];

let myResponse: MyResponseView | null = null;

const ballot: BallotView = {
  id: "cballotpages1",
  kind: "topic",
  status: "open",
  opensAt: iso(-2),
  closesAt: iso(2, 20),
  myVote: null,
  decidedOptionId: null,
  options: [
    {
      id: "coptpages0001",
      text: "When did you last change your mind about something important?",
      rationale: "Several of you wrote about outgrowing old certainties.",
    },
    {
      id: "coptpages0002",
      text: "What does rest actually look like for you?",
      rationale: "Rest came up more than any other word this week.",
    },
    {
      id: "coptpages0003",
      text: "Who taught you how to be kind to yourself?",
      rationale:
        "A thread of thoughts about the people who shaped your habits.",
    },
    {
      id: "coptpages0004",
      text: "What would you do with a free Saturday and no guilt?",
      rationale: "Guilt about downtime was a recurring theme.",
    },
  ],
};

function cycle(
  k: CommunityKey,
  stage: CycleView["stage"],
  extra: Partial<CycleView> = {},
  weekOffset = 0,
): CycleView {
  return {
    id: `ccycle${k}${weekOffset}`,
    weekKey: weekKey(weekOffset),
    stage,
    gatheringOpensAt: iso(weekOffset * 7 - 6),
    votingOpensAt: iso(weekOffset * 7 - 3),
    opensAt: iso(weekOffset * 7 - 1),
    closesAt: iso(weekOffset * 7 + 4, 20),
    community: ref(k),
    topic: null,
    ballotId: null,
    you: { suggestions: 0, voted: false, response: "none" },
    ...extra,
  };
}

function myWeek(): MyWeekView {
  const nextKey = weekKey(1);
  return {
    now: new Date().toISOString(),
    timeZone: "Europe/London",
    current: {
      weekKey: weekKey(0),
      // Kept unlocked in the demo so the presenter can walk every stage.
      choice: { communityId: activeChoice, locked: false },
      cycles: [
        cycle("run", "open", {
          topic: { id: TOPIC_ID, text: TOPIC_TEXT },
          you: {
            suggestions: 1,
            voted: true,
            response: myResponse ? "submitted" : "none",
          },
        }),
        cycle("pages", "voting", {
          ballotId: ballot.id,
          you: { suggestions: 1, voted: !!ballot.myVote, response: "none" },
        }),
        cycle("parents", "gathering", {
          you: {
            suggestions: suggestions[`ccycleparents0`]?.length ?? 0,
            voted: false,
            response: "none",
          },
        }),
      ],
    },
    next: {
      weekKey: nextKey,
      choice: { communityId: COMMUNITIES.run.id, locked: false },
      cycles: [
        cycle("run", "scheduled", {}, 1),
        cycle("pages", "scheduled", {}, 1),
      ],
    },
  };
}

function topicView(): TopicView {
  return {
    id: TOPIC_ID,
    text: TOPIC_TEXT,
    community: ref("run"),
    cycle: {
      id: "ccyclerun0",
      weekKey: weekKey(0),
      stage: "open",
      opensAt: iso(-1),
      closesAt: iso(4, 20),
    },
    you: {
      chosen: activeChoice === COMMUNITIES.run.id,
      choseElsewhere:
        activeChoice !== null && activeChoice !== COMMUNITIES.run.id,
      response: myResponse,
      room: myResponse ? "open" : "locked",
    },
  };
}

const VOICES: {
  id: string;
  name: string;
  kind: "video" | "audio";
  sec: number;
  comments: number;
}[] = [
  { id: "cresp00000001", name: "Priya", kind: "video", sec: 412, comments: 3 },
  { id: "cresp00000002", name: "Marcus", kind: "audio", sec: 623, comments: 5 },
  { id: "cresp00000003", name: "Ade", kind: "video", sec: 298, comments: 1 },
  { id: "cresp00000004", name: "Hannah", kind: "audio", sec: 540, comments: 2 },
  { id: "cresp00000005", name: "Tom", kind: "video", sec: 187, comments: 0 },
  { id: "cresp00000006", name: "Leila", kind: "audio", sec: 731, comments: 4 },
];
const reactions: Record<string, "agree" | "mixed" | "disagree"> = {};

const commentThreads: Record<string, CommentView[]> = {};
function comments(responseId: string): CommentView[] {
  if (!commentThreads[responseId]) {
    const seed: [string, string, number][] = [
      [
        "Marcus",
        "The bit about taking up space at work really landed. Same here.",
        4,
      ],
      ["Hannah", "I needed to hear this today, honestly.", 6],
      [
        "Ade",
        "Curious whether it got easier after the first time you said no?",
        2,
      ],
    ];
    const count = VOICES.find((v) => v.id === responseId)?.comments ?? 2;
    commentThreads[responseId] = seed
      .slice(0, Math.min(count, 3))
      .map(([name, body, likes], i) => ({
        id: `ccomm${responseId}${i}`,
        parentId: null,
        author: { displayName: name },
        isMine: false,
        body,
        deleted: false,
        createdAt: iso(0, 8 + i),
        likeCount: likes,
        likedByMe: false,
      }));
  }
  return commentThreads[responseId]!;
}

function roomView(): RoomView {
  return {
    topic: { id: TOPIC_ID, text: TOPIC_TEXT },
    community: ref("run"),
    cycle: { weekKey: weekKey(0), stage: "open", closesAt: iso(4, 20) },
    circle: { voices: VOICES.length + 1 },
    mine: myResponse!,
    responses: VOICES.map((v, i) => ({
      id: v.id,
      speaker: { displayName: v.name },
      kind: v.kind,
      durationSec: v.sec,
      createdAt: iso(-1, 9 + i),
      myReaction: reactions[v.id] ?? null,
      commentCount: comments(v.id).length,
    })),
  };
}

function result(
  weeksAgo: number,
  text: string,
  topicKey: string,
  agree: number,
  mixed: number,
  voices: number,
): CycleResultView {
  return {
    weekKey: weekKey(-weeksAgo),
    closedAt: iso(-weeksAgo * 7 + 4, 20),
    topic: { text, topicKey },
    headline: "Here's where the room landed this week.",
    agreePct: agree,
    mixedPct: mixed,
    disagreePct: 100 - agree - mixed,
    voices,
    reactions: voices * 6,
    comments: voices * 2 + 3,
  };
}

const HISTORY: Record<string, CycleResultView[]> = {
  [COMMUNITIES.run.id]: [
    result(
      1,
      "Is rest something you earn, or something you're owed?",
      "rest-earned",
      38,
      41,
      11,
    ),
    result(
      2,
      "What does 'showing up' mean when you're injured?",
      "showing-up-injured",
      62,
      27,
      12,
    ),
    result(
      3,
      "Should we race this year, or just run?",
      "race-or-run",
      45,
      30,
      13,
    ),
    result(
      8,
      "Is rest something you earn, or something you're owed?",
      "rest-earned",
      71,
      20,
      9,
    ),
  ],
  [COMMUNITIES.pages.id]: [
    result(
      1,
      "Does writing it down make it more real?",
      "writing-real",
      80,
      15,
      8,
    ),
    result(
      2,
      "What's a belief you inherited and kept on purpose?",
      "inherited-belief",
      55,
      35,
      7,
    ),
  ],
  [COMMUNITIES.parents.id]: [
    result(
      1,
      "Is it selfish to protect an hour for yourself?",
      "selfish-hour",
      22,
      30,
      10,
    ),
  ],
};

function history(id: string): CommunityHistoryView {
  const k =
    (Object.keys(COMMUNITIES) as CommunityKey[]).find(
      (c) => COMMUNITIES[c].id === id,
    ) ?? "run";
  const results = HISTORY[id] ?? [];
  const byKey = new Map<string, CycleResultView[]>();
  results.forEach((r) =>
    byKey.set(r.topic.topicKey, [...(byKey.get(r.topic.topicKey) ?? []), r]),
  );
  return {
    community: ref(k),
    results,
    recurring: [...byKey.entries()]
      .filter(([, rs]) => rs.length > 1)
      .map(([topicKey, rs]) => ({
        topicKey,
        text: rs[0]!.topic.text,
        results: [...rs].sort((a, b) => a.closedAt.localeCompare(b.closedAt)),
      })),
  };
}

function detail(id: string): CommunityDetail {
  const k =
    (Object.keys(COMMUNITIES) as CommunityKey[]).find(
      (c) => COMMUNITIES[c].id === id,
    ) ?? "run";
  const c = COMMUNITIES[k];
  return {
    community: {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      status: "active",
      memberCount: c.members,
      foundersNeeded: null,
      createdAt: iso(-120),
      activatedAt: iso(-110),
    },
    membership: {
      role: k === "run" ? "steward" : "member",
      joinedAt: iso(-110),
    },
    joinRequest: null,
  };
}

function chest(id: string): ChestView {
  const k =
    (Object.keys(COMMUNITIES) as CommunityKey[]).find(
      (c) => COMMUNITIES[c].id === id,
    ) ?? "run";
  const proposals: ChestView["proposals"] =
    k === "run"
      ? [
          {
            id: "cprop0000001",
            title: "Entry fees for the autumn 10K",
            description: null,
            status: "on_ballot",
            isMine: false,
            createdAt: iso(-5),
          },
          {
            id: "cprop0000002",
            title: "First-aid course for two members",
            description: null,
            status: "proposed",
            isMine: true,
            createdAt: iso(-3),
          },
          {
            id: "cprop0000003",
            title: "Head torches for winter runs",
            description: null,
            status: "chosen",
            isMine: false,
            createdAt: iso(-40),
          },
        ]
      : [];
  return {
    community: ref(k),
    balanceCents: k === "run" ? 18450 : k === "pages" ? 6200 : 3100,
    currency: "USD",
    entries: [],
    proposals,
    openBallotId: null,
  };
}

// ─── The API ──────────────────────────────────────────────────────────────────

/** Away mode and shares, in memory for the demo session. */
let away: RemoteAway | null = null;
let awayStatus: Record<string, string> = {};
const demoShares = new Map<string, Set<string>>();
function demoWeek(habitId: string): WeekDot[] {
  const start = weekStartKey(localDateKey());
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    if (d > localDateKey()) return "future";
    const l = logs.find((x) => x.habitId === habitId && x.date.slice(0, 10) === d);
    return !l ? "none" : l.state === "rest" ? "rest" : !l.completed ? "none" : l.state === "minimum" ? "minimum" : "done";
  });
}

/** Empty until the demo viewer fills in "About you". */
let background: UserBackground | null = null;

const profile = () => {
  const s = getDemoSession();
  return {
    id: "cprofile00001",
    userId: USER_ID,
    displayName: s.name,
    avatarId: s.avatarId,
    age: 29,
    fitnessLevel: "intermediate",
    primaryGoals: ["Build consistency"],
    weeklyAvailability: 4,
    equipment: ["Running shoes", "Resistance bands"],
    preferences: {
      notificationsEnabled: true,
      dailyCheckInTime: "21:00",
      aiPersonalityDial: "balanced" as const,
      coachingIntensity: "balanced" as const,
      scorePeriod: "weekly" as const,
      currentlyWorkingOut: true,
    },
    background,
    onboardingComplete: s.onboarded,
  };
};

function applyCheckIn(input: CheckInInput): RemoteMoodEntry {
  todayEntry = {
    id: todayEntry?.id ?? uid("mood"),
    userId: USER_ID,
    createdAt: todayEntry?.createdAt ?? new Date().toISOString(),
    mood: input.mood,
    energy:
      input.energy === undefined ? (todayEntry?.energy ?? null) : input.energy,
    stress:
      input.stress === undefined ? (todayEntry?.stress ?? null) : input.stress,
    tags: input.tags === undefined ? (todayEntry?.tags ?? null) : input.tags,
    gratitude:
      input.gratitude === undefined
        ? (todayEntry?.gratitude ?? null)
        : input.gratitude,
    journal:
      input.journal === undefined
        ? (todayEntry?.journal ?? null)
        : input.journal,
  };
  return todayEntry;
}

function newHabit(input: CreateHabitInput): RemoteHabit {
  const h: RemoteHabit = {
    id: uid("habit"),
    userId: USER_ID,
    name: input.name,
    category: input.category,
    cue: input.cue ?? null,
    craving: input.craving ?? null,
    response: input.response ?? null,
    reward: input.reward ?? null,
    frequency: input.frequency,
    targetDays: input.targetDays ?? null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  HABIT_SHAPE[h.id] = { streak: 0, today: false, rate: 0 };
  habits = [h, ...habits];
  return h;
}

const DRAFTS = [
  {
    name: "Lay out running kit the night before",
    category: "physical" as const,
    cue: "After I set my alarm",
    response: "Shoes by the door, kit on the chair",
    reward: "One less decision at 6am",
    frequency: "custom" as const,
    targetDays: [0, 2, 4],
    rationale:
      "You logged a workout on 9 of the 12 mornings your calendar started after 9:30.",
  },
  {
    name: "Phone in the kitchen at 10:30",
    category: "mental" as const,
    cue: "When the dishwasher goes on",
    response: "Charge it downstairs",
    reward: "The book gets the last half hour",
    frequency: "daily" as const,
    rationale:
      "Your sleep score is 11 points higher on nights your reading streak held.",
  },
  {
    name: "Two-line check-in with a friend",
    category: "emotional" as const,
    cue: "On the walk after lunch",
    response: "Send one voice note",
    reward: "Coffee tastes better with a reply",
    frequency: "weekly" as const,
    rationale:
      "'Connected' shows up in your check-ins on the days you'd talked to someone.",
  },
];

export const demoApi: Api = {
  // Profile
  getMyProfile: async () => {
    await wait(250);
    const s = getDemoSession();
    return { id: USER_ID, clerkId: "demo", email: s.email, profile: profile() };
  },
  completeOnboarding: async (input) => {
    await wait(700);
    updateDemoSession({ onboarded: true, name: input.displayName });
    return profile();
  },
  updateProfile: async (input) => {
    await wait();
    if (input.displayName) updateDemoSession({ name: input.displayName });
    if ("avatarId" in input)
      updateDemoSession({ avatarId: input.avatarId ?? null });
    if ("background" in input) background = input.background ?? null;
    return profile();
  },
  getDataSummary: async () => {
    await wait();
    return {
      counts: {
        habits: habits.length,
        habitLogs: logs.length,
        checkIns: 31,
        reflections: 22,
        conversations: 14,
        messages: 186,
        memoryFacts: 27,
        wearableMetrics: metrics().length,
        recommendations: 33,
        scores: 38,
      },
      connected: [...connected.keys()],
      therapistSharing: consent.active
        ? Object.entries(consent.categories)
            .filter(([, v]) => v)
            .map(([k]) => k)
        : [],
      since: iso(-38),
    };
  },
  deleteAccount: async () => {
    await wait();
    return { deleted: true };
  },

  // Habits
  listHabits: async () => {
    await wait(200);
    return habits.filter((h) => h.isActive);
  },
  createHabit: async (input) => {
    await wait();
    return newHabit(input);
  },
  updateHabit: async (id, input) => {
    await wait();
    habits = habits.map((h) =>
      h.id === id
        ? {
            ...h,
            ...Object.fromEntries(
              Object.entries(input).filter(([, v]) => v !== undefined),
            ),
          }
        : h,
    );
    return habits.find((h) => h.id === id)!;
  },
  archiveHabit: async (id) => {
    await wait();
    habits = habits.map((h) => (h.id === id ? { ...h, isActive: false } : h));
    return { archived: true };
  },
  // The demo guide never acts, so there is never anything to undo.
  undoChatAction: async () => ({ undone: true }),
  getVoice: async () => ({ premium: false, provider: null }),
  getAway: async () => {
    await wait(100);
    return away;
  },
  startAway: async (input) => {
    await wait();
    const paused = habits.filter((h) => h.isActive && h.status !== "paused" && (!input.habitIds || input.habitIds.includes(h.id)));
    awayStatus = Object.fromEntries(paused.map((h) => [h.id, h.status ?? "building"]));
    habits = habits.map((h) => (awayStatus[h.id] ? { ...h, status: "paused" as const } : h));
    away = {
      id: uid("away"),
      reason: input.reason,
      startsOn: localDateKey(),
      endsOn: input.until ?? null,
      habits: paused.map((h) => ({ id: h.id, name: h.name })),
    };
    return away;
  },
  endAway: async () => {
    await wait();
    const restarted = habits
      .filter((h) => awayStatus[h.id])
      .map((h) => ({ id: h.id, name: h.name, cue: h.cue, plan: h.cue ? `${h.cue}, ${h.response ?? h.name}` : h.name }));
    habits = habits.map((h) => (awayStatus[h.id] ? { ...h, status: awayStatus[h.id] as "building" | "established" } : h));
    away = null;
    awayStatus = {};
    return { restarted };
  },
  getHabitShares: async (habitId) => [...(demoShares.get(habitId) ?? [])],
  shareHabit: async (habitId, communityId) => {
    demoShares.set(habitId, new Set([...(demoShares.get(habitId) ?? []), communityId]));
    return { shared: true };
  },
  unshareHabit: async (habitId, communityId) => {
    demoShares.get(habitId)?.delete(communityId);
    return { shared: false };
  },
  getSharedHabits: async (communityId) => {
    await wait(150);
    const mine = habits
      .filter((h) => demoShares.get(h.id)?.has(communityId))
      .map((h) => ({
        habitId: h.id,
        mine: true,
        member: getDemoSession().name,
        habit: h.name,
        plan: h.cue ? `${h.cue}, ${h.response ?? ""}`.replace(/, $/, "") : h.name,
        paused: h.status === "paused",
        week: demoWeek(h.id),
      }));
    // Example members, clearly generic, like the rest of the demo.
    const others = [
      { habitId: "demo-o1", mine: false, member: "A member", habit: "Morning walk", plan: "After I drop the kids off, walk the long way back", paused: false, week: ["done", "done", "minimum", "none", "done", "future", "future"] as WeekDot[] },
      { habitId: "demo-o2", mine: false, member: "Another member", habit: "Read", plan: "After dinner, read 10 pages", paused: false, week: ["done", "none", "done", "done", "rest", "future", "future"] as WeekDot[] },
    ];
    return { weekStart: localDateKey(), rows: [...mine, ...others] };
  },
  restoreHabit: async (id) => {
    await wait();
    habits = habits.map((h) => (h.id === id ? { ...h, isActive: true } : h));
    return habits.find((h) => h.id === id)!;
  },
  logHabit: async (input) => {
    await wait(150);
    const log: RemoteHabitLog = {
      id: uid("log"),
      habitId: input.habitId,
      userId: USER_ID,
      date: input.date,
      completed: input.state === "rest" ? false : input.completed,
      state: input.state ?? "done",
      notes: input.notes ?? null,
    };
    logs = [
      log,
      ...logs.filter(
        (l) => !(l.habitId === input.habitId && l.date === input.date),
      ),
    ];
    return { log, score: computeScore() };
  },
  reflectOnMiss: async (habitId, input) => {
    await wait(input.skipped ? 100 : 900);
    const reflection = {
      id: uid("ref"),
      habitId,
      date: input.missedOn,
      answer: input.answer ?? "",
      createdAt: new Date().toISOString(),
    };
    demoReflections = [reflection, ...demoReflections];
    if (input.skipped) return { reflection, skipped: true };
    return {
      reflection,
      reply:
        "Sounds like the morning gets away from you. Want to try a smaller version?",
      change: { type: "shrink" as const, response: "1 minute" },
      backupPlan: "If the morning gets away from me, I'll do it before lunch.",
      concern: false,
    };
  },
  applyReflection: async () => {
    await wait();
    return habits[0]!;
  },
  listReflections: async () => {
    await wait();
    return demoReflections;
  },
  precommit: async (habitId, input) => {
    await wait();
    const row = { id: uid("pc"), habitId, ...input };
    demoPromises = [
      row,
      ...demoPromises.filter(
        (p) => !(p.habitId === habitId && p.forDate === input.forDate),
      ),
    ];
    return row;
  },
  submitAutomaticity: async (habitId, items) => {
    await wait();
    const score =
      Math.round((items.reduce((a, b) => a + b, 0) / items.length) * 10) / 10;
    const row = { id: uid("chk"), habitId, date: todayStr(), score };
    demoChecks = [
      ...demoChecks.filter(
        (c) => !(c.habitId === habitId && c.date === row.date),
      ),
      row,
    ];
    return row;
  },
  listAutomaticity: async () => {
    await wait();
    return demoChecks;
  },
  listPrecommitments: async () => {
    await wait();
    return demoPromises;
  },
  listHabitLogs: async () => {
    await wait(200);
    return logs.map((l) => {
      const h = habits.find((x) => x.id === l.habitId);
      return {
        ...l,
        habit: { name: h?.name ?? "", category: h?.category ?? "physical" },
      };
    });
  },
  suggestHabits: async (input) => {
    await wait(1400);
    return {
      drafts: DRAFTS.slice(0, input?.count ?? 3),
      basis: [
        "Sleep score · Oura",
        "Workouts · Strava",
        "Calendar shape",
        "Last 14 check-ins",
      ],
    };
  },
  discoverHabits: async (turns) => {
    await wait(1300);
    const userTurns = turns.filter((t) => t.role === "user").length;
    if (userTurns <= 1) {
      return {
        reply:
          "That makes sense. When does it usually fall apart — is it the start of the day, or the evenings when you're already tired?",
        drafts: [],
        complete: false,
        basis: ["Last 14 check-ins"],
      };
    }
    return {
      reply:
        "Evenings, then. Rather than adding willpower at the worst time of day, here are two habits that hang off things you already do at night.",
      drafts: DRAFTS.slice(1, 3),
      complete: true,
      basis: ["Last 14 check-ins", "Sleep score · Oura"],
    };
  },

  // Mood & check-in
  createMoodEntry: async (input) => {
    await wait();
    return applyCheckIn(input);
  },
  listMoodEntries: async (limit = 30) => {
    await wait();
    return [...(todayEntry ? [todayEntry] : []), ...pastEntries].slice(
      0,
      limit,
    );
  },
  logWorkout: async (input) => {
    await wait(150);
    workoutToday = true;
    const workout = {
      id: uid("wk"),
      userId: USER_ID,
      name: input.name,
      type: input.type,
      duration: input.duration ?? null,
      difficulty: input.difficulty ?? null,
      createdAt: new Date().toISOString(),
    };
    return { workout, score: computeScore() };
  },
  listWorkouts: async () => {
    await wait();
    return [];
  },
  getLatestMood: async () => {
    await wait();
    return todayEntry ?? pastEntries[0] ?? null;
  },
  getTodayCheckIn: async () => {
    await wait(200);
    return {
      entry: todayEntry,
      reflectionDone: !!(todayEntry?.journal || todayEntry?.gratitude),
    };
  },
  submitCheckIn: async (input) => {
    await wait(500);
    const entry = applyCheckIn(input);
    return { entry, score: computeScore() };
  },
  getCheckInPrompt: async () => {
    await wait(900);
    return {
      prompt:
        "The lunchtime walk has held for 12 days. What's making this one stick when others haven't?",
      observation:
        "Your stress rating has come down on each of the last three days you walked.",
      basis: ["Habit streaks", "Last 7 check-ins"],
    };
  },

  // Recommendations
  getTodayRecommendation: async () => {
    await wait();
    return currentRec;
  },
  requestRecommendation: async (options) => {
    await wait(currentRec && !options?.refresh ? 200 : 1200);
    if (options?.refresh && currentRec) {
      recHistory.unshift({ ...currentRec, dismissed: true });
      recIndex++;
      currentRec = null;
    }
    currentRec ??= makeRec();
    return {
      recommendation: currentRec,
      basis: ["HRV · Oura", "Calendar gaps", "Last 7 check-ins"],
      learned: LEARNED,
    };
  },
  chooseRecommendation: async (id, option) => {
    await wait(150);
    if (currentRec?.id === id && !currentRec.chosenAt) {
      currentRec =
        option === "alternative" && currentRec.alternative
          ? {
              ...currentRec,
              content: currentRec.alternative,
              category: currentRec.alternativeCategory ?? currentRec.category,
              context: currentRec.alternativeContext ?? null,
              alternative: currentRec.content,
              alternativeCategory: currentRec.category,
              alternativeContext: currentRec.context,
              chosenAt: new Date().toISOString(),
            }
          : { ...currentRec, chosenAt: new Date().toISOString() };
    }
    return currentRec!;
  },
  sendRecommendationFeedback: async (id, outcome) => {
    await wait();
    if (currentRec?.id === id) {
      currentRec = {
        ...currentRec,
        acted: outcome === "acted",
        dismissed: outcome === "dismissed",
      };
    }
    return {
      id,
      acted: outcome === "acted",
      dismissed: outcome === "dismissed",
    };
  },
  listRecommendations: async (limit = 30) => {
    await wait();
    return {
      recommendations: [
        ...(currentRec ? [currentRec] : []),
        ...recHistory,
      ].slice(0, limit),
      preferences: {
        lines: LEARNED,
        answered: 14,
        acted: 10,
        provisional: false,
      },
    };
  },

  // Score
  getTodayScore: async () => {
    await wait(150);
    return computeScore();
  },
  getScoreHistory: async (days = 30) => {
    await wait();
    return scoreHistory(days);
  },
  getNearbyGroups: async (
    params: {
      city?: string;
      category?: string;
      lat?: number;
      lng?: number;
    } = {},
  ): Promise<RemoteNearbyGroup[]> => {
    await wait(200);
    const city = params.city ?? "Dallas";
    const withDistance = DALLAS_GROUPS.filter((g) => g.city === city)
      .filter((g) => !params.category || g.category === params.category)
      .map((g) => ({
        ...g,
        distanceKm:
          params.lat !== undefined && params.lng !== undefined
            ? Math.round(
                haversineKm(params.lat, params.lng, g.lat, g.lng) * 10,
              ) / 10
            : null,
      }));
    withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return withDistance;
  },
  getPeriodScore: async (): Promise<RemotePeriodScore> => {
    await wait(150);
    const week = scoreHistory(7);
    const start = new Date();
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return {
      period: "weekly",
      periodStart: localDateKey(start),
      average: Math.round(
        week.reduce((sum, s) => sum + s.overallScore, 0) / week.length,
      ),
      daysLogged: week.length,
    };
  },

  // Integrations
  listIntegrations: async () => {
    await wait(250);
    return {
      integrations: [...connected.entries()].map(([provider, at]) => ({
        id: `cint${provider}`,
        provider,
        status: "connected" as const,
        lastSyncedAt: at,
        lastError: null,
        createdAt: iso(-30),
      })),
      available: {
        strava: true,
        whoop: true,
        oura: true,
        spotify: true,
        google_calendar: true,
        outlook_calendar: true,
      },
    };
  },
  // No OAuth round trip in the demo: connecting simply succeeds.
  startConnect: async (provider) => {
    await wait(900);
    connected.set(provider, new Date().toISOString());
    return { authorizeUrl: "" };
  },
  disconnectIntegration: async (provider) => {
    await wait();
    connected.delete(provider);
    return { disconnected: true };
  },
  syncIntegration: async (provider) => {
    await wait(1100);
    connected.set(provider, new Date().toISOString());
    return { synced: 30 };
  },
  listMetrics: async (filter) => {
    await wait(300);
    return metrics().filter(
      (m) => !filter?.type || m.metricType === filter.type,
    );
  },
  listPatterns: async () => {
    await wait(400);
    return [
      {
        metricType: "sleep_score",
        summary:
          "On nights you slept 80+, your next-day mood averaged 7.8 — versus 5.9 otherwise.",
        r: 0.62,
        n: 28,
      },
      {
        metricType: "hrv",
        summary:
          "Your HRV runs about 11% higher the morning after a day with box breathing.",
        r: 0.41,
        n: 24,
      },
      {
        metricType: "calendar_busy_minutes",
        summary:
          "Days with more than six hours booked are the days the stretch gets skipped.",
        r: -0.48,
        n: 30,
      },
    ];
  },

  // Therapist
  getTherapistConsent: async () => {
    await wait();
    return consent;
  },
  updateTherapistConsent: async (categories) => {
    await wait();
    consent = { active: true, categories, updatedAt: new Date().toISOString() };
    return { active: true, categories };
  },
  revokeTherapistConsent: async () => {
    await wait();
    consent = {
      ...consent,
      active: false,
      updatedAt: new Date().toISOString(),
    };
    return { active: false, categories: consent.categories };
  },
  generateTherapistReport: async (days = 30) => {
    await wait(1600);
    const r = report(uid("report"), 0, days);
    reports.unshift(r);
    return r;
  },
  listTherapistReports: async () => {
    await wait();
    return reports.map(({ id, periodStart, periodEnd, createdAt }) => ({
      id,
      periodStart,
      periodEnd,
      createdAt,
    }));
  },
  getTherapistReport: async (id) => {
    await wait();
    return reports.find((r) => r.id === id) ?? reports[0]!;
  },

  // Community
  getMyWeek: async () => {
    await wait(450);
    return myWeek();
  },
  chooseActiveCommunity: async (_weekKey, communityId) => {
    await wait();
    activeChoice = communityId;
    return { communityId, locked: false };
  },
  listMyCommunities: async () => {
    await wait();
    return Object.values(COMMUNITIES).map((c) => detail(c.id));
  },
  getCommunity: async (id) => {
    await wait();
    return detail(id);
  },
  getCommunityHistory: async (id) => {
    await wait(400);
    return history(id);
  },
  getChest: async (id) => {
    await wait();
    return chest(id);
  },
  getCommunityGoal: async () => {
    await wait(250);
    return demoGoal;
  },
  setCommunityGoal: async (_id, input) => {
    await wait(500);
    demoGoal = {
      id: "cgoaldemo0001",
      title: input.title,
      targetWeeks: input.targetWeeks,
      progressWeeks: 0,
      rewardLabel: input.rewardLabel,
      achievedAt: null,
      createdAt: new Date().toISOString(),
    };
    return demoGoal;
  },
  listMyAdmissionSeats: async () => {
    await wait(300);
    return ADMISSION_SEATS;
  },
  castAdmissionVote: async (joinRequestId) => {
    await wait(400);
    ADMISSION_SEATS = ADMISSION_SEATS.filter(
      (s) => s.joinRequestId !== joinRequestId,
    );
    return { recorded: true };
  },
  suggestTopic: async (cycleId, text) => {
    await wait(600);
    suggestions[cycleId] = [
      ...(suggestions[cycleId] ?? []),
      { text, createdAt: new Date().toISOString() },
    ];
    return {
      suggestions: suggestions[cycleId]!,
      remaining: Math.max(0, 3 - suggestions[cycleId]!.length),
    };
  },
  getMySuggestions: async (cycleId) => {
    await wait();
    const list = suggestions[cycleId] ?? [];
    return { suggestions: list, remaining: Math.max(0, 3 - list.length) };
  },
  getDiscover: async (): Promise<DiscoverView> => {
    await wait(300);
    const rows: DiscoverRow[] = (
      Object.keys(COMMUNITIES) as CommunityKey[]
    ).map((k) => {
      const topics = HISTORY[COMMUNITIES[k].id] ?? [];
      const topic = topics[0] ?? {
        topic: { text: TOPIC_TEXT, topicKey: "apologising" },
      };
      return {
        topic: topic.topic,
        community: ref(k),
        weekKey: weekKey(-1),
        responses: VOICES.map((v) => ({
          id: `cdisc-${k}-${v.id}`,
          speaker: { displayName: v.name },
          kind: v.kind,
          durationSec: v.sec,
          publishedAt: iso(-7),
        })),
      };
    });
    return { rows };
  },
  getDiscoverResponse: async (
    responseId: string,
  ): Promise<DiscoverResponseView> => {
    await wait(300);
    const voiceId = responseId.split("-").slice(2).join("-");
    const voice = VOICES.find((v) => v.id === voiceId) ?? VOICES[0]!;
    const item = {
      id: responseId,
      speaker: { displayName: voice.name },
      kind: voice.kind,
      durationSec: voice.sec,
      publishedAt: iso(-7),
    };
    return {
      item,
      topic: { text: TOPIC_TEXT, topicKey: "apologising" },
      community: ref("run"),
      playback: {
        kind: voice.kind,
        url: DEMO_MEDIA[voice.kind],
        expiresAt: iso(1),
        durationSec: voice.sec,
      },
      next: VOICES.filter((v) => v.id !== voice.id).map((v) => ({
        id: `cdisc-run-${v.id}`,
        speaker: { displayName: v.name },
        kind: v.kind,
        durationSec: v.sec,
        publishedAt: iso(-7),
      })),
    };
  },
  getBallot: async () => {
    await wait(200);
    return ballot;
  },
  voteOnBallot: async (_ballotId, optionId) => {
    await wait();
    ballot.myVote = optionId;
    return { recorded: true };
  },
  getTopic: async () => {
    await wait(350);
    return topicView();
  },
  getRoom: async () => {
    await wait(350);
    if (!myResponse)
      throw new Error("Share your answer first and the room opens.");
    return roomView();
  },
  getTopicResult: async () => {
    await wait();
    return HISTORY[COMMUNITIES.run.id]![0]!;
  },
  getResponsePlayback: async (responseId) => {
    await wait(300);
    const kind = VOICES.find((v) => v.id === responseId)?.kind ?? "audio";
    return {
      kind,
      url: DEMO_MEDIA[kind],
      expiresAt: iso(1),
      durationSec: VOICES.find((v) => v.id === responseId)?.sec ?? null,
    };
  },
  reactToResponse: async (responseId, verdict) => {
    await wait(150);
    reactions[responseId] = verdict;
    return { recorded: true };
  },
  listComments: async (responseId) => {
    await wait(250);
    return comments(responseId);
  },
  addComment: async (responseId, input) => {
    await wait(400);
    const c: CommentView = {
      id: uid("comment"),
      parentId: input.parentId ?? null,
      author: { displayName: getDemoSession().name },
      isMine: true,
      body: input.body,
      deleted: false,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
    };
    commentThreads[responseId] = [...comments(responseId), c];
    return c;
  },
  likeComment: async (commentId, liked) => {
    await wait(100);
    for (const thread of Object.values(commentThreads)) {
      const c = thread.find((x) => x.id === commentId);
      if (c && c.likedByMe !== liked) {
        c.likedByMe = liked;
        c.likeCount += liked ? 1 : -1;
      }
    }
    return { liked };
  },
  reportResponse: async () => {
    await wait();
    return { recorded: true };
  },
  withdrawResponse: async () => {
    await wait();
    const withdrawn: MyResponseView = {
      ...(myResponse as MyResponseView),
      status: "withdrawn",
      withdrawnAt: new Date().toISOString(),
    };
    myResponse = null;
    return withdrawn;
  },
  getMyStanding: async () => {
    await wait();
    return { restrictedUntil: null, recentStrikes: 0 };
  },
  uploadRecording: async (recording, onProgress) => {
    onProgress?.(0);
    await wait(900);
    onProgress?.(1);
    pendingUpload = recording;
    return uid("media");
  },
  submitResponse: async (topicId, input) => {
    await wait(700);
    myResponse = {
      id: uid("resp"),
      topicId,
      status: "submitted",
      visibility: input.visibility,
      kind: pendingUpload?.kind ?? "audio",
      durationSec: Math.round(pendingUpload?.durationSec ?? 300),
      createdAt: new Date().toISOString(),
      withdrawnAt: null,
    };
    return myResponse;
  },
};

let pendingUpload: { kind: "video" | "audio"; durationSec: number } | null =
  null;
