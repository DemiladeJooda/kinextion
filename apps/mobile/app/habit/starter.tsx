/**
 * Pick from a short list — the starter menu for the user's goal.
 *
 * The goal comes from onboarding, so the list matches what they said
 * matters. Habits already on their list are left out.
 */

import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BUILDING_SOFT_LIMIT,
  nextMondayKey,
  starterHabitsFor,
  starterToCreateInput,
  today,
  type StarterHabit,
} from "@kinextion/shared";

import { StartChoice, StarterPicker } from "../../components/StarterPicker";
import { AuroraBackdrop, Button, ScreenHeader, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { color, space } from "../../theme";

export default function StarterScreen() {
  const api = useApi();
  const router = useRouter();
  const { habits, addHabits } = useAppState();

  const [goal, setGoal] = useState<string | null>(null);
  const [starters, setStarters] = useState<StarterHabit[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [start, setStart] = useState<"today" | "monday">("today");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const building = habits.filter((h) => h.status === "building").length;
  const room = Math.max(1, BUILDING_SOFT_LIMIT - building);
  const todayKey = today();

  useEffect(() => {
    const have = new Set(habits.map((h) => h.name.toLowerCase()));
    api
      .getMyProfile()
      .then((me) => {
        const g = me.profile?.primaryGoals?.[0] ?? null;
        setGoal(g);
        setStarters(
          starterHabitsFor(g, me.profile?.equipment ?? []).filter(
            (s) => !have.has(s.name.toLowerCase()),
          ),
        );
      })
      .catch(() => setStarters(starterHabitsFor(null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAdd = async () => {
    if (!starters) return;
    setSaving(true);
    setError(null);
    try {
      const startsOn = start === "monday" ? nextMondayKey(todayKey) : undefined;
      await addHabits(
        starters
          .filter((s) => selected.includes(s.id))
          .map((s) => starterToCreateInput(s, startsOn)),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Back past the add-habit chooser, straight to Today.
      router.dismissTo("/(tabs)/habits" as never);
    } catch {
      setError("Couldn't add those. Try again.");
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
          title: "Pick from a short list",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.green} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: space.xxxl,
          gap: space.xl,
        }}
      >
        <ScreenHeader
          title="Start small"
          subtitle={
            goal
              ? `Ready-made for "${goal}". Each one is already tiny and attached to your day.`
              : "Each one is already tiny and attached to part of your day."
          }
        />

        {starters === null ? (
          <Txt variant="small" c={color.textMuted}>
            Loading…
          </Txt>
        ) : starters.length === 0 ? (
          <Txt variant="small" c={color.textMuted}>
            You already have everything on this list. Try &quot;Suggest some for
            me&quot; instead.
          </Txt>
        ) : (
          <StarterPicker
            starters={starters}
            selected={selected}
            onChange={setSelected}
            max={room}
          />
        )}

        <StartChoice
          value={start}
          onChange={setStart}
          isMonday={nextMondayKey(todayKey) === todayKey}
        />

        {error ? (
          <Txt variant="small" c={color.red}>
            {error}
          </Txt>
        ) : null}

        <View>
          <Button
            label={
              selected.length === 0
                ? "Pick one to start"
                : `Add ${selected.length} habit${selected.length === 1 ? "" : "s"}`
            }
            icon="add"
            accent={color.green}
            loading={saving}
            disabled={selected.length === 0 || saving}
            onPress={() => void onAdd()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
