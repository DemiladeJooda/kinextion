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
  today,
  type DateKey,
} from "@kinextion/shared";
import type {
  CreateHabitInput,
  UpdateHabitInput,
  CheckInInput,
} from "@kinextion/shared";
import { useApi } from "../hooks/useApi";
import type {
  LogWorkoutInput,
  RemoteHabit,
  RemoteHabitLog,
  RemoteMoodEntry,
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
  /** The rest of the loop, carried so the edit screen prefills without
   *  a second fetch. */
  craving: string | null;
  response: string | null;
  reward: string | null;
  frequency: string;
  targetDays: number[] | null;
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
  toggleHabit: (id: string) => Promise<void>;
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
}

const Ctx = createContext<AppState | null>(null);

/** How much history the phone loads — enough for streaks and a month view. */
const HISTORY_DAYS = 90;

/** Completed dates per habit, for the shared schedule functions. */
function completedDates(logs: RemoteHabitLog[]): Map<string, Set<DateKey>> {
  const map = new Map<string, Set<DateKey>>();
  for (const l of logs) {
    if (!l.completed) continue;
    const key = dateKeyOf(l.date);
    const set = map.get(l.habitId);
    if (set) set.add(key);
    else map.set(l.habitId, new Set([key]));
  }
  return map;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const api = useApi();

  const [remoteHabits, setRemoteHabits] = useState<RemoteHabit[]>([]);
  const [logs, setLogs] = useState<RemoteHabitLog[]>([]);
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

  const toggleHabit = useCallback(
    async (id: string) => {
      const todayStr = today();
      const sameDay = (l: RemoteHabitLog) =>
        l.habitId === id && dateKeyOf(l.date) === todayStr;
      const previous = logs.find(sameDay);
      const completed = !(previous?.completed ?? false);

      // Show it now; the server's row replaces this placeholder when it lands.
      const optimistic: RemoteHabitLog = {
        id: previous?.id ?? `pending-${id}`,
        habitId: id,
        userId: previous?.userId ?? "",
        date: todayStr,
        completed,
        notes: previous?.notes ?? null,
      };
      setLogs((prev) => [optimistic, ...prev.filter((l) => !sameDay(l))]);
      setError(null);

      try {
        const { log, score: newScore } = await api.logHabit({
          habitId: id,
          date: todayStr,
          completed,
        });
        setLogs((prev) => [log, ...prev.filter((l) => !sameDay(l))]);
        applyScore(newScore ?? (await api.getTodayScore()));
      } catch {
        setLogs((prev) => [
          ...(previous ? [previous] : []),
          ...prev.filter((l) => !sameDay(l)),
        ]);
        setError("Couldn't save that. Try again.");
      }
    },
    [logs, api, applyScore],
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

  const habits = useMemo<Habit[]>(() => {
    const todayStr = today();
    const byHabit = completedDates(logs);
    const none = new Set<DateKey>();
    return remoteHabits.map((h) => {
      const done = byHabit.get(h.id) ?? none;
      const scheduled = {
        ...h,
        startDate: localDateKey(new Date(h.createdAt)),
      };
      const progress = habitProgress(scheduled, done, todayStr);
      return {
        id: h.id,
        name: h.name,
        cue: h.cue ?? "",
        category: h.category as Category,
        done: done.has(todayStr),
        due: isDueOn(scheduled, todayStr, done),
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
      };
    });
  }, [remoteHabits, logs]);

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
      refresh,
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
      refresh,
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
