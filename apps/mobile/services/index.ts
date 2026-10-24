/**
 * Typed calls against the Kinextion data API. Every function takes the
 * caller's Clerk token explicitly (rather than reading it from context) so
 * these stay plain, testable functions — see hooks/useApi.ts for the
 * component-facing wrapper that supplies the token automatically.
 */

import { apiRequest, apiRequestWithMeta } from "./client";
import type { AutoLog, HabitChange, UserBackground } from "@kinextion/shared";
import type {
  OnboardingInput,
  UpdateProfileInput,
  CreateHabitInput,
  UpdateHabitInput,
  LogHabitInput,
  CreateMoodEntryInput,
  CheckInInput,
  HabitDraft,
} from "@kinextion/shared";

export type {
  OnboardingInput,
  UpdateProfileInput,
  CreateHabitInput,
  UpdateHabitInput,
  LogHabitInput,
  CreateMoodEntryInput,
  CheckInInput,
  HabitDraft,
};

/**
 * Where the user is in their own day.
 *
 * Sent with every assisted request because the server runs in UTC: without
 * this, "you've got an hour free after work" would be computed against a
 * datacentre clock. Both values come from the device with no permission
 * prompt — the time zone is a coarse region, not a location.
 */
function deviceTimeContext(): { localHour: number; timeZone?: string } {
  const localHour = new Date().getHours();
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone ? { localHour, timeZone } : { localHour };
  } catch {
    return { localHour };
  }
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface RemoteProfile {
  id: string;
  userId: string;
  displayName: string | null;
  /** Ready Player Me avatar id, or null if none set yet. */
  avatarId: string | null;
  age: number | null;
  fitnessLevel: string | null;
  primaryGoals: string[] | null;
  weeklyAvailability: number | null;
  equipment: string[] | null;
  /** "someone who moves every day" — set at onboarding, editable. */
  identityGoal?: string | null;
  /** Who they are, in their own words — read by the guides. */
  background?: UserBackground | null;
  /** Notification and guide settings — including Kairo's spiritual dial. */
  preferences: {
    notificationsEnabled?: boolean;
    dailyCheckInTime?: string;
    aiPersonalityDial?: "scripture" | "balanced" | "universal";
    coachingIntensity?: "gentle" | "balanced" | "intense";
    scorePeriod?: "weekly" | "monthly" | "yearly";
    habitReminders?: boolean;
    showStreaks?: boolean;
    doesTherapy?: boolean;
    doesJournal?: boolean;
    currentlyWorkingOut?: boolean;
  } | null;
  onboardingComplete: boolean;
}

export interface RemoteUser {
  id: string;
  clerkId: string;
  email: string;
  profile: RemoteProfile | null;
}

export function getMyProfile(token: string | null) {
  return apiRequest<RemoteUser>("/api/users/me/profile", { token });
}

export function completeOnboarding(
  token: string | null,
  input: OnboardingInput,
) {
  return apiRequest<RemoteProfile>("/api/users/me/onboard", {
    method: "POST",
    body: input,
    token,
  });
}

export function updateProfile(token: string | null, input: UpdateProfileInput) {
  return apiRequest<RemoteProfile>("/api/users/me/profile", {
    method: "PATCH",
    body: input,
    token,
  });
}

/** Counts of what's stored on this account — powers the privacy screen. */
export interface DataSummary {
  counts: {
    habits: number;
    habitLogs: number;
    checkIns: number;
    reflections: number;
    conversations: number;
    messages: number;
    memoryFacts: number;
    wearableMetrics: number;
    recommendations: number;
    scores: number;
  };
  connected: string[];
  /** Categories currently shared with a therapist, if any. */
  therapistSharing: string[];
  since: string | null;
}

export function getDataSummary(token: string | null) {
  return apiRequest<DataSummary>("/api/users/me/data-summary", { token });
}

/** Permanently deletes the account and all associated data. Not reversible. */
export function deleteAccount(token: string | null) {
  return apiRequest<{ deleted: boolean }>("/api/users/me", {
    method: "DELETE",
    token,
  });
}

// ─── Habits ─────────────────────────────────────────────────────────────────

export interface RemoteHabit {
  id: string;
  userId: string;
  name: string;
  category: string;
  cue: string | null;
  craving: string | null;
  response: string | null;
  reward: string | null;
  frequency: string;
  targetDays: number[] | null;
  isActive: boolean;
  createdAt: string;
  /** v2 fields. Optional so an API that predates them still type-checks. */
  fullVersion?: string | null;
  backupPlan?: string | null;
  pairWith?: string | null;
  timeWindow?: "morning" | "midday" | "evening" | "anytime";
  perWeekTarget?: number | null;
  status?: "building" | "established" | "paused";
  sortOrder?: number;
  reminderEnabled?: boolean;
  /** "YYYY-MM-DD…" when it starts later than the day it was made. */
  startsOn?: string | null;
  /** How Kinextion reads the free-text fields, tidied for display. */
  polished?: unknown;
  /** Measured habits: unit, usual amount, tiny amount. */
  measureUnit?: string | null;
  measureTarget?: number | null;
  measureTiny?: number | null;
  /** Logged by a connected service. */
  autoLog?: AutoLog | null;
}

export function listHabits(token: string | null, includeArchived = false) {
  return apiRequest<RemoteHabit[]>("/api/habits", {
    token,
    query: includeArchived ? { includeArchived: "true" } : undefined,
  });
}

export function createHabit(token: string | null, input: CreateHabitInput) {
  return apiRequest<RemoteHabit>("/api/habits", {
    method: "POST",
    body: input,
    token,
  });
}

export function updateHabit(
  token: string | null,
  id: string,
  input: UpdateHabitInput,
) {
  return apiRequest<RemoteHabit>(`/api/habits/${id}`, {
    method: "PATCH",
    body: input,
    token,
  });
}

// ─── Away, and building together ─────────────────────────────────────────────

export type AwayReason = "travel" | "illness" | "family" | "move" | "other";

export interface RemoteAway {
  id: string;
  reason: AwayReason;
  startsOn: string;
  endsOn: string | null;
  habits: { id: string; name: string }[];
}

export interface RestartedHabit {
  id: string;
  name: string;
  cue: string | null;
  plan: string;
}

export function getAway(token: string | null) {
  return apiRequest<RemoteAway | null>("/api/habits/away", { token });
}

export function startAway(token: string | null, input: { reason: AwayReason; until?: string; habitIds?: string[] }) {
  return apiRequest<RemoteAway>("/api/habits/away", { method: "POST", body: input, token });
}

export function endAway(token: string | null) {
  return apiRequest<{ restarted: RestartedHabit[] }>("/api/habits/away/end", { method: "POST", token });
}

export type WeekDot = "done" | "minimum" | "rest" | "none" | "future";

export interface SharedHabitRow {
  habitId: string;
  mine: boolean;
  member: string;
  habit: string;
  plan: string;
  paused: boolean;
  week: WeekDot[];
}

export function getHabitShares(token: string | null, habitId: string) {
  return apiRequest<string[]>(`/api/habits/${habitId}/shares`, { token });
}

export function shareHabit(token: string | null, habitId: string, communityId: string) {
  return apiRequest<{ shared: boolean }>(`/api/habits/${habitId}/share`, { method: "POST", body: { communityId }, token });
}

export function unshareHabit(token: string | null, habitId: string, communityId: string) {
  return apiRequest<{ shared: boolean }>(`/api/habits/${habitId}/share/${communityId}`, { method: "DELETE", token });
}

export function getSharedHabits(token: string | null, communityId: string) {
  return apiRequest<{ weekStart: string; rows: SharedHabitRow[] }>(`/api/habits/shared/${communityId}`, { token });
}

/** Whether the API has a premium voice set up for the guides. */
export function getVoice(token: string | null) {
  return apiRequest<{ premium: boolean; provider: string | null }>(`/api/chat/me/voice`, { token });
}

/**
 * Reverses something a guide did in chat, from the Undo on its card. The
 * spec comes from the server with the action, so the app never has to know
 * how each kind of action is undone.
 */
export function undoChatAction(token: string | null, undo: Record<string, unknown>) {
  return apiRequest<{ undone: boolean }>(`/api/chat/me/actions/undo`, {
    method: "POST",
    body: { undo },
    token,
  });
}

/** Archives rather than deletes — the logs and streak history survive. */
export function archiveHabit(token: string | null, id: string) {
  return apiRequest<{ archived: boolean }>(`/api/habits/${id}`, {
    method: "DELETE",
    token,
  });
}

export function restoreHabit(token: string | null, id: string) {
  return apiRequest<RemoteHabit>(`/api/habits/${id}`, {
    method: "PATCH",
    body: { isActive: true },
    token,
  });
}

// ─── Habit assistance ───────────────────────────────────────────────────────
// Both endpoints return *drafts*. Nothing is saved until the user accepts one
// and it goes through createHabit like any hand-typed habit.

export interface HabitSuggestions {
  drafts: HabitDraft[];
  /** The signals the proposals were actually built from. Shown as chips. */
  basis: string[];
}

export function suggestHabits(
  token: string | null,
  input: { focus?: string; count?: number } = {},
) {
  return apiRequest<HabitSuggestions>("/api/habits/suggest", {
    method: "POST",
    body: { ...input, ...deviceTimeContext() },
    token,
  });
}

export interface DiscoverTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DiscoverResponse {
  reply: string;
  drafts: HabitDraft[];
  complete: boolean;
  basis: string[];
}

export function discoverHabits(token: string | null, turns: DiscoverTurn[]) {
  return apiRequest<DiscoverResponse>("/api/habits/discover", {
    method: "POST",
    body: { turns, ...deviceTimeContext() },
    token,
  });
}

export interface RemoteHabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  notes: string | null;
  /** "done" | "minimum" | "rest"; missing on logs from an older API. */
  state?: "done" | "minimum" | "rest";
  value?: number | null;
  /** "tap" | "notification" | "integration" | "chat" | "widget" … */
  source?: string | null;
}

export interface RemoteWorkout {
  id: string;
  userId: string;
  name: string;
  type: "strength" | "cardio" | "mobility" | "mixed";
  duration: number | null;
  difficulty: "too_easy" | "just_right" | "too_hard" | null;
  createdAt: string;
}

export interface LogWorkoutInput {
  name: string;
  type: RemoteWorkout["type"];
  duration?: number;
  difficulty?: "too_easy" | "just_right" | "too_hard";
}

export async function logWorkout(
  token: string | null,
  input: LogWorkoutInput,
): Promise<{ workout: RemoteWorkout; score: RemoteScore | null }> {
  const { data, meta } = await apiRequestWithMeta<
    RemoteWorkout,
    { score?: RemoteScore }
  >("/api/workouts", { method: "POST", body: input, token });
  return { workout: data, score: meta?.score ?? null };
}

export function listWorkouts(token: string | null, limit = 20) {
  return apiRequest<RemoteWorkout[]>("/api/workouts", {
    token,
    query: { limit: String(limit) },
  });
}

// ─── Coach loop ─────────────────────────────────────────────────────────────

export interface RemoteReflection {
  id: string;
  habitId: string;
  /** The missed occasion this answers. */
  date: string;
  answer: string;
  createdAt: string;
}

export interface ReflectResult {
  reflection: RemoteReflection;
  skipped?: boolean;
  reply?: string;
  change?: HabitChange;
  backupPlan?: string | null;
  concern?: boolean;
}

export function reflectOnMiss(
  token: string | null,
  habitId: string,
  input: { missedOn: string; answer?: string; skipped?: boolean },
) {
  return apiRequest<ReflectResult>(`/api/habits/${habitId}/reflect`, {
    method: "POST",
    body: input,
    token,
  });
}

export function applyReflection(token: string | null, reflectionId: string) {
  return apiRequest<RemoteHabit>(
    `/api/habits/reflections/${reflectionId}/apply`,
    {
      method: "POST",
      body: {},
      token,
    },
  );
}

export function listReflections(token: string | null) {
  return apiRequest<RemoteReflection[]>("/api/habits/reflections", { token });
}

export interface RemotePrecommitment {
  id: string;
  habitId: string;
  forDate: string;
  text: string;
}

export function precommit(
  token: string | null,
  habitId: string,
  input: { forDate: string; text: string },
) {
  return apiRequest<RemotePrecommitment>(`/api/habits/${habitId}/precommit`, {
    method: "POST",
    body: input,
    token,
  });
}

export function listPrecommitments(token: string | null) {
  return apiRequest<RemotePrecommitment[]>("/api/habits/precommitments", {
    token,
  });
}

export interface RemoteAutomaticityCheck {
  id: string;
  habitId: string;
  date: string;
  score: number;
}

export function submitAutomaticity(
  token: string | null,
  habitId: string,
  items: number[],
) {
  return apiRequest<RemoteAutomaticityCheck>(
    `/api/habits/${habitId}/automaticity`,
    {
      method: "POST",
      body: { items },
      token,
    },
  );
}

export function listAutomaticity(token: string | null) {
  return apiRequest<RemoteAutomaticityCheck[]>("/api/habits/automaticity", {
    token,
  });
}

export interface LogHabitResult {
  log: RemoteHabitLog;
  /** Today's recomputed score, returned in the same round trip. Null from
   *  an API too old to send it — refetch in that case. */
  score: RemoteScore | null;
}

export async function logHabit(
  token: string | null,
  input: LogHabitInput,
): Promise<LogHabitResult> {
  const { data, meta } = await apiRequestWithMeta<
    RemoteHabitLog,
    { score?: RemoteScore }
  >("/api/habits/log", { method: "POST", body: input, token });
  return { log: data, score: meta?.score ?? null };
}

export function listHabitLogs(
  token: string | null,
  range?: { from?: string; to?: string },
) {
  return apiRequest<
    Array<RemoteHabitLog & { habit: { name: string; category: string } }>
  >("/api/habits/logs", { token, query: range });
}

// ─── Mood ───────────────────────────────────────────────────────────────────

export interface RemoteMoodEntry {
  id: string;
  userId: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  journal: string | null;
  gratitude: string | null;
  tags: string[] | null;
  createdAt: string;
}

export function createMoodEntry(
  token: string | null,
  input: CreateMoodEntryInput,
) {
  return apiRequest<RemoteMoodEntry>("/api/mood", {
    method: "POST",
    body: input,
    token,
  });
}

export function listMoodEntries(token: string | null, limit = 30) {
  return apiRequest<RemoteMoodEntry[]>("/api/mood", {
    token,
    query: { limit: String(limit) },
  });
}

export function getLatestMood(token: string | null) {
  return apiRequest<RemoteMoodEntry | null>("/api/mood/latest", { token });
}

// ─── Daily check-in ─────────────────────────────────────────────────────────
// One per day: submitting again edits today's entry rather than adding a
// second, so the score reads a day as a day.

export interface TodayCheckIn {
  entry: RemoteMoodEntry | null;
  /** Whether the reflection component of the score has been earned. */
  reflectionDone: boolean;
}

export function getTodayCheckIn(token: string | null) {
  return apiRequest<TodayCheckIn>("/api/checkin/today", { token });
}

export interface CheckInResult {
  entry: RemoteMoodEntry;
  /** Recomputed in the same round trip, so the ring moves immediately. */
  score: RemoteScore;
}

export function submitCheckIn(token: string | null, input: CheckInInput) {
  return apiRequest<CheckInResult>("/api/checkin", {
    method: "POST",
    body: input,
    token,
  });
}

export interface CheckInPrompt {
  prompt: string;
  /** One real observation about today, or null when there's nothing to say. */
  observation: string | null;
  basis: string[];
}

export function getCheckInPrompt(token: string | null) {
  return apiRequest<CheckInPrompt>("/api/checkin/prompt", {
    method: "POST",
    body: deviceTimeContext(),
    token,
  });
}

// ─── Recommendations ────────────────────────────────────────────────────────
// Stored server-side at generation time so feedback has a row to attach to.
// Without that, "I did it" is a local boolean that teaches the system nothing.

export interface RemoteRecommendation {
  id: string;
  content: string;
  category: string;
  /** Why this one — shown under the action. */
  context: string | null;
  acted: boolean;
  dismissed: boolean;
  createdAt: string;
  /** The second option on offer, until one is picked. */
  alternative?: string | null;
  alternativeCategory?: string | null;
  alternativeContext?: string | null;
  /** Set once one of the two was picked. */
  chosenAt?: string | null;
}

export interface RecommendationEnvelope {
  recommendation: RemoteRecommendation;
  /** Signals today's recommendation was built from. */
  basis: string[];
  /** What the system has concluded from past feedback, in plain sentences. */
  learned: string[];
}

/** Today's recommendation if one exists, without generating anything. */
export function getTodayRecommendation(token: string | null) {
  return apiRequest<RemoteRecommendation | null>("/api/recommendations/today", {
    token,
  });
}

/**
 * Get today's recommendation, generating one only if needed.
 * `refresh` asks for a different one — and records the current one as dismissed.
 */
export async function requestRecommendation(
  token: string | null,
  options: { refresh?: boolean } = {},
): Promise<RecommendationEnvelope> {
  const { data, meta } = await apiRequestWithMeta<
    RemoteRecommendation,
    { basis?: string[]; learned?: string[] }
  >("/api/recommendations/today", {
    method: "POST",
    body: { ...options, ...deviceTimeContext() },
    token,
  });

  return {
    recommendation: data,
    basis: meta?.basis ?? [],
    learned: meta?.learned ?? [],
  };
}

export function sendRecommendationFeedback(
  token: string | null,
  id: string,
  outcome: "acted" | "dismissed",
) {
  return apiRequest<{ id: string; acted: boolean; dismissed: boolean }>(
    `/api/recommendations/${id}/feedback`,
    { method: "POST", body: { outcome }, token },
  );
}

/** Pick one of the two options; the API swaps it into the main fields. */
export function chooseRecommendation(
  token: string | null,
  id: string,
  option: "primary" | "alternative",
) {
  return apiRequest<RemoteRecommendation>(`/api/recommendations/${id}/choose`, {
    method: "POST",
    body: { option },
    token,
  });
}

export interface RecommendationHistory {
  recommendations: RemoteRecommendation[];
  preferences: {
    lines: string[];
    answered: number;
    acted: number;
    provisional: boolean;
  };
}

export function listRecommendations(token: string | null, limit = 30) {
  const { timeZone } = deviceTimeContext();
  return apiRequest<RecommendationHistory>("/api/recommendations", {
    token,
    query: { limit: String(limit), timeZone },
  });
}

// ─── Score ──────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  habitsCompleted: number;
  habitsTotal: number;
  workoutLogged: boolean;
  moodCheckedIn: boolean;
  reflectionDone: boolean;
  streakDays: number;
}

export interface RemoteScore {
  id: string;
  userId: string;
  date: string;
  overallScore: number;
  breakdown: ScoreBreakdown | null;
}

export function getTodayScore(token: string | null) {
  return apiRequest<RemoteScore>("/api/score/today", { token });
}

export interface RemotePeriodScore {
  period: "weekly" | "monthly" | "yearly";
  periodStart: string;
  /** null until at least one day in the period has a logged score. */
  average: number | null;
  daysLogged: number;
}

export function getPeriodScore(token: string | null) {
  return apiRequest<RemotePeriodScore>("/api/score/period", { token });
}

// ─── Nearby groups (real-world discovery) ──────────────────────────────────

export interface RemoteNearbyGroup {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  schedule: string | null;
  isFree: boolean;
  sourceUrl: string;
  verifiedAt: string;
  /** null when the request didn't include the device's coordinates. */
  distanceKm: number | null;
}

export function getNearbyGroups(
  token: string | null,
  params: { city?: string; category?: string; lat?: number; lng?: number } = {},
) {
  return apiRequest<RemoteNearbyGroup[]>("/api/nearby/groups", {
    token,
    query: {
      ...(params.city ? { city: params.city } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.lat !== undefined ? { lat: String(params.lat) } : {}),
      ...(params.lng !== undefined ? { lng: String(params.lng) } : {}),
    },
  });
}

export function getScoreHistory(token: string | null, days = 30) {
  return apiRequest<RemoteScore[]>("/api/score/history", {
    token,
    query: { days: String(days) },
  });
}

// ─── Integrations ───────────────────────────────────────────────────────────

export type IntegrationProvider =
  | "strava"
  | "whoop"
  | "oura"
  | "spotify"
  | "google_calendar"
  | "outlook_calendar";

/** Calendars are a different kind of connection from a wearable, and the app
 *  groups them separately so the disclosure can say what's actually read. */
export const CALENDAR_PROVIDERS: readonly IntegrationProvider[] = [
  "google_calendar",
  "outlook_calendar",
];

export interface RemoteIntegration {
  id: string;
  provider: IntegrationProvider;
  status: "connected" | "error" | "disconnected";
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface IntegrationsList {
  integrations: RemoteIntegration[];
  /** Which providers have server-side credentials configured at all. */
  available: Record<IntegrationProvider, boolean>;
}

export function listIntegrations(token: string | null) {
  return apiRequest<IntegrationsList>("/api/integrations", { token });
}

export function startConnect(
  token: string | null,
  provider: IntegrationProvider,
) {
  return apiRequest<{ authorizeUrl: string }>(
    `/api/integrations/${provider}/connect`,
    {
      method: "POST",
      token,
    },
  );
}

export function disconnectIntegration(
  token: string | null,
  provider: IntegrationProvider,
) {
  return apiRequest<{ disconnected: boolean }>(
    `/api/integrations/${provider}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function syncIntegration(
  token: string | null,
  provider: IntegrationProvider,
) {
  return apiRequest<{ synced: number; autoLogged?: { habitId: string; habitName: string; date: string; detail: string }[] }>(`/api/integrations/${provider}/sync`, {
    method: "POST",
    token,
  });
}

export interface RemoteWearableMetric {
  id: string;
  provider: IntegrationProvider;
  metricType: string;
  date: string;
  value: number;
  unit: string | null;
}

export function listMetrics(
  token: string | null,
  filter?: { type?: string; from?: string; to?: string },
) {
  return apiRequest<RemoteWearableMetric[]>("/api/integrations/metrics", {
    token,
    query: filter,
  });
}

export interface PatternInsight {
  metricType: string;
  summary: string;
  r: number;
  n: number;
}

export function listPatterns(token: string | null) {
  return apiRequest<PatternInsight[]>("/api/integrations/patterns", { token });
}

// ─── Therapist Starter Pack ─────────────────────────────────────────────────
// We don't provide therapists — this shares real, tracked context with the
// licensed therapist a user already has. Every category is opt-in.

export interface TherapistCategories {
  habits: boolean;
  moodTrends: boolean;
  journalExcerpts: boolean;
  patterns: boolean;
  score: boolean;
}

export interface TherapistConsent {
  active: boolean;
  categories: TherapistCategories;
  updatedAt: string | null;
}

export function getTherapistConsent(token: string | null) {
  return apiRequest<TherapistConsent>("/api/therapist/consent", { token });
}

export function updateTherapistConsent(
  token: string | null,
  categories: TherapistCategories,
) {
  return apiRequest<{ active: boolean; categories: TherapistCategories }>(
    "/api/therapist/consent",
    {
      method: "PUT",
      body: categories,
      token,
    },
  );
}

export function revokeTherapistConsent(token: string | null) {
  return apiRequest<{ active: boolean; categories: TherapistCategories }>(
    "/api/therapist/consent/revoke",
    {
      method: "POST",
      token,
    },
  );
}

export interface TherapistReportSummary {
  periodStart: string;
  periodEnd: string;
  categories: TherapistCategories;
  habits?: {
    total: number;
    completionRate: number;
    longestActiveStreak: number;
  };
  moodTrends?: {
    entries: number;
    averageMood: number | null;
    averageEnergy: number | null;
    averageStress: number | null;
    commonTags: string[];
  };
  journalExcerpts?: Array<{
    date: string;
    journal?: string;
    gratitude?: string;
  }>;
  patterns?: string[];
  score?: {
    average: number | null;
    trend: "up" | "down" | "flat" | "not_enough_data";
  };
}

export interface TherapistReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  summary: TherapistReportSummary;
}

export interface TherapistReportListItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export function generateTherapistReport(token: string | null, days = 30) {
  return apiRequest<TherapistReport>("/api/therapist/reports", {
    method: "POST",
    body: { days },
    token,
  });
}

export function listTherapistReports(token: string | null) {
  return apiRequest<TherapistReportListItem[]>("/api/therapist/reports", {
    token,
  });
}

export function getTherapistReport(token: string | null, id: string) {
  return apiRequest<TherapistReport>(`/api/therapist/reports/${id}`, { token });
}

export * from "./community";

export { ApiRequestError } from "./client";
