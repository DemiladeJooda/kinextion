/**
 * The habit builder.
 *
 * Shared by "new habit" and "edit habit" so the two can't drift apart. The
 * shape follows the Atomic Habits loop the schema has always had room for —
 * cue, craving, response, reward — but only the name, category and frequency
 * are required. The loop is offered as an optional second step rather than a
 * wall of fields, because a habit you can't be bothered to finish creating is
 * worse than a habit with three empty columns.
 */

import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { HABIT_CATEGORY_HINTS, WELLNESS_CATEGORIES, WELLNESS_LABELS } from "@kinextion/shared";
import type { CreateHabitInput } from "@kinextion/shared";

import { Button, Card, Chip, Field, Label, PressCard, Txt } from "./ui";
import { categoryColor, color, radius, space, tint, type Category } from "../theme";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export interface HabitFormValues {
  name: string;
  category: Category;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  frequency: "daily" | "weekly" | "custom";
  targetDays: number[];
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
  };
}

export function HabitForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
}: {
  values: HabitFormValues;
  onChange: (next: HabitFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving?: boolean;
  error?: string | null;
}) {
  // Open by default when the user has already filled part of the loop, so
  // editing never hides content behind a collapsed section.
  const [showLoop, setShowLoop] = useState(
    Boolean(values.cue || values.craving || values.response || values.reward)
  );

  const accent = categoryColor[values.category];
  const set = <K extends keyof HabitFormValues>(key: K, value: HabitFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const canSubmit = values.name.trim().length > 0 && !saving;

  return (
    <View style={{ gap: space.xl }}>
      <Card accent={accent}>
        <View style={{ gap: space.lg }}>
          <Field
            label="The habit"
            value={values.name}
            onChangeText={(v) => set("name", v)}
            placeholder="10-minute walk"
            maxLength={100}
            accent={accent}
            hint="Name it as the thing you do, not the outcome you want."
          />

          <View style={{ gap: space.sm }}>
            <Label>Category</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
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

          <View style={{ gap: space.sm }}>
            <Label>How often</Label>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {(["daily", "weekly", "custom"] as const).map((f) => (
                <Chip
                  key={f}
                  label={f === "custom" ? "Certain days" : f === "daily" ? "Every day" : "Weekly"}
                  accent={accent}
                  selected={values.frequency === f}
                  onPress={() => set("frequency", f)}
                />
              ))}
            </View>

            {values.frequency === "custom" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.sm }}>
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
                              : [...values.targetDays, index].sort()
                          );
                        }}
                        style={{
                          flex: 1,
                          padding: 0,
                          paddingVertical: space.md,
                          alignItems: "center",
                          backgroundColor: on ? tint(accent, 0.16) : "transparent",
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
          </View>
        </View>
      </Card>

      {/* ── The Atomic Habits loop, optional ─────────────────────────────── */}
      <PressCard haptic="light" onPress={() => setShowLoop((v) => !v)} style={{ padding: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Ionicons name="repeat" size={18} color={color.amber} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Make it stick</Txt>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
              Cue, craving, response, reward. Optional, but it's what makes one hold.
            </Txt>
          </View>
          <Ionicons
            name={showLoop ? "chevron-up" : "chevron-down"}
            size={18}
            color={color.textFaint}
          />
        </View>
      </PressCard>

      {showLoop ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <Card>
            <View style={{ gap: space.lg }}>
              <Field
                label="Cue — when"
                value={values.cue}
                onChangeText={(v) => set("cue", v)}
                placeholder="After I put the kettle on"
                maxLength={200}
                accent={accent}
                hint="Anchor it to something already in your day."
              />
              <Field
                label="Craving — why you'd want to"
                value={values.craving}
                onChangeText={(v) => set("craving", v)}
                placeholder="I think more clearly after moving"
                maxLength={200}
                accent={accent}
              />
              <Field
                label="Response — the two-minute version"
                value={values.response}
                onChangeText={(v) => set("response", v)}
                placeholder="Shoes on, to the end of the road"
                maxLength={200}
                accent={accent}
                hint="Small enough to do on your worst day."
              />
              <Field
                label="Reward — the payoff today"
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

      {error ? (
        <Txt variant="small" c={color.red}>
          {error}
        </Txt>
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
