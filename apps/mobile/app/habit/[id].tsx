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
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { HabitForm, toCreateInput, type HabitFormValues } from "../../components/HabitForm";
import { AuroraBackdrop, Button, Card, EmptyState, ScreenHeader, Txt } from "../../components/ui";
import { useAppState } from "../../lib/store";
import { categoryColor, color, space } from "../../theme";

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { habits, editHabit, archiveHabit } = useAppState();

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
          frequency: (habit.frequency as HabitFormValues["frequency"]) ?? "daily",
          targetDays: habit.targetDays ?? [],
        }
      : null
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
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
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
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
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
            subtitle={
              habit.streak > 0
                ? `${habit.streak}-day streak running. Changes won't reset it.`
                : "Shrink it until it's easy. That's usually the fix."
            }
          />

          <HabitForm
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
              <Ionicons name="archive-outline" size={18} color={color.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Done with this one?</Txt>
                <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                  Retiring keeps every log you&apos;ve made — it just stops asking you about it.
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
