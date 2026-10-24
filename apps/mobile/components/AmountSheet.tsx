/**
 * "How many?" — logging a measured habit.
 *
 * One big number with minus and plus, and two shortcuts: the tiny amount and
 * the usual one. The line under the number says what it counts as, so
 * there's never a question of whether 3 glasses "counted" — it's the tiny
 * version, and it says so before you save.
 */

import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { stateForAmount } from "@kinextion/shared";

import { Button, Chip, Txt } from "./ui";
import { color, radius, space, tint } from "../theme";

export interface AmountTarget {
  name: string;
  unit: string;
  target: number;
  tiny: number | null;
  current: number | null;
}

const stepFor = (target: number) => (target >= 2000 ? 500 : target >= 100 ? 10 : target >= 20 ? 5 : 1);
const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1));

export function AmountSheet({
  habit,
  accent,
  onSave,
  onClose,
}: {
  habit: AmountTarget | null;
  accent: string;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (habit) setValue(habit.current ?? habit.target);
  }, [habit]);
  if (!habit) return null;

  const step = stepFor(habit.target);
  const state = stateForAmount({ measureTarget: habit.target, measureTiny: habit.tiny }, value);
  const meaning =
    state === "done"
      ? "The usual version. Done."
      : state === "minimum"
        ? "The tiny version. It still counts."
        : value > 0
          ? `Saved, but it counts from ${fmt(habit.tiny ?? 1)}.`
          : "Nothing yet.";
  const bump = (delta: number) => {
    void Haptics.selectionAsync();
    setValue((v) => Math.max(0, Math.round((v + delta) * 10) / 10));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: color.scrim }} onPress={onClose} />
      <View
        style={{
          backgroundColor: color.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.xl,
          paddingBottom: space.xxxl,
          gap: space.lg,
        }}
      >
        <Txt variant="heading">{habit.name}</Txt>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xl }}>
          <RoundButton icon="remove" onPress={() => bump(-step)} />
          <View style={{ alignItems: "center", minWidth: 120 }}>
            <Txt variant="display" style={{ fontSize: 48, lineHeight: 56 }}>
              {fmt(value)}
            </Txt>
            <Txt variant="small" c={color.textMuted}>
              {habit.unit} · usual {fmt(habit.target)}
            </Txt>
          </View>
          <RoundButton icon="add" onPress={() => bump(step)} />
        </View>

        <Txt
          variant="small"
          c={state ? accent : color.textFaint}
          style={{ textAlign: "center" }}
        >
          {meaning}
        </Txt>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: space.sm }}>
          {habit.tiny ? (
            <Chip label={`Tiny: ${fmt(habit.tiny)}`} accent={accent} selected={value === habit.tiny} onPress={() => setValue(habit.tiny!)} />
          ) : null}
          <Chip label={`Usual: ${fmt(habit.target)}`} accent={accent} selected={value === habit.target} onPress={() => setValue(habit.target)} />
        </View>

        <Button label="Save" accent={accent} onPress={() => onSave(value)} />
      </View>
    </Modal>
  );
}

function RoundButton({ icon, onPress }: { icon: "add" | "remove"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tint(color.text, 0.08),
      }}
    >
      <Ionicons name={icon} size={24} color={color.text} />
    </Pressable>
  );
}
