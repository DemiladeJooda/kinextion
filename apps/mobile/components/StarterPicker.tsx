/**
 * The starter menu, as cards to tap.
 *
 * Shown at the end of onboarding and behind "Pick from a short list" on the
 * add-habit screen. Each card is a whole plan already ("After I pour my
 * coffee, I'll do 2 push-ups"), so choosing is the only work left. Up to
 * three can be picked: three being built at once is plenty, and that's a
 * design judgement rather than a study.
 */

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  BUILDING_SOFT_LIMIT,
  describeHabitPlan,
  type StarterHabit,
} from "@kinextion/shared";

import { Chip, Label, PressCard, Txt } from "./ui";
import { categoryColor, color, space, tint, type Category } from "../theme";

export function StarterPicker({
  starters,
  selected,
  onChange,
  max = BUILDING_SOFT_LIMIT,
}: {
  starters: StarterHabit[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const full = selected.length >= max;

  return (
    <View style={{ gap: space.md }}>
      {starters.map((h, i) => {
        const on = selected.includes(h.id);
        const accent = categoryColor[h.category as Category];
        const { plan } = describeHabitPlan({
          name: h.name,
          cue: h.anchor,
          response: h.tiny,
        });
        return (
          <Animated.View
            key={h.id}
            entering={FadeInDown.duration(300).delay(40 + i * 40)}
          >
            <PressCard
              haptic="none"
              accent={on ? accent : undefined}
              disabled={!on && full}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(
                  on
                    ? selected.filter((id) => id !== h.id)
                    : [...selected, h.id],
                );
              }}
              style={{
                padding: space.lg,
                opacity: !on && full ? 0.45 : 1,
                borderColor: on ? tint(accent, 0.55) : color.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: space.md,
                  alignItems: "flex-start",
                }}
              >
                <Ionicons
                  name={on ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={on ? accent : color.textFaint}
                  style={{ marginTop: 1 }}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt variant="bodyStrong">{h.name}</Txt>
                  <Txt variant="small" c={color.textMuted}>
                    {plan}
                  </Txt>
                  <Txt variant="small" c={accent} style={{ fontSize: 12 }}>
                    {h.why}
                  </Txt>
                </View>
              </View>
            </PressCard>
          </Animated.View>
        );
      })}
      <Txt variant="small" c={color.textFaint}>
        {full
          ? `${max} is plenty to build at once. You can add more once these feel automatic.`
          : "Pick up to three. You can change any of them later."}
      </Txt>
    </View>
  );
}

/** "Start today" / "Monday · a fresh start", hidden on a Monday. */
export function StartChoice({
  value,
  onChange,
  isMonday,
}: {
  value: "today" | "monday";
  onChange: (v: "today" | "monday") => void;
  isMonday: boolean;
}) {
  if (isMonday) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Label>Start</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Chip
          label="Today"
          accent={color.green}
          selected={value === "today"}
          onPress={() => onChange("today")}
        />
        <Chip
          label="Monday · a fresh start"
          accent={color.green}
          selected={value === "monday"}
          onPress={() => onChange("monday")}
        />
      </View>
    </View>
  );
}
