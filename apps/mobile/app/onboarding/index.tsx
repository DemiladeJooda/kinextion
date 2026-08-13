import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInRight, Layout } from "react-native-reanimated";
import { GOAL_OPTIONS, EQUIPMENT_OPTIONS } from "@kinextion/shared";

import { AuroraBackdrop, Button, Chip, Label, Txt } from "../../components/ui";
import { color, radius, space, tint, type } from "../../theme";

/**
 * Onboarding.
 *
 * Four short steps, one question per screen. Deliberately does not ask for
 * anything sensitive up front — health conditions, medications, and history
 * are volunteered later in conversation, where the context makes it obvious
 * why the system is asking.
 */
type Step =
  | { key: "name"; kind: "text"; question: string; hint: string; placeholder: string }
  | { key: "goal"; kind: "single"; question: string; hint: string; options: readonly string[] }
  | { key: "days"; kind: "single"; question: string; hint: string; options: readonly string[] }
  | { key: "equipment"; kind: "multi"; question: string; hint: string; options: readonly string[] };

const STEPS: Step[] = [
  {
    key: "name",
    kind: "text",
    question: "What should we call you?",
    hint: "Your guides will use it — sparingly.",
    placeholder: "First name",
  },
  {
    key: "goal",
    kind: "single",
    question: "What matters most right now?",
    hint: "You can change this whenever it changes.",
    options: GOAL_OPTIONS,
  },
  {
    key: "days",
    kind: "single",
    question: "Realistically, how many days a week?",
    hint: "Answer for your actual life, not your best week.",
    options: ["1–2 days", "3–4 days", "5–6 days", "Every day"],
  },
  {
    key: "equipment",
    kind: "multi",
    question: "What do you have access to?",
    hint: "Pick everything that applies.",
    options: EQUIPMENT_OPTIONS,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<string[]>([]);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const canAdvance =
    step.kind === "text"
      ? name.trim().length > 0
      : step.kind === "single"
        ? !!single[step.key]
        : multi.length > 0;

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLast) {
      // TODO: persist the profile once the users API is wired.
      router.replace("/(tabs)" as never);
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <AuroraBackdrop accent={color.green} />

      {/* Progress */}
      <View style={{ flexDirection: "row", gap: 5, padding: space.xl }}>
        {STEPS.map((s, i) => (
          <Animated.View
            key={s.key}
            layout={Layout.springify().damping(18)}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i <= index ? color.green : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingTop: space.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step.key} entering={FadeInRight.duration(320)}>
          <Label c={color.green}>
            Step {index + 1} of {STEPS.length}
          </Label>

          <Txt variant="title" style={{ marginTop: space.md }}>
            {step.question}
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
            {step.hint}
          </Txt>

          <View style={{ marginTop: space.xxl }}>
            {step.kind === "text" ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={step.placeholder}
                placeholderTextColor={color.textFaint}
                autoFocus
                maxLength={40}
                returnKeyType="next"
                onSubmitEditing={() => canAdvance && next()}
                style={[
                  type.heading,
                  {
                    backgroundColor: color.surface,
                    borderWidth: 1,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    paddingHorizontal: space.xl,
                    paddingVertical: space.lg,
                    color: color.text,
                  },
                ]}
              />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {step.options.map((opt) => {
                  const selected =
                    step.kind === "single" ? single[step.key] === opt : multi.includes(opt);
                  return (
                    <Chip
                      key={opt}
                      label={opt}
                      accent={color.green}
                      selected={selected}
                      onPress={() => {
                        if (step.kind === "single") {
                          setSingle((p) => ({ ...p, [step.key]: opt }));
                        } else {
                          setMulti((p) =>
                            p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]
                          );
                        }
                      }}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeIn.delay(150)} style={{ gap: space.md, marginTop: space.xxl }}>
          <Button
            label={isLast ? `Let's go${name.trim() ? `, ${name.trim()}` : ""}` : "Continue"}
            onPress={next}
            disabled={!canAdvance}
            accent={color.green}
          />
          {index > 0 ? (
            <Button
              label="Back"
              variant="ghost"
              accent={color.textMuted}
              onPress={() => setIndex((i) => i - 1)}
            />
          ) : null}
        </Animated.View>

        <Txt
          variant="small"
          c={color.textFaint}
          style={{ textAlign: "center", marginTop: space.lg }}
        >
          No health questions yet. Share what you want, when it matters.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}
