/**
 * Edit a habit, or retire it.
 *
 * Retiring archives rather than deletes. The distinction matters: someone who
 * kept a habit for three weeks and then stopped has three weeks of history
 * worth keeping, and a delete would take the streak, the completion rate and
 * the therapist report's view of that period with it. Archiving removes the
 * habit from today and from the score's denominator, and leaves the past
 * exactly as it was.
 */

import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { DisplayFields, PolishedField } from "@kinextion/shared";
import { HabitProgress } from "../../components/ProgressCards";
import {
  HabitForm,
  toCreateInput,
  type HabitFormValues,
} from "../../components/HabitForm";
import {
  AuroraBackdrop,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useAppState } from "../../lib/store";
import { categoryColor, color, space } from "../../theme";

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { habits, editHabit, archiveHabit, showStreaks } = useAppState();

  const habit = habits.find((h) => h.id === id);

  const [values, setValues] = useState<HabitFormValues | null>(
    habit
      ? {
          name: habit.name,
          category: habit.category,
          cue: habit.cue ?? "",
          craving: habit.craving ?? "",
          response: habit.response ?? "",
          reward: habit.reward ?? "",
          frequency:
            (habit.frequency as HabitFormValues["frequency"]) ?? "daily",
          targetDays: habit.targetDays ?? [],
          perWeekTarget: habit.perWeekTarget ?? 1,
          timeWindow: habit.timeWindow,
          fullVersion: habit.fullVersion ?? "",
          backupPlan: habit.backupPlan ?? "",
          pairWith: habit.pairWith ?? "",
          start: "today",
          reminderEnabled: habit.reminderEnabled,
        }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const header = (
    <Stack.Screen
      options={{
        title: "Edit habit",
        headerStyle: { backgroundColor: color.bg },
        headerShadowVisible: false,
        headerTintColor: color.text,
        headerBackTitle: "Back",
      }}
    />
  );

  if (!habit || !values) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: color.bg }}
        edges={["bottom"]}
      >
        {header}
        <View style={{ padding: space.xl }}>
          <EmptyState
            icon="help-circle-outline"
            title="Habit not found"
            body="It may have been archived. Pull to refresh on the habits tab."
          />
        </View>
      </SafeAreaView>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await editHabit(habit.id, toCreateInput(values));
      router.back();
    } catch {
      setError("Couldn't save those changes. Try again.");
      setSaving(false);
    }
  };

  const onArchive = () => {
    Alert.alert(
      `Retire "${habit.name}"?`,
      "It comes off today's list and stops counting toward your score. Your logs and streak history are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retire",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await archiveHabit(habit.id);
                router.back();
              } catch {
                setError("Couldn't retire that habit. Try again.");
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["bottom"]}
    >
      {header}
      <AuroraBackdrop accent={categoryColor[habit.category]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: space.xxxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title={habit.name}
            subtitle={habitSummary(habit, showStreaks)}
          />

          <View style={{ marginBottom: space.xxl }}>
            <HabitProgress habit={habit} showStreaks={showStreaks} />
          </View>

          <HabitForm
            readings={readingsOf(habit)}
            values={values}
            onChange={setValues}
            onSubmit={() => void onSave()}
            submitLabel="Save changes"
            saving={saving}
            error={error}
          />

          <Card style={{ marginTop: space.xxl }}>
            <View
              style={{
                flexDirection: "row",
                gap: space.md,
                marginBottom: space.lg,
              }}
            >
              <Ionicons
                name="archive-outline"
                size={18}
                color={color.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Done with this one?</Txt>
                <Txt
                  variant="small"
                  c={color.textMuted}
                  style={{ marginTop: 3 }}
                >
                  Retiring keeps every log you&apos;ve made — it just stops
                  asking you about it.
                </Txt>
              </View>
            </View>
            <Button
              label="Retire habit"
              variant="secondary"
              accent={color.red}
              icon="archive-outline"
              onPress={onArchive}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * "Best 23 · 18 of 22 this month" rather than a bare streak: the month count
 * never drops to zero after one bad day, so it's the number that keeps
 * someone going when the streak just reset.
 */
function habitSummary(
  habit: {
    streak: number;
    bestStreak: number;
    streakUnit: "day" | "week";
    month: { kept: number; due: number };
  },
  showStreaks = true,
): string {
  const unit = habit.streakUnit === "week" ? "week" : "day";
  const parts: string[] = [];
  if (showStreaks && habit.streak > 0)
    parts.push(`${habit.streak}-${unit} streak`);
  if (showStreaks && habit.bestStreak > habit.streak)
    parts.push(`best ${habit.bestStreak}`);
  if (habit.month.due > 0)
    parts.push(`${habit.month.kept} of ${habit.month.due} this month`);
  return parts.length
    ? `${parts.join(" · ")}. Changes won't reset it.`
    : "Shrink it until it's easy. That's usually the fix.";
}

/** The AI's reading of each field it tidied, with the text it came from. */
function readingsOf(habit: {
  cue: string;
  response: string | null;
  craving: string | null;
  backupPlan: string | null;
  display: DisplayFields;
}) {
  const raw: Record<PolishedField, string> = {
    cue: habit.cue ?? "",
    response: habit.response ?? "",
    craving: habit.craving ?? "",
    backupPlan: habit.backupPlan ?? "",
  };
  return Object.fromEntries(
    habit.display.polishedByAi.map((f) => [
      f,
      { from: raw[f], text: habit.display[f] },
    ]),
  ) as Partial<Record<PolishedField, { from: string; text: string }>>;
}
