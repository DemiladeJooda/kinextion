/**
 * Edit profile.
 *
 * Every field here was already in the schema and set exactly once, during
 * onboarding, with no way to change it afterwards — so a user whose goals
 * shifted, who bought a kettlebell, or who got a job with different hours was
 * stuck with the answers they gave on day one, and so were the guides reading
 * them.
 *
 * The spiritual dial is the sharpest case: Kairo's system prompt describes it
 * as "User-Controlled" and lists three settings it honours, and until now
 * there was no control. The wording of each option here is taken from what the
 * prompt actually does with it, so the label and the behaviour can't drift.
 */

import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  COACHING_INTENSITY_OPTIONS,
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  SCORE_PERIOD_OPTIONS,
  SPIRITUAL_DIAL_OPTIONS,
} from "@kinextion/shared";

import {
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  Field,
  Label,
  PressCard,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type { RemoteProfile } from "../../services";
import { color, radius, space, tint } from "../../theme";

const LEVELS = [
  {
    value: "beginner",
    label: "Beginner",
    detail: "New to this, or coming back",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    detail: "Training with some consistency",
  },
  {
    value: "advanced",
    label: "Advanced",
    detail: "Structured training, years in",
  },
] as const;

type Dial = "scripture" | "balanced" | "universal";
type Intensity = "gentle" | "balanced" | "intense";
type ScorePeriod = "weekly" | "monthly" | "yearly";

export default function EditProfileScreen() {
  const api = useApi();
  const router = useRouter();

  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState<string>("beginner");
  const [goals, setGoals] = useState<string[]>([]);
  const [availability, setAvailability] = useState(3);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [dial, setDial] = useState<Dial>("universal");
  const [intensity, setIntensity] = useState<Intensity>("balanced");
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>("weekly");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyProfile()
      .then((user) => {
        if (cancelled || !user.profile) return;
        const p = user.profile;
        setProfile(p);
        setDisplayName(p.displayName ?? "");
        setAge(p.age ? String(p.age) : "");
        setFitnessLevel(p.fitnessLevel ?? "beginner");
        setGoals(p.primaryGoals ?? []);
        setAvailability(p.weeklyAvailability ?? 3);
        setEquipment(p.equipment ?? []);
        // Universal is Kairo's documented default when nothing is set.
        setDial(p.preferences?.aiPersonalityDial ?? "universal");
        setIntensity(p.preferences?.coachingIntensity ?? "balanced");
        setScorePeriod(p.preferences?.scorePeriod ?? "weekly");
      })
      .catch(() => setError("Couldn't load your profile."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (list: string[], value: string, max: number) =>
    list.includes(value)
      ? list.filter((v) => v !== value)
      : list.length >= max
        ? list
        : [...list, value];

  const onSave = async () => {
    if (goals.length === 0) {
      setError("Pick at least one goal — the guides use these.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const parsedAge = age.trim() ? Number(age.trim()) : null;
      await api.updateProfile({
        displayName: displayName.trim() || undefined,
        // Explicit null clears an age someone would rather not keep on record.
        age: Number.isFinite(parsedAge) ? parsedAge : null,
        fitnessLevel: fitnessLevel as "beginner" | "intermediate" | "advanced",
        primaryGoals: goals,
        weeklyAvailability: availability,
        equipment,
        preferences: { aiPersonalityDial: dial, coachingIntensity: intensity, scorePeriod },
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your changes.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Edit profile",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.green} />

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
            title="Edit profile"
            subtitle="Althea and Kairo read all of this. Changing it changes what they say."
          />

          {loading ? (
            <Card>
              <Txt variant="small" c={color.textFaint}>
                Loading…
              </Txt>
            </Card>
          ) : !profile ? (
            <Card>
              <Txt variant="body" c={color.textMuted}>
                {error ?? "No profile found."}
              </Txt>
            </Card>
          ) : (
            <View style={{ gap: space.md }}>
              {/* ── Basics ────────────────────────────────────────────── */}
              <Card>
                <View style={{ gap: space.lg }}>
                  <Field
                    label="Name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="What should we call you?"
                    maxLength={50}
                  />
                  <Field
                    label="Age (optional)"
                    value={age}
                    onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ""))}
                    placeholder="Leave blank to keep it to yourself"
                    maxLength={3}
                    hint="Only used to keep training suggestions sensible."
                  />
                </View>
              </Card>

              {/* ── Training level ────────────────────────────────────── */}
              <Card>
                <Label>Where you&apos;re at</Label>
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  {LEVELS.map((l) => (
                    <SelectRow
                      key={l.value}
                      label={l.label}
                      detail={l.detail}
                      selected={fitnessLevel === l.value}
                      accent={color.green}
                      onPress={() => setFitnessLevel(l.value)}
                    />
                  ))}
                </View>
              </Card>

              {/* ── Goals ─────────────────────────────────────────────── */}
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Label>What you&apos;re working towards</Label>
                  <View style={{ flex: 1 }} />
                  <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                    {goals.length}/5
                  </Txt>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.sm,
                    marginTop: space.md,
                  }}
                >
                  {GOAL_OPTIONS.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      accent={color.green}
                      selected={goals.includes(g)}
                      onPress={() => setGoals(toggle(goals, g, 5))}
                    />
                  ))}
                </View>
              </Card>

              {/* ── Availability ──────────────────────────────────────── */}
              <Card>
                <Label>Days a week you can train</Label>
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.xs,
                    marginTop: space.md,
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <PressCard
                      key={n}
                      haptic="light"
                      onPress={() => setAvailability(n)}
                      style={{
                        flex: 1,
                        padding: 0,
                        paddingVertical: space.md,
                        alignItems: "center",
                        borderRadius: radius.sm,
                        backgroundColor:
                          availability === n ? tint(color.green, 0.16) : "transparent",
                        borderColor: availability === n ? tint(color.green, 0.4) : color.border,
                        shadowOpacity: 0,
                        elevation: 0,
                      }}
                    >
                      <Txt
                        variant="bodyStrong"
                        c={availability === n ? color.green : color.textFaint}
                      >
                        {n}
                      </Txt>
                    </PressCard>
                  ))}
                </View>
              </Card>

              {/* ── Equipment ─────────────────────────────────────────── */}
              <Card>
                <Label>What you have access to</Label>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.sm,
                    marginTop: space.md,
                  }}
                >
                  {EQUIPMENT_OPTIONS.map((e) => (
                    <Chip
                      key={e}
                      label={e}
                      accent={color.amber}
                      selected={equipment.includes(e)}
                      onPress={() => setEquipment(toggle(equipment, e, 12))}
                    />
                  ))}
                </View>
              </Card>

              {/* ── The spiritual dial ────────────────────────────────── */}
              <Animated.View entering={FadeInDown.duration(400)}>
                <Card accent={color.purple}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.sm,
                    }}
                  >
                    <Ionicons name="water" size={16} color={color.purple} />
                    <Label c={color.purple}>Kairo&apos;s tone</Label>
                  </View>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
                    How much faith language Kairo uses when you talk about meaning, stillness or
                    purpose. This changes nothing about Althea.
                  </Txt>

                  <View style={{ gap: space.sm, marginTop: space.lg }}>
                    {SPIRITUAL_DIAL_OPTIONS.map((option) => (
                      <SelectRow
                        key={option.value}
                        label={option.label}
                        detail={option.description}
                        selected={dial === option.value}
                        accent={color.purple}
                        onPress={() => setDial(option.value as Dial)}
                      />
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {/* ── Coaching intensity ────────────────────────────────── */}
              <Animated.View entering={FadeInDown.duration(400).delay(60)}>
                <Card accent={color.amber}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Ionicons name="speedometer-outline" size={16} color={color.amber} />
                    <Label c={color.amber}>How hard the guides push</Label>
                  </View>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
                    Applies to both Altheo and Kairo.
                  </Txt>
                  <View style={{ gap: space.sm, marginTop: space.lg }}>
                    {COACHING_INTENSITY_OPTIONS.map((option) => (
                      <SelectRow
                        key={option.value}
                        label={option.label}
                        detail={option.description}
                        selected={intensity === option.value}
                        accent={color.amber}
                        onPress={() => setIntensity(option.value as Intensity)}
                      />
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {/* ── Score period ──────────────────────────────────────── */}
              <Animated.View entering={FadeInDown.duration(400).delay(120)}>
                <Card accent={color.teal}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Ionicons name="pulse-outline" size={16} color={color.teal} />
                    <Label c={color.teal}>How often your score resets</Label>
                  </View>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
                    The number shown around the app is a rolling average over this window —
                    like a rating, not a running total.
                  </Txt>
                  <View style={{ gap: space.sm, marginTop: space.lg }}>
                    {SCORE_PERIOD_OPTIONS.map((option) => (
                      <SelectRow
                        key={option.value}
                        label={option.label}
                        detail={option.description}
                        selected={scorePeriod === option.value}
                        accent={color.teal}
                        onPress={() => setScorePeriod(option.value as ScorePeriod)}
                      />
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {error ? (
                <Txt variant="small" c={color.red}>
                  {error}
                </Txt>
              ) : null}

              <Button
                label="Save changes"
                accent={color.green}
                loading={saving}
                disabled={saving}
                onPress={() => void onSave()}
                style={{ marginTop: space.sm }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SelectRow({
  label,
  detail,
  selected,
  accent,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <PressCard
      haptic="light"
      onPress={onPress}
      style={{
        padding: space.lg,
        backgroundColor: selected ? tint(accent, 0.1) : "transparent",
        borderColor: selected ? tint(accent, 0.34) : color.border,
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={18}
          color={selected ? accent : color.textFaint}
        />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" c={selected ? accent : color.text}>
            {label}
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
            {detail}
          </Txt>
        </View>
      </View>
    </PressCard>
  );
}
