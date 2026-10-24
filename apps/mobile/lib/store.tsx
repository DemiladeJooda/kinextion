/**
 * Data-backed app state: today's habits, the daily check-in, and the
 * Kinextion Score — all persisted through apps/api. Mutations re-derive local
 * state from the server's response. The one exception is ticking a habit,
 * which shows immediately and rolls back if the save fails: a tap that waits
 * on the network is a tap that feels broken.
 *
 * Due-today, streaks and consistency come from @kinextion/shared's habit
 * module — the same code the API scores with — so the phone and the server
 * can't disagree about a day.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import {
  addDays,
  dateKeyOf,
  describeSchedule,
  habitProgress,
  isDueOn,
  localDateKey,
  localHour,
  tallyBetween,
  today,
  displayFields,
  describeHabitPlan,
  lastMissedOccasion,
  checkDue,
  readyToGraduate,
  type AutomaticityPoint,
  type DateKey,
  type ReminderHabit,
  type DisplayFields,
} from "@kinextion/shared";
import type {
  CreateHabitInput,
  UpdateHabitInput,
  CheckInInput,
} from "@kinextion/shared";
import { useApi } from "../hooks/useApi";
import { noteHabitLog } from "./usage";
import type {
  LogWorkoutInput,
  RemoteHabit,
  RemoteHabitLog,
  RemoteMoodEntry,
  RemoteAutomaticityCheck,
  RemotePrecommitment,
  RemoteReflection,
  ReflectResult,
} from "../services";
import type { Category } from "../theme";

export interface Habit {
  id: string;
  name: string;
  /** The existing moment this habit is stacked onto. */
  cue: string;
  category: Category;
  done: boolean;
  /** On today's list. False for a Mon/Wed/Fri habit on a Tuesday, or a
   *  weekly habit already done this week. */
  due: boolean;
  /** "Every day", "Mon · Wed · Fri", "Once a week". */
  scheduleLabel: string;
  streak: number;
  /** Longest run in the loaded history (the last 90 days). */
  bestStreak: number;
  /** What one unit of streak means — weekly habits streak in weeks. */
  streakUnit: "day" | "week";
  /** Kept ÷ due over the loaded history; null before anything was due. */
  consistency: number | null;
  /** Today's log, if any: done, the tiny version, or a planned rest day. */
  todayState: "done" | "minimum" | "rest" | null;
  /** Streak alive but the last occasion was missed — today saves it. */
  atRisk: boolean;
  /** Today's tick restarted the habit after a streak ended. */
  comeback: boolean;
  /** Due yesterday, not done, not rested — and it's still before noon, so
   *  it can still be ticked. */
  yesterdayOpen: boolean;
  /** This calendar month so far: occasions kept and due. */
  month: { kept: number; due: number };
  /** The rest of the loop, carried so the edit screen prefills without
   *  a second fetch. */
  craving: string | null;
  response: string | null;
  reward: string | null;
  frequency: string;
  targetDays: number[] | null;
  /** v2 fields, carried so the edit screen prefills without a second fetch. */
  fullVersion: string | null;
  backupPlan: string | null;
  pairWith: string | null;
  timeWindow: "morning" | "midday" | "evening" | "anytime";
  perWeekTarget: number | null;
  status: "building" | "established" | "paused";
  /** First due day, when it was set to start later ("start Monday"). */
  startsOn: DateKey | null;
  /**
   * What to show back: Kinextion's tidied reading of the anchor, tiny
   * version, why and backup plan. Raw fields above are for editing only.
   */
  display: DisplayFields;
  /** Reminders for this habit, at the start of its part of the day. */
  reminderEnabled: boolean;
  /** The latest occasion, if it was missed and nothing's been kept since. */
  missedOn: DateKey | null;
  /** Ask "What would it take?" — missed, not answered yet, not done today. */
  askAboutMiss: boolean;
  /** What they promised for today / tomorrow, if anything. */
  promiseToday: string | null;
  promiseTomorrow: string | null;
  /** First day it was due: creation, or a later "start Monday". */
  startDate: DateKey;
  /** Weekly automaticity scores, oldest first. */
  automaticity: AutomaticityPoint[];
  /** Offer the weekly check now (done today, a week since the last). */
  checkDue: boolean;
  /** High and levelled off: offer to graduate it. */
  canGraduate: boolean;
  /** Day by day, for the habit page's calendar. */
  history: {
    done: ReadonlySet<DateKey>;
    minimum: ReadonlySet<DateKey>;
    rest: ReadonlySet<DateKey>;
  };
}

interface AppState {
  habits: Habit[];
  /** Today's check-in, or null before the first one. */
  checkIn: RemoteMoodEntry | null;
  moodLogged: boolean;
  reflectionLogged: boolean;
  workoutLogged: boolean;
  /** null until the first activity of the day — an honest zero state. */
  score: number | null;
  /** The headline number shown on screen — a rolling average over the
   *  period set in Profile (default weekly), not just today. */
  periodScore: {
    average: number | null;
    period: "weekly" | "monthly" | "yearly";
  } | null;
  loading: boolean;
  error: string | null;
  /** Tap on a row: done if it isn't, cleared if it is. */
  toggleHabit: (id: string) => Promise<void>;
  /**
   * Set a habit's day to done, the tiny version, a rest day, or clear it.
   * Defaults to today; pass `date` for yesterday (allowed until noon).
   */
  setHabitDay: (
    id: string,
    state: "done" | "minimum" | "rest" | "clear",
    options?: {
      date?: DateKey;
      notes?: string;
      /** Where the log came from — "notification" for the lock-screen buttons. */
      source?: "tap" | "notification";
    },
  ) => Promise<void>;
  addHabit: (input: CreateHabitInput) => Promise<void>;
  /** Accept several AI drafts at once, then refresh once rather than n times. */
  addHabits: (inputs: CreateHabitInput[]) => Promise<void>;
  editHabit: (id: string, input: UpdateHabitInput) => Promise<void>;
  /** Archives: the habit leaves today's list, its logs and streak history stay. */
  archiveHabit: (id: string) => Promise<void>;
  submitCheckIn: (input: CheckInInput) => Promise<void>;
  /** Log a workout; today's score comes back in the same round trip. */
  logWorkout: (input: LogWorkoutInput) => Promise<void>;
  /** Re-pull habits, logs, check-in, and score from the server. */
  refresh: () => Promise<void>;
  /** Everything the reminder planner needs, kept in step with every log. */
  reminderHabits: ReminderHabit[];
  /**
   * Answer "What would it take?" for a habit's missed occasion (or skip it).
   * The answer is stored either way, so the question isn't asked twice.
   */
  answerMiss: (
    habitId: string,
    missedOn: DateKey,
    answer: string | null,
  ) => Promise<ReflectResult>;
  /** Apply the one change a reflection suggested. */
  applyReflection: (reflectionId: string) => Promise<void>;
  /** "Tomorrow, I'll …" for one or more habits. */
  promise: (habitIds: string[], forDate: DateKey) => Promise<void>;
  /** Streaks shown at all (Settings → Habits & streaks). */
  showStreaks: boolean;
  setShowStreaks: (show: boolean) => Promise<void>;
  /** The weekly "does this feel automatic yet?" answers for a habit. */
  submitAutomaticity: (habitId: string, items: number[]) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

/** How much history the phone loads — enough for streaks and a month view. */
const HISTORY_DAYS = 90;

/** Yesterday can be ticked until this local hour — matches the API. */
const BACKFILL_UNTIL_HOUR = 12;

function addTo(map: Map<string, Set<DateKey>>, habitId: string, key: DateKey) {
  const set = map.get(habitId);
  if (set) set.add(key);
  else map.set(habitId, new Set([key]));
}

/** Kept dates (done or minimum) and rest dates per habit, for the shared
 *  schedule functions. The same split the API scores with. */
function logMaps(logs: RemoteHabitLog[]) {
  const completed = new Map<string, Set<DateKey>>();
  const rest = new Map<string, Set<DateKey>>();
  const minimum = new Map<string, Set<DateKey>>();
  for (const l of logs) {
    const key = dateKeyOf(l.date);
    if (l.completed) {
      addTo(completed, l.habitId, key);
      if (l.state === "minimum") addTo(minimum, l.habitId, key);
    } else if (l.state === "rest") addTo(rest, l.habitId, key);
  }
  return { completed, rest, minimum };
}

/** First due day for a habit as the server sent it: creation, or a later start. */
function remoteStartDate(h: RemoteHabit | undefined): DateKey | null {
  if (!h) return null;
  const created = localDateKey(new Date(h.createdAt));
  const starts = h.startsOn ? dateKeyOf(h.startsOn) : null;
  return starts && starts > created ? starts : created;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const api = useApi();

  const [remoteHabits, setRemoteHabits] = useState<RemoteHabit[]>([]);
  const [logs, setLogs] = useState<RemoteHabitLog[]>([]);
  const [reflections, setReflections] = useState<RemoteReflection[]>([]);
  const [promises, setPromises] = useState<RemotePrecommitment[]>([]);
  const [checks, setChecks] = useState<RemoteAutomaticityCheck[]>([]);
  const [showStreaks, setShowStreaksState] = useState(true);
  const [checkIn, setCheckIn] = useState<RemoteMoodEntry | null>(null);
  const [moodLogged, setMoodLogged] = useState(false);
  const [reflectionLogged, setReflectionLogged] = useState(false);
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [periodScore, setPeriodScore] = useState<AppState["periodScore"]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyScore = useCallback(
    (s: Awaited<ReturnType<typeof api.getTodayScore>>) => {
      setScore(s.overallScore);
      setWorkoutLogged(s.breakdown?.workoutLogged ?? false);
      setReflectionLogged(s.breakdown?.reflectionDone ?? false);
      setMoodLogged(s.breakdown?.moodCheckedIn ?? false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  /**
   * A new account starts with no habits and says so.
   *
   * This used to seed five habits on first load, which made the app look
   * populated and quietly became the ceiling — those five were the complete
   * set for every user, forever. An empty list that offers to build one is
   * more honest and leads somewhere.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [currentHabits, dayLogs, todayCheckIn, todayScore, period] =
        await Promise.all([
          api.listHabits(),
          api.listHabitLogs({ from: addDays(today(), -HISTORY_DAYS) }),
          api.getTodayCheckIn(),
          api.getTodayScore(),
          api.getPeriodScore(),
        ]);

      setRemoteHabits(currentHabits);
      // Coach-loop state is a nice-to-have; failing to load it must not
      // stop the day from loading.
      void api
        .listReflections()
        .then(setReflections)
        .catch(() => {});
      void api
        .listPrecommitments()
        .then(setPromises)
        .catch(() => {});
      void api
        .listAutomaticity()
        .then(setChecks)
        .catch(() => {});
      void api
        .getMyProfile()
        .then((me) =>
          setShowStreaksState(me.profile?.preferences?.showStreaks !== false),
        )
        .catch(() => {});
      setLogs(dayLogs);
      setCheckIn(todayCheckIn.entry);
      applyScore(todayScore);
      setPeriodScore({ average: period.average, period: period.period });
    } catch {
      setError("Couldn't load your data. Pull to refresh to try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const setHabitDay = useCallback<AppState["setHabitDay"]>(
    async (id, state, options = {}) => {
      const date = options.date ?? today();
      const sameDay = (l: RemoteHabitLog) =>
        l.habitId === id && dateKeyOf(l.date) === date;
      const previous = logs.find(sameDay);
      const completed = state === "done" || state === "minimum";
      const logState = state === "clear" ? "done" : state;
      const notes = options.notes ?? previous?.notes ?? undefined;

      // Show it now; the server's row replaces this placeholder when it lands.
      const optimistic: RemoteHabitLog = {
        id: previous?.id ?? `pending-${id}-${date}`,
        habitId: id,
        userId: previous?.userId ?? "",
        date,
        completed,
        state: logState,
        notes: notes ?? null,
      };
      setLogs((prev) => [optimistic, ...prev.filter((l) => !sameDay(l))]);
      setError(null);
      noteHabitLog(id);

      try {
        const { log, score: newScore } = await api.logHabit({
          habitId: id,
          date,
          completed,
          state: logState,
          notes,
          source: options.source,
        });
        setLogs((prev) => [log, ...prev.filter((l) => !sameDay(l))]);
        applyScore(newScore ?? (await api.getTodayScore()));
      } catch (err) {
        setLogs((prev) => [
          ...(previous ? [previous] : []),
          ...prev.filter((l) => !sameDay(l)),
        ]);
        // The API's own words when it refused (a second rest day this week,
        // yesterday after noon); a generic line when the network failed.
        const message = err instanceof Error && err.message ? err.message : "";
        setError(
          message && !/reach Kinextion|Request failed/.test(message)
            ? message
            : "Couldn't save that. Try again.",
        );
      }
    },
    [logs, api, applyScore],
  );

  const toggleHabit = useCallback(
    async (id: string) => {
      const todayStr = today();
      const current = logs.find(
        (l) => l.habitId === id && dateKeyOf(l.date) === todayStr,
      );
      await setHabitDay(id, current?.completed ? "clear" : "done");
    },
    [logs, setHabitDay],
  );

  const addHabit = useCallback(
    async (input: CreateHabitInput) => {
      const habit = await api.createHabit(input);
      // Prepend locally so the new habit is visible before the score round
      // trip finishes; refresh() reconciles on the next pull either way.
      setRemoteHabits((prev) => [habit, ...prev]);
      applyScore(await api.getTodayScore());
    },
    [api, applyScore],
  );

  const addHabits = useCallback(
    async (inputs: CreateHabitInput[]) => {
      const created = await Promise.all(inputs.map((i) => api.createHabit(i)));
      setRemoteHabits((prev) => [...created, ...prev]);
      applyScore(await api.getTodayScore());
    },
    [api, applyScore],
  );

  const editHabit = useCallback(
    async (id: string, input: UpdateHabitInput) => {
      const updated = await api.updateHabit(id, input);
      setRemoteHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
      applyScore(await api.getTodayScore());
    },
    [api, applyScore],
  );

  const archiveHabit = useCallback(
    async (id: string) => {
      await api.archiveHabit(id);
      setRemoteHabits((prev) => prev.filter((h) => h.id !== id));
      // The archived habit leaves the score's denominator, so today's number
      // changes the moment it's removed.
      applyScore(await api.getTodayScore());
    },
    [api, applyScore],
  );

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      const result = await api.submitCheckIn(input);
      setCheckIn(result.entry);
      applyScore(result.score);
    },
    [api, applyScore],
  );

  const logWorkout = useCallback(
    async (input: LogWorkoutInput) => {
      const result = await api.logWorkout(input);
      applyScore(result.score ?? (await api.getTodayScore()));
    },
    [api, applyScore],
  );

  // promise() needs the latest display text without re-creating itself.
  const habitsRef = useRef<Habit[]>([]);

  const promiseFor = (habitId: string, day: DateKey): string | null =>
    promises.find((p) => p.habitId === habitId && dateKeyOf(p.forDate) === day)
      ?.text ?? null;

  const answerMiss = useCallback<AppState["answerMiss"]>(
    async (habitId, missedOn, answer) => {
      const result = await api.reflectOnMiss(habitId, {
        missedOn,
        ...(answer === null ? { skipped: true } : { answer }),
      });
      setReflections((prev) => [result.reflection, ...prev]);
      return result;
    },
    [api],
  );

  const applyReflection = useCallback(
    async (reflectionId: string) => {
      const updated = await api.applyReflection(reflectionId);
      setRemoteHabits((prev) =>
        prev.map((h) => (h.id === updated.id ? updated : h)),
      );
      applyScore(await api.getTodayScore());
    },
    [api, applyScore],
  );

  const promise = useCallback<AppState["promise"]>(
    async (habitIds, forDate) => {
      const saved = await Promise.all(
        habitIds.map((id) => {
          const h = habitsRef.current.find((x) => x.id === id);
          const text = h
            ? describeHabitPlan({
                name: h.name,
                cue: h.display.cue,
                response: h.display.response,
              }).plan
            : "";
          return api.precommit(id, { forDate, text });
        }),
      );
      setPromises((prev) => [
        ...saved,
        ...prev.filter(
          (p) =>
            !saved.some(
              (s) => s.habitId === p.habitId && s.forDate === p.forDate,
            ),
        ),
      ]);
    },
    [api],
  );

  const setShowStreaks = useCallback(
    async (show: boolean) => {
      setShowStreaksState(show);
      try {
        await api.updateProfile({ preferences: { showStreaks: show } });
      } catch {
        setShowStreaksState(!show);
      }
    },
    [api],
  );

  const submitAutomaticity = useCallback(
    async (habitId: string, items: number[]) => {
      const saved = await api.submitAutomaticity(habitId, items);
      setChecks((prev) => [
        ...prev.filter(
          (c) =>
            !(
              c.habitId === habitId &&
              dateKeyOf(c.date) === dateKeyOf(saved.date)
            ),
        ),
        saved,
      ]);
    },
    [api],
  );

  const habits = useMemo<Habit[]>(() => {
    const todayStr = today();
    const yesterday = addDays(todayStr, -1);
    const monthStart = `${todayStr.slice(0, 7)}-01`;
    const beforeNoon = localHour() < BACKFILL_UNTIL_HOUR;
    const maps = logMaps(logs);
    const none = new Set<DateKey>();
    const todayLog = new Map(
      logs
        .filter((l) => dateKeyOf(l.date) === todayStr)
        .map((l) => [l.habitId, l]),
    );
    return remoteHabits.map((h) => {
      const done = maps.completed.get(h.id) ?? none;
      const rest = maps.rest.get(h.id) ?? none;
      const created = localDateKey(new Date(h.createdAt));
      const startsOn = h.startsOn ? dateKeyOf(h.startsOn) : null;
      const scheduled = {
        ...h,
        startDate: startsOn && startsOn > created ? startsOn : created,
      };
      const progress = habitProgress(scheduled, done, todayStr, rest);
      const points: AutomaticityPoint[] = checks
        .filter((c) => c.habitId === h.id)
        .map((c) => ({ date: dateKeyOf(c.date), score: c.score }));
      const missedOn =
        h.status === "paused"
          ? null
          : lastMissedOccasion(scheduled, done, todayStr, rest);
      const log = todayLog.get(h.id);
      const todayState = log?.completed
        ? log.state === "minimum"
          ? "minimum"
          : "done"
        : log?.state === "rest"
          ? "rest"
          : null;
      return {
        todayState,
        missedOn,
        askAboutMiss:
          missedOn !== null &&
          h.status !== "paused" &&
          todayState === null &&
          !reflections.some(
            (r) => r.habitId === h.id && dateKeyOf(r.date) === missedOn,
          ),
        promiseToday: promiseFor(h.id, todayStr),
        promiseTomorrow: promiseFor(h.id, addDays(todayStr, 1)),
        startDate: scheduled.startDate,
        automaticity: points,
        checkDue: checkDue(
          {
            status: h.status,
            startDate: scheduled.startDate,
            doneToday: done.has(todayStr),
            lastCheck: points.at(-1)?.date ?? null,
          },
          todayStr,
        ),
        canGraduate:
          (h.status ?? "building") === "building" && readyToGraduate(points),
        history: {
          done,
          minimum: maps.minimum.get(h.id) ?? none,
          rest,
        },
        atRisk: progress.atRisk,
        comeback: progress.comeback,
        yesterdayOpen:
          beforeNoon &&
          h.frequency !== "weekly" &&
          scheduled.startDate <= yesterday &&
          isDueOn(scheduled, yesterday, done) &&
          !done.has(yesterday) &&
          !rest.has(yesterday),
        month: tallyBetween(scheduled, done, monthStart, todayStr, rest),
        id: h.id,
        name: h.name,
        cue: h.cue ?? "",
        category: h.category as Category,
        done: done.has(todayStr),
        // Paused habits aren't owed anything: off the list, no misses.
        due: h.status !== "paused" && isDueOn(scheduled, todayStr, done),
        scheduleLabel: describeSchedule(h),
        streak: progress.streak,
        bestStreak: progress.bestStreak,
        streakUnit: progress.unit,
        consistency: progress.consistency,
        craving: h.craving,
        response: h.response,
        reward: h.reward,
        frequency: h.frequency,
        targetDays: h.targetDays,
        fullVersion: h.fullVersion ?? null,
        backupPlan: h.backupPlan ?? null,
        pairWith: h.pairWith ?? null,
        timeWindow: h.timeWindow ?? "anytime",
        perWeekTarget: h.perWeekTarget ?? null,
        status: h.status ?? "building",
        startsOn,
        display: displayFields(h),
        reminderEnabled: h.reminderEnabled ?? true,
      };
    });
  }, [remoteHabits, logs, reflections, promises, checks]);

  const reminderHabits = useMemo<ReminderHabit[]>(() => {
    const maps = logMaps(logs);
    const none = new Set<DateKey>();
    return habits.map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.frequency,
      targetDays: h.targetDays,
      perWeekTarget: h.perWeekTarget,
      startDate: remoteStartDate(remoteHabits.find((r) => r.id === h.id)),
      timeWindow: h.timeWindow,
      reminderEnabled: h.reminderEnabled,
      status: h.status,
      display: h.display,
      completed: maps.completed.get(h.id) ?? none,
      rest: maps.rest.get(h.id) ?? none,
      promises: new Map(
        promises
          .filter((p) => p.habitId === h.id)
          .map((p) => [dateKeyOf(p.forDate), p.text] as [DateKey, string]),
      ),
    }));
  }, [habits, logs, remoteHabits, promises]);

  habitsRef.current = habits;

  const value = useMemo<AppState>(
    () => ({
      habits,
      checkIn,
      moodLogged,
      reflectionLogged,
      workoutLogged,
      score,
      periodScore,
      loading,
      error,
      toggleHabit,
      addHabit,
      addHabits,
      editHabit,
      archiveHabit,
      submitCheckIn,
      logWorkout,
      setHabitDay,
      refresh,
      reminderHabits,
      answerMiss,
      applyReflection,
      promise,
      submitAutomaticity,
      showStreaks,
      setShowStreaks,
    }),
    [
      habits,
      checkIn,
      moodLogged,
      reflectionLogged,
      workoutLogged,
      score,
      periodScore,
      loading,
      error,
      toggleHabit,
      addHabit,
      addHabits,
      editHabit,
      archiveHabit,
      submitCheckIn,
      logWorkout,
      setHabitDay,
      refresh,
      reminderHabits,
      answerMiss,
      applyReflection,
      promise,
      submitAutomaticity,
      showStreaks,
      setShowStreaks,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
