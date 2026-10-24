/**
 * Progress and graduation.
 *
 *   AutomaticityCheckCard  the weekly four-question "automatic yet?" check,
 *                          shown right after a habit is ticked
 *   GraduateCard           when the answers have levelled off high
 *   HabitProgress          the habit page's calendar, numbers and curve
 */

import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  SRBAI_ITEMS,
  SRBAI_MAX,
  formationNote,
  heatmap,
  isDueOn,
  today,
  type DayCell,
} from "@kinextion/shared";

import { Card, Label, Txt } from "./ui";
import type { Habit } from "../lib/store";
import { categoryColor, color, radius, space, tint } from "../theme";

// ─── The weekly check ─────────────────────────────────────────────────────────

/**
 * Four statements, each a row of seven dots. It's the one weekly ask, so it
 * stays small: no intro screen, no score shown back, just a thank-you that
 * says where the habit is on the arc.
 */
export function AutomaticityCheckCard({
  habit,
  onSubmit,
  onSkip,
}: {
  habit: Habit;
  onSubmit: (items: number[]) => Promise<void>;
  onSkip: () => void;
}) {
  const accent = categoryColor[habit.category];
  const [answers, setAnswers] = useState<(number | null)[]>(
    SRBAI_ITEMS.map(() => null),
  );
  const [state, setState] = useState<"asking" | "saving" | "done" | "error">(
    "asking",
  );

  const pick = async (item: number, value: number) => {
    void Haptics.selectionAsync();
    const next = answers.map((a, i) => (i === item ? value : a));
    setAnswers(next);
    if (next.every((a) => a !== null)) {
      setState("saving");
      try {
        await onSubmit(next as number[]);
        setState("done");
      } catch {
        setState("error");
      }
    }
  };

  if (state === "done") {
    const latest =
      (answers as number[]).reduce((a, b) => a + b, 0) / answers.length;
    return (
      <Animated.View entering={FadeIn.duration(250)}>
        <Card accent={accent}>
          <Txt variant="bodyStrong" c={accent}>
            Thanks. Logged.
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
            {formationNote(habit.startDate, today(), latest)}
          </Txt>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <Card accent={accent}>
        <Txt variant="bodyStrong">Quick check: {habit.name}</Txt>
        <Txt
          variant="small"
          c={color.textMuted}
          style={{ marginTop: 2, marginBottom: space.md }}
        >
          Once a week. How true is each of these? It&apos;s how Kinextion knows
          when a habit has become automatic.
        </Txt>
        <View style={{ gap: space.md }}>
          {SRBAI_ITEMS.map((statement, item) => (
            <View key={statement} style={{ gap: space.xs }}>
              <Txt variant="small">
                {habit.name} is something {statement}.
              </Txt>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {Array.from({ length: SRBAI_MAX }, (_, i) => i + 1).map((v) => {
                  const on = answers[item] === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => void pick(item, v)}
                      disabled={state === "saving"}
                      accessibilityRole="button"
                      accessibilityLabel={`${v} of 7`}
                      hitSlop={4}
                      style={{
                        flex: 1,
                        height: 28,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: on ? accent : color.border,
                        backgroundColor: on ? tint(accent, 0.3) : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Txt
                        variant="small"
                        c={on ? accent : color.textFaint}
                        style={{ fontSize: 11 }}
                      >
                        {v}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
              1 · not at all
            </Txt>
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
              7 · completely
            </Txt>
          </View>
        </View>
        {state === "error" ? (
          <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
            Couldn&apos;t save that. Tap any answer to try again.
          </Txt>
        ) : (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            hitSlop={8}
            style={{ marginTop: space.md }}
          >
            <Txt variant="small" c={color.textFaint}>
              Not this week
            </Txt>
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
}

// ─── Graduation ───────────────────────────────────────────────────────────────

export function GraduateCard({
  habit,
  onGraduate,
}: {
  habit: Habit;
  onGraduate: () => Promise<void>;
}) {
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  if (hidden) return null;
  const accent = categoryColor[habit.category];

  return (
    <Card accent={accent}>
      <Txt variant="bodyStrong" c={accent}>
        {done
          ? `${habit.name} graduated`
          : `${habit.name} has become automatic`}
      </Txt>
      <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
        {done
          ? "Its reminders stop and it no longer counts toward the habits you're building. Room for the next one."
          : "Your last few checks have levelled off high. Graduate it? It stays on your list; the reminders stop, and it frees a slot for something new."}
      </Txt>
      {done ? null : (
        <View
          style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}
        >
          <Pressable
            onPress={async () => {
              await onGraduate();
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              setDone(true);
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Txt variant="small" c={accent} style={{ fontWeight: "700" }}>
              Graduate it
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => setHidden(true)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Txt variant="small" c={color.textFaint}>
              Not yet
            </Txt>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

// ─── The habit page ───────────────────────────────────────────────────────────

const CELL_STYLE: Record<
  DayCell,
  { fill: (accent: string) => string; border?: boolean }
> = {
  done: { fill: (a) => a },
  minimum: { fill: (a) => tint(a, 0.45) },
  rest: { fill: () => "rgba(255,255,255,0.14)" },
  missed: { fill: () => tint(color.red, 0.45) },
  off: { fill: () => "transparent", border: true },
  future: { fill: () => "transparent", border: true },
  before: { fill: () => "transparent" },
};

/**
 * Twelve weeks at a glance, the numbers that never drop to zero after one
 * bad day, where it is on the formation arc, and the automaticity curve.
 */
export function HabitProgress({
  habit,
  showStreaks = true,
}: {
  habit: Habit;
  /** Off in Settings → Habits & streaks. */
  showStreaks?: boolean;
}) {
  const accent = categoryColor[habit.category];
  const todayKey = today();
  const scheduled = { ...habit, startDate: habit.startDate };
  const weeks = heatmap(
    {
      startDate: habit.startDate,
      isDue: (d) => isDueOn(scheduled, d, habit.history.done),
    },
    habit.history,
    todayKey,
    12,
  );
  const latest = habit.automaticity.at(-1)?.score ?? null;

  const stats = [
    {
      label: "Streak",
      value: habit.streak
        ? `${habit.streak}${habit.streakUnit === "week" ? "w" : "d"}`
        : "—",
    },
    { label: "Best", value: habit.bestStreak ? String(habit.bestStreak) : "—" },
    {
      label: "This month",
      value: habit.month.due ? `${habit.month.kept}/${habit.month.due}` : "—",
    },
    {
      label: "Kept",
      value:
        habit.consistency === null
          ? "—"
          : `${Math.round(habit.consistency * 100)}%`,
    },
  ].filter((s) => showStreaks || (s.label !== "Streak" && s.label !== "Best"));

  return (
    <View style={{ gap: space.md }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {stats.map((s) => (
            <View key={s.label} style={{ alignItems: "center", flex: 1 }}>
              <Txt variant="heading" c={accent}>
                {s.value}
              </Txt>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                {s.label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Label>Last 12 weeks</Label>
        <View style={{ flexDirection: "row", gap: 4, marginTop: space.md }}>
          {weeks.map((w) => (
            <View key={w.weekStart} style={{ flex: 1, gap: 4 }}>
              {w.days.map((d) => {
                const style = CELL_STYLE[d.cell];
                return (
                  <View
                    key={d.day}
                    accessibilityLabel={`${d.day}: ${d.cell}`}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 3,
                      backgroundColor: style.fill(accent),
                      borderWidth: style.border ? 1 : 0,
                      borderColor: color.border,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.md,
            marginTop: space.md,
          }}
        >
          {(
            [
              ["Done", accent],
              ["Tiny version", tint(accent, 0.45)],
              ["Rest", "rgba(255,255,255,0.14)"],
              ["Missed", tint(color.red, 0.45)],
            ] as const
          ).map(([label, fill]) => (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: fill,
                }}
              />
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                {label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Label>How automatic it feels</Label>
        <Txt
          variant="small"
          c={color.textMuted}
          style={{ marginTop: space.sm }}
        >
          {formationNote(habit.startDate, todayKey, latest)}
        </Txt>
        {habit.automaticity.length ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 6,
              height: 64,
              marginTop: space.md,
            }}
            accessibilityLabel={`Automaticity scores: ${habit.automaticity.map((p) => p.score).join(", ")} out of 7`}
          >
            {habit.automaticity.slice(-12).map((p) => (
              <View
                key={p.date}
                style={{
                  flex: 1,
                  height: `${(p.score / SRBAI_MAX) * 100}%`,
                  borderRadius: 3,
                  backgroundColor: tint(
                    accent,
                    0.35 + (p.score / SRBAI_MAX) * 0.6,
                  ),
                }}
              />
            ))}
          </View>
        ) : (
          <Txt
            variant="small"
            c={color.textFaint}
            style={{ marginTop: space.sm }}
          >
            A quick weekly check starts after the first week, right after you
            tick it.
          </Txt>
        )}
      </Card>
    </View>
  );
}
