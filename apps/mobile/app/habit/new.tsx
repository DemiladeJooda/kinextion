/**
 * New habit — the chooser, and the blank form.
 *
 * Three ways in, because "type the name of a habit" only works if you already
 * know what you want. Most people don't; they know their day is a mess and
 * they'd like it to be less of one. Two of the three routes start from what
 * Kinextion already knows rather than from an empty text field.
 *
 * The form lives inline rather than on its own route so "from scratch" doesn't
 * add a second screen to back out of.
 */

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  HabitForm,
  emptyHabitForm,
  toCreateInput,
  type HabitFormValues,
} from "../../components/HabitForm";
import { AuroraBackdrop, PressCard, ScreenHeader, Txt } from "../../components/ui";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint } from "../../theme";

export default function NewHabitScreen() {
  const router = useRouter();
  const { addHabit, habits } = useAppState();

  const [mode, setMode] = useState<"choose" | "build">("choose");
  const [values, setValues] = useState<HabitFormValues>(emptyHabitForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await addHabit(toCreateInput(values));
      router.back();
    } catch {
      setError("Couldn't save that habit. Try again.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: mode === "build" ? "New habit" : "Add a habit",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.amber} />

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
          {mode === "choose" ? (
            <>
              <ScreenHeader
                title="Add a habit"
                subtitle={
                  habits.length === 0
                    ? "Start with one. One kept beats five abandoned."
                    : `You're running ${habits.length}. Four or five is usually plenty.`
                }
              />

              <View style={{ gap: space.md }}>
                <Animated.View entering={FadeInDown.duration(400)}>
                  <RouteCard
                    icon="sparkles"
                    accent={color.purple}
                    title="Suggest some for me"
                    body="Reads your goals, what's working, your check-ins and anything you've connected — then proposes a few with the reason for each."
                    onPress={() => router.push("/habit/suggest" as never)}
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(70)}>
                  <RouteCard
                    icon="mic"
                    accent={color.teal}
                    title="Talk it through"
                    body="Describe your day out loud — tap the mic on your keyboard — and it'll ask a couple of questions, then draft habits that fit round it."
                    onPress={() => router.push("/habit/discover" as never)}
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(140)}>
                  <RouteCard
                    icon="create-outline"
                    accent={color.amber}
                    title="I know what I want"
                    body="Straight to the form. Name it, pick how often, and add the cue and reward if you want it to stick."
                    onPress={() => setMode("build")}
                  />
                </Animated.View>
              </View>
            </>
          ) : (
            <>
              <ScreenHeader
                title="New habit"
                subtitle="Only the name is required. Everything else makes it more likely to hold."
              />
              <HabitForm
                values={values}
                onChange={setValues}
                onSubmit={() => void onSave()}
                submitLabel="Create habit"
                saving={saving}
                error={error}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RouteCard({
  icon,
  accent,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <PressCard accent={accent} onPress={onPress}>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: tint(accent, 0.14),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={21} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" c={accent}>
            {title}
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
            {body}
          </Txt>
        </View>
      </View>
    </PressCard>
  );
}
