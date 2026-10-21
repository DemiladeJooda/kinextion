import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
} from "react-native-reanimated";
import {
  GOAL_OPTIONS,
  EQUIPMENT_OPTIONS,
  identitySuggestions,
  nextMondayKey,
  starterHabitsFor,
  starterToCreateInput,
  today,
} from "@kinextion/shared";
import type { FitnessLevel } from "@kinextion/shared";

import {
  AuroraBackdrop,
  Button,
  Chip,
  Label,
  Notice,
  PressCard,
  Txt,
} from "../../components/ui";
import { StartChoice, StarterPicker } from "../../components/StarterPicker";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint, type } from "../../theme";

const FITNESS_LEVELS: readonly [string, FitnessLevel][] = [
  ["New to this", "beginner"],
  ["Some experience", "intermediate"],
  ["Very experienced", "advanced"],
];

/** "1–2 days" → 2, etc. — the schema wants a single weekly number. */
const DAYS_OPTIONS = ["1–2 days", "3–4 days", "5–6 days", "Every day"] as const;
const DAYS_TO_COUNT: Record<(typeof DAYS_OPTIONS)[number], number> = {
  "1–2 days": 2,
  "3–4 days": 4,
  "5–6 days": 6,
  "Every day": 7,
};

/**
 * Onboarding.
 *
 * Short steps, one question per screen. Deliberately does not ask for
 * anything sensitive up front — health conditions, medications, and history
 * are volunteered later in conversation, where the context makes it obvious
 * why the system is asking.
 *
 * Two steps exist for the habits that follow. "Who are you becoming?" gives
 * habits an identity to attach to (Person, in Zoe Chance's 4Ps). The last
 * step offers a short starter menu for the chosen goal, so nobody leaves
 * onboarding facing an empty list and a blank form (Possibilities). Both are
 * optional.
 */
type Step =
  | {
      key: "name";
      kind: "text";
      question: string;
      hint: string;
      placeholder: string;
    }
  | {
      key: "goal";
      kind: "single";
      question: string;
      hint: string;
      options: readonly string[];
    }
  | {
      key: "fitness";
      kind: "single";
      question: string;
      hint: string;
      options: readonly string[];
    }
  | {
      key: "days";
      kind: "single";
      question: string;
      hint: string;
      options: readonly string[];
    }
  | {
      key: "equipment";
      kind: "multi";
      question: string;
      hint: string;
      options: readonly string[];
    }
  | {
      key: "lifestyle";
      kind: "lifestyle";
      question: string;
      hint: string;
      options: readonly string[];
    }
  | { key: "identity"; kind: "identity"; question: string; hint: string }
  | { key: "starter"; kind: "starter"; question: string; hint: string };

/** Lifestyle chip labels, in the order shown — mapped to preference flags at submit time. */
const LIFESTYLE_OPTIONS = [
  "I see a therapist",
  "I journal regularly",
  "I already work out",
] as const;

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
    key: "identity",
    kind: "identity",
    question: "Who are you becoming?",
    hint: "One line, in your words. Your habits will be built around it. Optional.",
  },
  {
    key: "fitness",
    kind: "single",
    question: "Where are you starting from?",
    hint: "No wrong answer — this just calibrates the first few weeks.",
    options: FITNESS_LEVELS.map(([label]) => label),
  },
  {
    key: "days",
    kind: "single",
    question: "How many days a week do you want to work on this?",
    hint: "Pick what actually fits your week, not your best week. You can always change this later.",
    options: DAYS_OPTIONS,
  },
  {
    key: "equipment",
    kind: "multi",
    question: "What do you have access to?",
    hint: "Pick everything that applies.",
    options: EQUIPMENT_OPTIONS,
  },
  {
    key: "lifestyle",
    kind: "lifestyle",
    question: "Anything already part of your life?",
    hint: "Optional — this just tells the guides what's already in motion, so they don't suggest what you're already doing.",
    options: LIFESTYLE_OPTIONS,
  },
  {
    key: "starter",
    kind: "starter",
    question: "Pick your first habits",
    hint: "Each one is already tiny and attached to part of your day. Optional — you can add your own later.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const api = useApi();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Other" free-text fallbacks — for when none of the preset options fit.
  const [showGoalOther, setShowGoalOther] = useState(false);
  const [goalOther, setGoalOther] = useState("");
  const [showEquipmentOther, setShowEquipmentOther] = useState(false);
  const [equipmentOther, setEquipmentOther] = useState("");
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [identity, setIdentity] = useState("");
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [start, setStart] = useState<"today" | "monday">("today");
  const { addHabits } = useAppState();
  const todayKey = today();

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const canAdvance =
    step.kind === "text"
      ? name.trim().length > 0
      : step.kind === "single"
        ? step.key === "goal" && showGoalOther
          ? goalOther.trim().length > 0
          : !!single[step.key]
        : step.kind === "lifestyle" ||
            step.kind === "identity" ||
            step.kind === "starter"
          ? true // optional — context, never a gate
          : multi.length > 0;

  const resolvedGoal = showGoalOther ? goalOther.trim() : single.goal;
  const starters = starterHabitsFor(resolvedGoal, multi);
  const identityGoal =
    identity.trim().length >= 3 ? identity.trim() : undefined;

  const next = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    const fitnessLevel = FITNESS_LEVELS.find(
      ([label]) => label === single.fitness,
    )?.[1];
    const daysLabel = single.days as (typeof DAYS_OPTIONS)[number] | undefined;

    if (!fitnessLevel || !daysLabel) return;

    setError(null);
    setSubmitting(true);
    try {
      await api.completeOnboarding({
        displayName: name.trim(),
        fitnessLevel,
        primaryGoals: resolvedGoal ? [resolvedGoal] : [],
        weeklyAvailability: DAYS_TO_COUNT[daysLabel],
        equipment: multi,
        identityGoal,
        preferences: {
          doesTherapy: lifestyle.includes("I see a therapist"),
          doesJournal: lifestyle.includes("I journal regularly"),
          currentlyWorkingOut: lifestyle.includes("I already work out"),
        },
      });
      // The profile is saved first, so a failure here never loses onboarding.
      const picked = starters.filter((h) => starterIds.includes(h.id));
      if (picked.length) {
        const startsOn =
          start === "monday" ? nextMondayKey(todayKey) : undefined;
        await addHabits(
          picked.map((h) => starterToCreateInput(h, startsOn)),
        ).catch(() => {});
      }
      router.replace("/(tabs)" as never);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <AuroraBackdrop accent={color.green} />

      {/* Progress */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.xl,
          paddingBottom: 0,
        }}
      >
        <Pressable
          disabled={index === 0}
          onPress={() => {
            void Haptics.selectionAsync();
            setIndex((i) => i - 1);
          }}
          hitSlop={10}
          accessibilityLabel="Previous step"
          style={{ opacity: index === 0 ? 0 : 1 }}
        >
          <Ionicons name="chevron-back" size={22} color={color.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
          {STEPS.map((s, i) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              {i <= index ? (
                <Animated.View
                  entering={FadeInLeft.duration(360)}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={[color.green, color.teal]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              ) : null}
            </View>
          ))}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: space.xl,
            paddingTop: space.xxl,
            flexGrow: 1,
          }}
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
            <Txt
              variant="small"
              c={color.textMuted}
              style={{ marginTop: space.sm }}
            >
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
              ) : step.kind === "single" ? (
                <View style={{ gap: space.sm }}>
                  {step.options.map((opt, i) => {
                    const selected = !showGoalOther && single[step.key] === opt;
                    return (
                      <Animated.View
                        key={opt}
                        entering={FadeInDown.duration(300).delay(60 + i * 40)}
                      >
                        <PressCard
                          accent={selected ? color.green : undefined}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            if (step.key === "goal") setShowGoalOther(false);
                            setSingle((p) => ({ ...p, [step.key]: opt }));
                          }}
                          haptic="none"
                          style={{
                            paddingVertical: space.lg,
                            borderColor: selected
                              ? tint(color.green, 0.55)
                              : color.border,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: space.md,
                            }}
                          >
                            <Txt variant="bodyStrong" style={{ flex: 1 }}>
                              {opt}
                            </Txt>
                            <Ionicons
                              name={
                                selected
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={22}
                              color={selected ? color.green : color.textFaint}
                            />
                          </View>
                        </PressCard>
                      </Animated.View>
                    );
                  })}

                  {/* Free-text fallback — only the goal question offers it, since
                      fitness level and weekly days are closed, calibrated scales. */}
                  {step.key === "goal" ? (
                    <Animated.View
                      entering={FadeInDown.duration(300).delay(
                        60 + step.options.length * 40,
                      )}
                    >
                      <PressCard
                        accent={showGoalOther ? color.green : undefined}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setShowGoalOther(true);
                          setSingle((p) => ({ ...p, goal: "" }));
                        }}
                        haptic="none"
                        style={{
                          paddingVertical: space.lg,
                          borderColor: showGoalOther
                            ? tint(color.green, 0.55)
                            : color.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: space.md,
                          }}
                        >
                          <Txt variant="bodyStrong" style={{ flex: 1 }}>
                            Something else
                          </Txt>
                          <Ionicons
                            name={
                              showGoalOther
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={
                              showGoalOther ? color.green : color.textFaint
                            }
                          />
                        </View>
                      </PressCard>
                      {showGoalOther ? (
                        <TextInput
                          value={goalOther}
                          onChangeText={setGoalOther}
                          placeholder="Tell us what matters most to you"
                          placeholderTextColor={color.textFaint}
                          autoFocus
                          maxLength={60}
                          returnKeyType="done"
                          style={[
                            type.body,
                            {
                              marginTop: space.sm,
                              backgroundColor: color.surface,
                              borderWidth: 1,
                              borderColor: tint(color.green, 0.4),
                              borderRadius: radius.lg,
                              paddingHorizontal: space.lg,
                              paddingVertical: space.md,
                              color: color.text,
                            },
                          ]}
                        />
                      ) : null}
                    </Animated.View>
                  ) : null}
                </View>
              ) : step.kind === "identity" ? (
                <View style={{ gap: space.md }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: color.surface,
                      borderWidth: 1,
                      borderColor: identity
                        ? tint(color.green, 0.4)
                        : color.border,
                      borderRadius: radius.lg,
                      paddingHorizontal: space.lg,
                    }}
                  >
                    <Txt variant="body" c={color.textMuted}>
                      I&apos;m{" "}
                    </Txt>
                    <TextInput
                      value={identity}
                      onChangeText={setIdentity}
                      placeholder="someone who moves every day"
                      placeholderTextColor={color.textFaint}
                      maxLength={120}
                      returnKeyType="done"
                      style={[
                        type.body,
                        {
                          flex: 1,
                          paddingVertical: space.lg,
                          color: color.text,
                        },
                      ]}
                    />
                  </View>
                  <View style={{ gap: space.sm }}>
                    {identitySuggestions(resolvedGoal).map((phrase) => (
                      <Chip
                        key={phrase}
                        label={phrase}
                        accent={color.green}
                        selected={identity === phrase}
                        onPress={() => setIdentity(phrase)}
                      />
                    ))}
                  </View>
                </View>
              ) : step.kind === "starter" ? (
                <View style={{ gap: space.xl }}>
                  <StarterPicker
                    starters={starters}
                    selected={starterIds}
                    onChange={setStarterIds}
                  />
                  <StartChoice
                    value={start}
                    onChange={setStart}
                    isMonday={nextMondayKey(todayKey) === todayKey}
                  />
                </View>
              ) : step.kind === "lifestyle" ? (
                <View style={{ gap: space.sm }}>
                  {step.options.map((opt, i) => {
                    const selected = lifestyle.includes(opt);
                    return (
                      <Animated.View
                        key={opt}
                        entering={FadeInDown.duration(300).delay(60 + i * 40)}
                      >
                        <PressCard
                          accent={selected ? color.green : undefined}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setLifestyle((p) =>
                              p.includes(opt)
                                ? p.filter((x) => x !== opt)
                                : [...p, opt],
                            );
                          }}
                          haptic="none"
                          style={{
                            paddingVertical: space.lg,
                            borderColor: selected
                              ? tint(color.green, 0.55)
                              : color.border,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: space.md,
                            }}
                          >
                            <Txt variant="bodyStrong" style={{ flex: 1 }}>
                              {opt}
                            </Txt>
                            <Ionicons
                              name={
                                selected ? "checkmark-circle" : "square-outline"
                              }
                              size={22}
                              color={selected ? color.green : color.textFaint}
                            />
                          </View>
                        </PressCard>
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: space.sm,
                    }}
                  >
                    {step.options.map((opt) => {
                      const selected = multi.includes(opt);
                      return (
                        <Chip
                          key={opt}
                          label={opt}
                          icon={selected ? "checkmark" : undefined}
                          accent={color.green}
                          selected={selected}
                          onPress={() =>
                            setMulti((p) =>
                              p.includes(opt)
                                ? p.filter((x) => x !== opt)
                                : [...p, opt],
                            )
                          }
                        />
                      );
                    })}

                    {/* Custom items already added — rendered as removable chips. */}
                    {multi
                      .filter((opt) => !step.options.includes(opt))
                      .map((opt) => (
                        <Chip
                          key={opt}
                          label={opt}
                          icon="close"
                          accent={color.green}
                          selected
                          onPress={() =>
                            setMulti((p) => p.filter((x) => x !== opt))
                          }
                        />
                      ))}

                    <Chip
                      label="Something else"
                      icon={showEquipmentOther ? "checkmark" : "add"}
                      accent={color.green}
                      selected={showEquipmentOther}
                      onPress={() => setShowEquipmentOther((s) => !s)}
                    />
                  </View>

                  {showEquipmentOther ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: space.sm,
                        marginTop: space.md,
                      }}
                    >
                      <TextInput
                        value={equipmentOther}
                        onChangeText={setEquipmentOther}
                        placeholder="e.g. Resistance bands"
                        placeholderTextColor={color.textFaint}
                        maxLength={40}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const val = equipmentOther.trim();
                          if (val && !multi.includes(val))
                            setMulti((p) => [...p, val]);
                          setEquipmentOther("");
                        }}
                        style={[
                          type.body,
                          {
                            flex: 1,
                            backgroundColor: color.surface,
                            borderWidth: 1,
                            borderColor: tint(color.green, 0.4),
                            borderRadius: radius.lg,
                            paddingHorizontal: space.lg,
                            paddingVertical: space.md,
                            color: color.text,
                          },
                        ]}
                      />
                      <Pressable
                        onPress={() => {
                          const val = equipmentOther.trim();
                          if (val && !multi.includes(val))
                            setMulti((p) => [...p, val]);
                          setEquipmentOther("");
                        }}
                        disabled={!equipmentOther.trim()}
                        style={{
                          width: 48,
                          borderRadius: radius.lg,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: equipmentOther.trim()
                            ? tint(color.green, 0.18)
                            : "transparent",
                          borderWidth: 1,
                          borderColor: equipmentOther.trim()
                            ? tint(color.green, 0.5)
                            : color.border,
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={
                            equipmentOther.trim()
                              ? color.green
                              : color.textFaint
                          }
                        />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </Animated.View>

          <View style={{ flex: 1 }} />

          {error ? <Notice>{error}</Notice> : null}

          <Animated.View
            entering={FadeIn.delay(150)}
            style={{ gap: space.md, marginTop: space.xxl }}
          >
            <Button
              label={
                isLast
                  ? `Let's go${name.trim() ? `, ${name.trim()}` : ""}`
                  : "Continue"
              }
              onPress={next}
              loading={submitting}
              disabled={!canAdvance || submitting}
              accent={color.green}
            />
          </Animated.View>

          <Txt
            variant="small"
            c={color.textFaint}
            style={{ textAlign: "center", marginTop: space.lg }}
          >
            No health questions yet. Share what you want, when it matters.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
