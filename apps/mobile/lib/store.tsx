/**
 * Data-backed app state: today's habits, the daily check-in, and the
 * Kinextion Score — all persisted through apps/api. Every mutation calls the
 * server and re-derives local state from its response, so what's on screen is
 * the server's answer, never a client guess.
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
import { toDateString, today } from "@kinextion/shared";
import type { CreateHabitInput, UpdateHabitInput, CheckInInput } from "@kinextion/shared";
import { useApi } from "../hooks/useApi";
import type { RemoteHabit, RemoteHabitLog, RemoteMoodEntry } from "../services";
import type { Category } from "../theme";

export interface Habit {
  id: string;
  name: string;
  /** Cue from the Atomic Habits loop — what this habit is stacked onto. */
  cue: string;
  category: Category;
  done: boolean;
  streak: number;
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
  periodScore: { average: number | null; period: "weekly" | "monthly" | "yearly" } | null;
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
  /** Re-pull habits, logs, check-in, and score from the server. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

/** Consecutive completed days for one habit, ending today or yesterday. */
function computeStreak(habitId: string, logs: RemoteHabitLog[]): number {
  const completedDates = new Set(
    logs.filter((l) => l.habitId === habitId && l.completed).map((l) => l.date.slice(0, 10))
  );

  let streak = 0;
  const cursor = new Date();
  if (!completedDates.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completedDates.has(toDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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

  const applyScore = useCallback((s: Awaited<ReturnType<typeof api.getTodayScore>>) => {
    setScore(s.overallScore);
    setWorkoutLogged(s.breakdown?.workoutLogged ?? false);
    setReflectionLogged(s.breakdown?.reflectionDone ?? false);
    setMoodLogged(s.breakdown?.moodCheckedIn ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const [currentHabits, dayLogs, todayCheckIn, todayScore, period] = await Promise.all([
        api.listHabits(),
        api.listHabitLogs({ from: toDateString(since) }),
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
      const currentlyDone = logs.some(
        (l) => l.habitId === id && l.date.slice(0, 10) === todayStr && l.completed
      );

      try {
        const log = await api.logHabit({ habitId: id, date: todayStr, completed: !currentlyDone });
        setLogs((prev) => [
          log,
          ...prev.filter((l) => !(l.habitId === id && l.date.slice(0, 10) === todayStr)),
        ]);
        applyScore(await api.getTodayScore());
      } catch {
        setError("Couldn't save that. Try again.");
      }
    },
    [logs, api, applyScore]
  );

  const addHabit = useCallback(
    async (input: CreateHabitInput) => {
      const habit = await api.createHabit(input);
      // Prepend locally so the new habit is visible before the score round
      // trip finishes; refresh() reconciles on the next pull either way.
      setRemoteHabits((prev) => [habit, ...prev]);
      applyScore(await api.getTodayScore());
    },
    [api, applyScore]
  );

  const addHabits = useCallback(
    async (inputs: CreateHabitInput[]) => {
      const created = await Promise.all(inputs.map((i) => api.createHabit(i)));
      setRemoteHabits((prev) => [...created, ...prev]);
      applyScore(await api.getTodayScore());
    },
    [api, applyScore]
  );

  const editHabit = useCallback(
    async (id: string, input: UpdateHabitInput) => {
      const updated = await api.updateHabit(id, input);
      setRemoteHabits((prev) => prev.map((h) => (h.id === id ? updated : h)));
      applyScore(await api.getTodayScore());
    },
    [api, applyScore]
  );

  const archiveHabit = useCallback(
    async (id: string) => {
      await api.archiveHabit(id);
      setRemoteHabits((prev) => prev.filter((h) => h.id !== id));
      // The archived habit leaves the score's denominator, so today's number
      // changes the moment it's removed.
      applyScore(await api.getTodayScore());
    },
    [api, applyScore]
  );

  const submitCheckIn = useCallback(
    async (input: CheckInInput) => {
      const result = await api.submitCheckIn(input);
      setCheckIn(result.entry);
      applyScore(result.score);
    },
    [api, applyScore]
  );

  const habits = useMemo<Habit[]>(() => {
    const todayStr = today();
    return remoteHabits.map((h) => ({
      id: h.id,
      name: h.name,
      cue: h.cue ?? "",
      category: h.category as Category,
      done: logs.some((l) => l.habitId === h.id && l.date.slice(0, 10) === todayStr && l.completed),
      streak: computeStreak(h.id, logs),
      craving: h.craving,
      response: h.response,
      reward: h.reward,
      frequency: h.frequency,
      targetDays: h.targetDays,
    }));
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
      refresh,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
