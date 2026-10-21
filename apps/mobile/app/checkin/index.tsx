/**
 * The daily check-in.
 *
 * Everything the MoodEntry model has always held and nothing ever asked for:
 * mood, energy, stress, tags, gratitude, journal. Only mood is required — the
 * rest is offered in descending order of effort, so a ten-second check-in and
 * a five-minute one are both complete answers rather than one being a failure
 * to finish the other.
 *
 * Journal and gratitude are what earn the score's reflection component, and
 * they're the material Kairo works from. They're also the most sensitive
 * fields in the product: both are redacted server-side before anything is
 * logged, and both stay on the user's own account unless they explicitly opt
 * a therapist into the journal category.
 *
 * Dictation is the keyboard's own mic key. No audio is recorded by the app and
 * none is sent anywhere for transcription.
 */

import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { CHECKIN_TAGS, MAX_CHECKIN_TAGS } from "@kinextion/shared";

import {
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  Field,
  Label,
  Notice,
  PressCard,
  Scale,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint } from "../../theme";

const MOODS = [
  { emoji: "😞", label: "Rough", value: 2, accent: color.red },
  { emoji: "😐", label: "Flat", value: 4, accent: color.amber },
  { emoji: "🙂", label: "Okay", value: 6, accent: color.blue },
  { emoji: "😄", label: "Good", value: 8, accent: color.green },
  { emoji: "🤩", label: "Great", value: 10, accent: color.purple },
] as const;

export default function CheckInScreen() {
  const api = useApi();
  const router = useRouter();
  const { checkIn, submitCheckIn } = useAppState();

  // Prefilled from today's entry when there is one — a second visit edits the
  // same day rather than starting a blank second check-in.
  const [mood, setMood] = useState<number | null>(checkIn?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(checkIn?.energy ?? null);
  const [stress, setStress] = useState<number | null>(checkIn?.stress ?? null);
  const [tags, setTags] = useState<string[]>(checkIn?.tags ?? []);
  const [gratitude, setGratitude] = useState(checkIn?.gratitude ?? "");
  const [journal, setJournal] = useState(checkIn?.journal ?? "");

  const [prompt, setPrompt] = useState<{
    prompt: string;
    observation: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(checkIn);
  /** True once mood, energy and stress were started from the last check-in. */
  const [prefilled, setPrefilled] = useState(false);

  /**
   * A first check-in of the day starts from the last one's answers.
   *
   * Most days resemble yesterday, so the default does the work: someone who
   * feels the same taps Save, and someone who doesn't moves one slider. A
   * blank form asks the same three questions from scratch every morning,
   * which is exactly the friction that ends a daily habit.
   */
  useEffect(() => {
    if (checkIn) return;
    let cancelled = false;
    api
      .getLatestMood()
      .then((last) => {
        if (cancelled || !last) return;
        setMood((m) => m ?? last.mood);
        setEnergy((e) => e ?? last.energy);
        setStress((st) => st ?? last.stress);
        setPrefilled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort: a missing prompt must never block the check-in, so a failure
  // here just leaves the journal field with its own placeholder.
  const loadPrompt = useCallback(async () => {
    try {
      const result = await api.getCheckInPrompt();
      setPrompt({ prompt: result.prompt, observation: result.observation });
    } catch {
      setPrompt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadPrompt();
  }, [loadPrompt]);

  const toggleTag = (tag: string) => {
    void Haptics.selectionAsync();
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_CHECKIN_TAGS
          ? prev
          : [...prev, tag],
    );
  };

  const onSubmit = async () => {
    if (mood === null) return;
    setSaving(true);
    setError(null);
    try {
      // Explicit nulls, not omissions: this screen owns every field on it, so
      // emptying the journal here has to clear it rather than leave the old
      // text in place. The one-tap strip on the home screen is the opposite
      // case — it sends mood alone and everything else is left untouched.
      await submitCheckIn({
        mood,
        energy,
        stress,
        tags: tags.length ? tags : null,
        gratitude: gratitude.trim() || null,
        journal: journal.trim() || null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("Couldn't save your check-in. Try again.");
      setSaving(false);
    }
  };

  const reflectionEarned = Boolean(journal.trim() || gratitude.trim());

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          title: editing ? "Today's check-in" : "Check in",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.purple} />

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
            title={editing ? "Update today" : "How was today?"}
            subtitle={
              editing
                ? "You've already checked in. This edits it rather than adding a second."
                : "Only the first question is required. Answer as much as you feel like."
            }
          />

          {/* ── Mood ──────────────────────────────────────────────────────── */}
          <Card>
            <Label>How are you, really?</Label>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: space.md,
              }}
            >
              {MOODS.map((m) => {
                const active = mood === m.value;
                return (
                  <PressCard
                    key={m.label}
                    haptic="medium"
                    onPress={() => setMood(m.value)}
                    style={{
                      flex: 1,
                      marginHorizontal: 3,
                      paddingVertical: space.md,
                      paddingHorizontal: 0,
                      alignItems: "center",
                      backgroundColor: active
                        ? tint(m.accent, 0.14)
                        : "transparent",
                      borderColor: active
                        ? tint(m.accent, 0.34)
                        : "transparent",
                      shadowOpacity: 0,
                      elevation: 0,
                    }}
                  >
                    <Txt variant="heading" style={{ fontSize: 26 }}>
                      {m.emoji}
                    </Txt>
                    <Txt
                      variant="small"
                      c={active ? m.accent : color.textFaint}
                      style={{ marginTop: 4, fontSize: 11 }}
                    >
                      {m.label}
                    </Txt>
                  </PressCard>
                );
              })}
            </View>
          </Card>

          {prefilled ? (
            <Txt
              variant="small"
              c={color.textFaint}
              style={{ marginTop: space.sm }}
            >
              Started from your last check-in. Change anything that&apos;s
              different today.
            </Txt>
          ) : null}

          {/* ── Energy & stress ───────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(400).delay(60)}>
            <Card style={{ marginTop: space.md }}>
              <View style={{ gap: space.xl }}>
                <View style={{ gap: space.sm }}>
                  <Label>Energy</Label>
                  <Scale
                    value={energy}
                    onChange={setEnergy}
                    accent={color.amber}
                    lowLabel="Running on empty"
                    highLabel="Full tank"
                  />
                </View>
                <View style={{ gap: space.sm }}>
                  <Label>Stress</Label>
                  <Scale
                    value={stress}
                    onChange={setStress}
                    accent={color.red}
                    lowLabel="Settled"
                    highLabel="Wound up"
                  />
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* ── Tags ──────────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(400).delay(120)}>
            <Card style={{ marginTop: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Label>What sort of day was it?</Label>
                <View style={{ flex: 1 }} />
                {tags.length > 0 ? (
                  <Txt
                    variant="small"
                    c={color.textFaint}
                    style={{ fontSize: 11 }}
                  >
                    {tags.length}/{MAX_CHECKIN_TAGS}
                  </Txt>
                ) : null}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                  marginTop: space.md,
                }}
              >
                {CHECKIN_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    accent={color.pink}
                    selected={tags.includes(tag)}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>
            </Card>
          </Animated.View>

          {/* ── Gratitude ─────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.duration(400).delay(180)}>
            <Card style={{ marginTop: space.md }}>
              <Field
                label="One good thing"
                value={gratitude}
                onChangeText={setGratitude}
                placeholder="Anything. It doesn't have to be big."
                multiline
                maxLength={1000}
                accent={color.green}
              />
            </Card>
          </Animated.View>

          {/* ── Journal, with a real question at the top ──────────────────── */}
          <Animated.View entering={FadeInDown.duration(400).delay(240)}>
            <Card style={{ marginTop: space.md }} accent={color.purple}>
              {prompt ? (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  style={{ marginBottom: space.lg }}
                >
                  {prompt.observation ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: space.sm,
                        marginBottom: space.sm,
                      }}
                    >
                      <Ionicons
                        name="pulse-outline"
                        size={14}
                        color={color.purple}
                        style={{ marginTop: 3 }}
                      />
                      <Txt
                        variant="small"
                        c={color.textFaint}
                        style={{ flex: 1 }}
                      >
                        {prompt.observation}
                      </Txt>
                    </View>
                  ) : null}
                  <Txt variant="bodyStrong" c={color.purple}>
                    {prompt.prompt}
                  </Txt>
                </Animated.View>
              ) : null}

              <Field
                label="Journal"
                value={journal}
                onChangeText={setJournal}
                placeholder="Type, or hold the mic key on your keyboard and just talk."
                multiline
                maxLength={5000}
                accent={color.purple}
              />
            </Card>
          </Animated.View>

          {/* ── What this unlocks ─────────────────────────────────────────── */}
          <View
            style={{
              flexDirection: "row",
              gap: space.sm,
              marginTop: space.lg,
              paddingHorizontal: space.xs,
            }}
          >
            <Ionicons
              name={reflectionEarned ? "checkmark-circle" : "ellipse-outline"}
              size={15}
              color={reflectionEarned ? color.green : color.textFaint}
              style={{ marginTop: 2 }}
            />
            <Txt
              variant="small"
              c={reflectionEarned ? color.green : color.textFaint}
              style={{ flex: 1, fontSize: 12 }}
            >
              {reflectionEarned
                ? "Reflection counted — that's 15 points on today's score, and material Kairo can pick up."
                : "Write in either box to earn the reflection part of today's score."}
            </Txt>
          </View>

          {error ? (
            <View style={{ marginTop: space.md }}>
              <Notice>{error}</Notice>
            </View>
          ) : null}

          <Button
            label={editing ? "Update check-in" : "Save check-in"}
            accent={color.purple}
            style={{ marginTop: space.xl }}
            loading={saving}
            disabled={mood === null || saving}
            onPress={() => void onSubmit()}
          />

          {mood === null ? (
            <Txt
              variant="small"
              c={color.textFaint}
              style={{ marginTop: space.md, textAlign: "center" }}
            >
              Pick a face to save.
            </Txt>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              gap: space.sm,
              marginTop: space.xl,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <Ionicons
              name="lock-closed-outline"
              size={13}
              color={color.textFaint}
              style={{ marginTop: 2 }}
            />
            <Txt
              variant="small"
              c={color.textFaint}
              style={{ flex: 1, fontSize: 11 }}
            >
              Your journal and gratitude entries stay on your account.
              They&apos;re kept out of server logs, and are only ever shared if
              you opt a therapist into that category yourself.
            </Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
