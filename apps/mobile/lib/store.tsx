/**
 * Client-side app state.
 *
 * The habits/score backend (apps/api + Prisma) isn't wired into the app yet,
 * so this holds the day's state in memory and computes the Kinextion Score
 * with the same weights the server uses (`SCORE_WEIGHTS` in @kinextion/shared)
 * — the arithmetic is real, only the persistence is missing.
 *
 * Every mutation goes through this provider, so replacing it with API calls is
 * a change to this file alone. Marked TODO where the network call belongs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SCORE_WEIGHTS } from "@kinextion/shared";
import type { Category } from "../theme";

export interface Habit {
  id: string;
  name: string;
  /** Cue from the Atomic Habits loop — what this habit is stacked onto. */
  cue: string;
  category: Category;
  done: boolean;
  streak: number;
}

/** Starter habits: two-minute sized, one per wellness dimension. */
const SEED_HABITS: Habit[] = [
  { id: "h1", name: "10-minute walk", cue: "After lunch", category: "physical", done: false, streak: 6 },
  { id: "h2", name: "Protein at breakfast", cue: "With coffee", category: "physical", done: false, streak: 12 },
  { id: "h3", name: "Three slow breaths", cue: "Before opening the laptop", category: "mental", done: false, streak: 3 },
  { id: "h4", name: "Name one feeling", cue: "On the commute home", category: "emotional", done: false, streak: 0 },
  { id: "h5", name: "Phone out of the bedroom", cue: "At 10pm", category: "spiritual", done: false, streak: 9 },
];

interface AppState {
  habits: Habit[];
  moodLogged: boolean;
  reflectionLogged: boolean;
  workoutLogged: boolean;
  /** null until the first habit is completed — an honest zero state. */
  score: number | null;
  toggleHabit: (id: string) => void;
  logMood: () => void;
  logReflection: () => void;
  logWorkout: () => void;
  resetDay: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(SEED_HABITS);
  const [moodLogged, setMoodLogged] = useState(false);
  const [reflectionLogged, setReflectionLogged] = useState(false);
  const [workoutLogged, setWorkoutLogged] = useState(false);

  const toggleHabit = useCallback((id: string) => {
    // TODO: POST /habits/:id/toggle once the API is wired up.
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              done: !h.done,
              // Completing extends the streak; un-completing walks it back, so
              // the number never lies about what actually happened today.
              streak: h.done ? Math.max(0, h.streak - 1) : h.streak + 1,
            }
          : h
      )
    );
  }, []);

  const score = useMemo(() => {
    const doneCount = habits.filter((h) => h.done).length;
    const anyActivity = doneCount > 0 || moodLogged || reflectionLogged || workoutLogged;
    if (!anyActivity) return null;

    const habitPart =
      habits.length === 0
        ? 0
        : (doneCount / habits.length) * SCORE_WEIGHTS.habitsCompletion;

    // Streak bonus scales with the longest active streak, capped at its weight.
    const longest = habits.reduce((max, h) => Math.max(max, h.done ? h.streak : 0), 0);
    const streakPart = Math.min(SCORE_WEIGHTS.streakBonus, longest);

    const total =
      habitPart +
      (workoutLogged ? SCORE_WEIGHTS.workoutLogged : 0) +
      (moodLogged ? SCORE_WEIGHTS.moodCheckIn : 0) +
      (reflectionLogged ? SCORE_WEIGHTS.reflection : 0) +
      streakPart;

    return Math.round(Math.min(100, total));
  }, [habits, moodLogged, reflectionLogged, workoutLogged]);

  const value = useMemo<AppState>(
    () => ({
      habits,
      moodLogged,
      reflectionLogged,
      workoutLogged,
      score,
      toggleHabit,
      logMood: () => setMoodLogged(true),
      logReflection: () => setReflectionLogged(true),
      logWorkout: () => setWorkoutLogged(true),
      resetDay: () => {
        setHabits(SEED_HABITS.map((h) => ({ ...h, done: false })));
        setMoodLogged(false);
        setReflectionLogged(false);
        setWorkoutLogged(false);
      },
    }),
    [habits, moodLogged, reflectionLogged, workoutLogged, score, toggleHabit]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
