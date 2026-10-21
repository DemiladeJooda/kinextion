/**
 * The habit builder.
 *
 * Shared by "new habit" and "edit habit" so the two can't drift apart. It
 * walks the steps that make a habit hold, in order, one card each:
 *
 *   1. What        the habit, and which part of life it belongs to
 *   2. After I…    the anchor: an existing moment it attaches to, and a
 *                  window of the day (a window, never a minute — flexible
 *                  timing keeps habits going better than a rigid slot)
 *   3. Tiny        the version small enough for the worst day; required for
 *                  new habits, because it's what keeps a streak alive
 *   4. How often   every day, certain days, or a number of times a week
 *   5. Why         in the user's words, so it can be played back to them
 *
 * Extras (a backup plan, something to pair it with, the payoff) sit behind
 * one optional fold. A live preview writes the plan out as a sentence —
 * "After I pour my coffee, I'll do 2 push-ups." — because stating the plan
 * in full is the implementation intention itself.
 *
 * The four loop fields keep their database names (cue = anchor, response =
 * tiny version, craving = why, reward = payoff); the UI never uses them.
 */

import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  HABIT_CATEGORY_HINTS,
  WELLNESS_CATEGORIES,
  WELLNESS_LABELS,
  describeHabitPlan,
  nextMondayKey,
  today,
} from "@kinextion/shared";
import type { CreateHabitInput } from "@kinextion/shared";

import { Button, Card, Chip, Field, Label, PressCard, Txt } from "./ui";
import {
  categoryColor,
  color,
  radius,
  space,
  tint,
  type Category,
} from "../theme";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Moments most days already have. Tapping one fills the anchor field. */
const ANCHORS = [
  "After I wake up",
  "After I pour my coffee",
  "After I brush my teeth",
  "When I get to work",
  "After lunch",
  "When I get home",
  "After I get into bed",
];

const WINDOWS: Array<{ value: HabitFormValues["timeWindow"]; label: string }> =
  [
    { value: "morning", label: "Morning" },
    { value: "midday", label: "Midday" },
    { value: "evening", label: "Evening" },
    { value: "anytime", label: "Any time" },
  ];

export interface HabitFormValues {
  name: string;
  category: Category;
  /** The anchor: "After I …". */
  cue: string;
  /** Why it matters, in their words. */
  craving: string;
  /** The tiny version. */
  response: string;
  /** Today's payoff. */
  reward: string;
  frequency: "daily" | "weekly" | "custom";
  targetDays: number[];
  perWeekTarget: number;
  timeWindow: "morning" | "midday" | "evening" | "anytime";
  fullVersion: string;
  backupPlan: string;
  pairWith: string;
  /** New habits only: start today, or on the coming Monday. */
  start: "today" | "monday";
}

export function emptyHabitForm(): HabitFormValues {
  return {
    name: "",
    category: "physical",
    cue: "",
    craving: "",
    response: "",
    reward: "",
    frequency: "daily",
    targetDays: [],
    perWeekTarget: 3,
    timeWindow: "anytime",
    fullVersion: "",
    backupPlan: "",
    pairWith: "",
    start: "today",
  };
}

/** Strip empty optional fields — the API would rather have them absent. */
export function toCreateInput(values: HabitFormValues): CreateHabitInput {
  const trimmed = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    name: values.name.trim(),
    category: values.category,
    cue: trimmed(values.cue),
    craving: trimmed(values.craving),
    response: trimmed(values.response),
    reward: trimmed(values.reward),
    frequency: values.frequency,
    targetDays: values.frequency === "custom" ? values.targetDays : undefined,
    perWeekTarget:
      values.frequency === "weekly" ? values.perWeekTarget : undefined,
    timeWindow: values.timeWindow,
    fullVersion: trimmed(values.fullVersion),
    backupPlan: trimmed(values.backupPlan),
    pairWith: trimmed(values.pairWith),
    startsOn: values.start === "monday" ? nextMondayKey(today()) : undefined,
  };
}

export function HabitForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
  isNew = false,
}: {
  values: HabitFormValues;
  onChange: (next: HabitFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving?: boolean;
  error?: string | null;
  /** New habits require a tiny version and can start on Monday. Existing
   *  ones built before the tiny version existed can still be saved. */
  isNew?: boolean;
}) {
  // Open by default when the user has already filled an extra, so editing
  // never hides content behind a collapsed section.
  const [showExtras, setShowExtras] = useState(
    Boolean(values.backupPlan || values.pairWith || values.reward),
  );

  const accent = categoryColor[values.category];
  const set = <K extends keyof HabitFormValues>(
    key: K,
    value: HabitFormValues[K],
  ) => onChange({ ...values, [key]: value });

  const isMonday = nextMondayKey(today()) === today();
  const missingTiny = isNew && values.response.trim().length === 0;
  const canSubmit = values.name.trim().length > 0 && !missingTiny && !saving;
  const preview = describeHabitPlan(values);

  return (
    <View style={{ gap: space.lg }}>
      {/* ── 1. What ─────────────────────────────────────────────────── */}
      <Card accent={accent}>
        <View style={{ gap: space.lg }}>
          <Field
            label="The habit"
            value={values.name}
            onChangeText={(v) => set("name", v)}
            placeholder="Push-ups"
            maxLength={100}
            accent={accent}
            hint="Name it as the thing you do, not the outcome you want."
          />
          <View style={{ gap: space.sm }}>
            <Label>Part of life</Label>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {WELLNESS_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={WELLNESS_LABELS[c]}
                  accent={categoryColor[c as Category]}
                  selected={values.category === c}
                  onPress={() => set("category", c as Category)}
                />
              ))}
            </View>
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
              {HABIT_CATEGORY_HINTS[values.category]}
            </Txt>
          </View>
        </View>
      </Card>

      {/* ── 2. After I… ─────────────────────────────────────────────── */}
      <Card>
        <View style={{ gap: space.md }}>
          <Field
            label="When does it happen?"
            value={values.cue}
            onChangeText={(v) => set("cue", v)}
            placeholder="After I pour my coffee"
            maxLength={200}
            accent={accent}
            hint="Attach it to something you already do every day."
          />
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {ANCHORS.map((a) => (
              <Chip
                key={a}
                label={a}
                accent={accent}
                selected={values.cue === a}
                onPress={() => set("cue", a)}
              />
            ))}
          </View>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Label>Part of the day</Label>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {WINDOWS.map((w) => (
                <Chip
                  key={w.value}
                  label={w.label}
                  accent={accent}
                  selected={values.timeWindow === w.value}
                  onPress={() => set("timeWindow", w.value)}
                />
              ))}
            </View>
          </View>
        </View>
      </Card>

      {/* ── 3. Tiny version ────────────────────────────────────────── */}
      <Card>
        <View style={{ gap: space.md }}>
          <Field
            label={
              isNew ? "The tiny version" : "The tiny version (recommended)"
            }
            value={values.response}
            onChangeText={(v) => set("response", v)}
            placeholder="2 push-ups"
            maxLength={200}
            accent={accent}
            hint="Small enough to do on your worst day. Doing it keeps your streak."
          />
          <Field
            label="The full version (optional)"
            value={values.fullVersion}
            onChangeText={(v) => set("fullVersion", v)}
            placeholder="3 sets of 10"
            maxLength={200}
            accent={accent}
          />
        </View>
      </Card>

      {/* ── 4. How often ───────────────────────────────────────────── */}
      <Card>
        <View style={{ gap: space.sm }}>
          <Label>How often</Label>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {(
              [
                ["daily", "Every day"],
                ["custom", "Certain days"],
                ["weekly", "Times a week"],
              ] as const
            ).map(([f, label]) => (
              <Chip
                key={f}
                label={label}
                accent={accent}
                selected={values.frequency === f}
                onPress={() => set("frequency", f)}
              />
            ))}
          </View>

          {values.frequency === "custom" ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <View
                style={{
                  flexDirection: "row",
                  gap: space.xs,
                  marginTop: space.sm,
                }}
              >
                {DAY_LABELS.map((label, index) => {
                  const on = values.targetDays.includes(index);
                  return (
                    <PressCard
                      key={index}
                      haptic="none"
                      onPress={() => {
                        void Haptics.selectionAsync();
                        set(
                          "targetDays",
                          on
                            ? values.targetDays.filter((d) => d !== index)
                            : [...values.targetDays, index].sort(),
                        );
                      }}
                      style={{
                        flex: 1,
                        padding: 0,
                        paddingVertical: space.md,
                        alignItems: "center",
                        backgroundColor: on
                          ? tint(accent, 0.16)
                          : "transparent",
                        borderColor: on ? tint(accent, 0.4) : color.border,
                        borderRadius: radius.sm,
                        shadowOpacity: 0,
                        elevation: 0,
                      }}
                    >
                      <Txt variant="small" c={on ? accent : color.textFaint}>
                        {label}
                      </Txt>
                    </PressCard>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {values.frequency === "weekly" ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{ gap: space.sm, marginTop: space.sm }}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Chip
                    key={n}
                    label={n === 1 ? "Once" : `${n} times`}
                    accent={accent}
                    selected={values.perWeekTarget === n}
                    onPress={() => set("perWeekTarget", n)}
                  />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
                Any days that suit you. It leaves your list once the week&apos;s
                done.
              </Txt>
            </Animated.View>
          ) : null}
        </View>
      </Card>

      {/* ── 5. Why ─────────────────────────────────────────────────── */}
      <Card>
        <Field
          label="Why does this matter to you?"
          value={values.craving}
          onChangeText={(v) => set("craving", v)}
          placeholder="I think more clearly after moving"
          maxLength={200}
          accent={accent}
          hint="In your words. Kinextion will remind you of it on the days it's hard."
        />
      </Card>

      {/* ── Extras, optional ───────────────────────────────────────── */}
      <PressCard
        haptic="light"
        onPress={() => setShowExtras((v) => !v)}
        style={{ padding: space.lg }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <Ionicons name="sparkles-outline" size={18} color={color.amber} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Make it stick</Txt>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
              A backup plan, something to pair it with, the payoff. All
              optional.
            </Txt>
          </View>
          <Ionicons
            name={showExtras ? "chevron-up" : "chevron-down"}
            size={18}
            color={color.textFaint}
          />
        </View>
      </PressCard>

      {showExtras ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <Card>
            <View style={{ gap: space.lg }}>
              <Field
                label="If something gets in the way"
                value={values.backupPlan}
                onChangeText={(v) => set("backupPlan", v)}
                placeholder="If I get home late, I'll do the tiny version before dinner"
                maxLength={300}
                accent={accent}
                hint="Plan for the most likely obstacle now, so you don't have to think later."
              />
              <Field
                label="Pair it with"
                value={values.pairWith}
                onChangeText={(v) => set("pairWith", v)}
                placeholder="Only listen to my podcast on the walk"
                maxLength={200}
                accent={accent}
              />
              <Field
                label="Today's payoff"
                value={values.reward}
                onChangeText={(v) => set("reward", v)}
                placeholder="Coffee when I get back"
                maxLength={200}
                accent={accent}
              />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Start ──────────────────────────────────────────────────── */}
      {isNew && !isMonday ? (
        <View style={{ gap: space.sm }}>
          <Label>Start</Label>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            <Chip
              label="Today"
              accent={accent}
              selected={values.start === "today"}
              onPress={() => set("start", "today")}
            />
            <Chip
              label="Monday · a fresh start"
              accent={accent}
              selected={values.start === "monday"}
              onPress={() => set("start", "monday")}
            />
          </View>
        </View>
      ) : null}

      {/* ── Preview: the plan, written out ─────────────────────────── */}
      {values.name.trim() ? (
        <Card accent={accent}>
          <Label c={accent}>Your plan</Label>
          <Txt variant="bodyStrong" style={{ marginTop: space.sm }}>
            {preview.plan}
          </Txt>
          {preview.extras.map((line) => (
            <Txt
              key={line}
              variant="small"
              c={color.textMuted}
              style={{ marginTop: 3 }}
            >
              {line}
            </Txt>
          ))}
        </Card>
      ) : null}

      {error ? (
        <Txt variant="small" c={color.red}>
          {error}
        </Txt>
      ) : null}

      {missingTiny && values.name.trim() ? (
        <Pressable
          onPress={() => set("response", values.name.trim())}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Txt variant="small" c={color.textMuted}>
            Add a tiny version to save it. Not sure? Tap here to use the habit
            itself for now.
          </Txt>
        </Pressable>
      ) : null}

      <Button
        label={submitLabel}
        accent={accent}
        loading={saving}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </View>
  );
}
