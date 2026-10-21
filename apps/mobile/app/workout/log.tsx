/**
 * Log a workout in three taps.
 *
 * Built for someone who just finished training and is standing in a locker
 * room: pick what kind, keep or change the length, save. Sets and reps can
 * come later; a workout that never gets logged because the form wanted them
 * is the failure this screen exists to prevent.
 *
 * Defaults carry the weight. The length starts at 30 minutes, the most common
 * answer, so the shortest path is type → Save.
 */

import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  Label,
  PressCard,
  Txt,
} from "../../components/ui";
import { useAppState } from "../../lib/store";
import type { LogWorkoutInput } from "../../services";
import { color, radius, space, tint } from "../../theme";

const TYPES: Array<{
  type: LogWorkoutInput["type"];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
}> = [
  {
    type: "strength",
    label: "Strength",
    icon: "barbell-outline",
    name: "Strength session",
  },
  { type: "cardio", label: "Cardio", icon: "heart-outline", name: "Cardio" },
  {
    type: "mobility",
    label: "Mobility",
    icon: "body-outline",
    name: "Mobility",
  },
  {
    type: "mixed",
    label: "Mixed",
    icon: "shuffle-outline",
    name: "Mixed session",
  },
];

const DURATIONS = [10, 20, 30, 45, 60, 90];

const EFFORT: Array<{
  value: NonNullable<LogWorkoutInput["difficulty"]>;
  label: string;
}> = [
  { value: "too_easy", label: "Easy" },
  { value: "just_right", label: "Just right" },
  { value: "too_hard", label: "Too hard" },
];

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { logWorkout, workoutLogged } = useAppState();

  const [type, setType] = useState<LogWorkoutInput["type"] | null>(null);
  const [duration, setDuration] = useState(30);
  const [difficulty, setDifficulty] = useState<LogWorkoutInput["difficulty"]>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    const picked = TYPES.find((t) => t.type === type);
    if (!picked) return;
    setSaving(true);
    setError(null);
    try {
      await logWorkout({
        name: picked.name,
        type: picked.type,
        duration,
        difficulty,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("Couldn't save that workout. Try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          title: "Log a workout",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.green} />

      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
        {workoutLogged ? (
          <Txt variant="small" c={color.textMuted}>
            You&apos;ve already logged one today. A second session counts too.
          </Txt>
        ) : null}

        <View style={{ gap: space.sm }}>
          <Label>What kind</Label>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}
          >
            {TYPES.map((t) => {
              const on = type === t.type;
              return (
                <PressCard
                  key={t.type}
                  haptic="medium"
                  accent={on ? color.green : undefined}
                  onPress={() => setType(t.type)}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    paddingVertical: space.lg,
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: on ? tint(color.green, 0.12) : undefined,
                    borderColor: on ? tint(color.green, 0.4) : undefined,
                    borderRadius: radius.md,
                  }}
                >
                  <Ionicons
                    name={t.icon}
                    size={24}
                    color={on ? color.green : color.textMuted}
                  />
                  <Txt variant="bodyStrong" c={on ? color.green : color.text}>
                    {t.label}
                  </Txt>
                </PressCard>
              );
            })}
          </View>
        </View>

        <Card>
          <View style={{ gap: space.lg }}>
            <View style={{ gap: space.sm }}>
              <Label>How long</Label>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                }}
              >
                {DURATIONS.map((d) => (
                  <Chip
                    key={d}
                    label={`${d} min`}
                    accent={color.green}
                    selected={duration === d}
                    onPress={() => setDuration(d)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: space.sm }}>
              <Label>How did it feel? (optional)</Label>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                }}
              >
                {EFFORT.map((e) => (
                  <Chip
                    key={e.value}
                    label={e.label}
                    accent={color.teal}
                    selected={difficulty === e.value}
                    onPress={() =>
                      setDifficulty(
                        difficulty === e.value ? undefined : e.value,
                      )
                    }
                  />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
                Altheo uses this to pitch your next session.
              </Txt>
            </View>
          </View>
        </Card>

        {error ? (
          <Txt variant="small" c={color.red}>
            {error}
          </Txt>
        ) : null}

        <Button
          label={
            type ? `Save ${duration}-minute session` : "Pick what kind first"
          }
          icon="checkmark"
          accent={color.green}
          loading={saving}
          disabled={!type || saving}
          onPress={onSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
