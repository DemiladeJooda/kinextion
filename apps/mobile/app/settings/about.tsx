/**
 * About you, in your own words.
 *
 * The guides were reading goals and equipment but knew nothing about the
 * life those goals live in. A walk after work means something different in
 * a Houston August, on a night-shift rota, or with two kids at bath time.
 *
 * Every field is optional free text, so people describe themselves rather
 * than pick from someone else's boxes. Nothing here is ever guessed. The
 * guides are told to let it shape fit, never assumptions, and the screen
 * says so in plain words.
 */

import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import type { UserBackground } from "@kinextion/shared";

import { AuroraBackdrop, Button, Card, Field, Notice, ScreenHeader, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { color, space } from "../../theme";

type Key = keyof UserBackground;

const FIELDS: ReadonlyArray<{ key: Key; label: string; placeholder: string; max: number; multiline?: boolean }> = [
  { key: "gender", label: "Gender", placeholder: "e.g. man, woman, non-binary", max: 40 },
  { key: "ethnicity", label: "Background", placeholder: "Race, ethnicity or culture, e.g. Black, Nigerian-American", max: 80 },
  { key: "location", label: "Where you live", placeholder: "e.g. Houston, Texas", max: 80 },
  { key: "work", label: "Your days", placeholder: "e.g. nurse on night shifts, college student", max: 120 },
  { key: "household", label: "Who you live with", placeholder: "e.g. my wife and two kids", max: 120 },
  {
    key: "notes",
    label: "Anything else",
    placeholder: "Faith, food, a bad knee, what matters to you",
    max: 300,
    multiline: true,
  },
];

const EMPTY: Record<Key, string> = { gender: "", ethnicity: "", location: "", work: "", household: "", notes: "" };

export default function AboutYouScreen() {
  const api = useApi();
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyProfile()
      .then((user) => {
        if (cancelled) return;
        const bg = user.profile?.background ?? {};
        setValues({ ...EMPTY, ...Object.fromEntries(Object.entries(bg).map(([k, v]) => [k, v ?? ""])) });
      })
      .catch(() => setError("Couldn't load this. Try again in a moment."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v)
  ) as UserBackground;
  const anything = Object.keys(filled).length > 0;

  const save = async (background: UserBackground | null) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ background });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "About you",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.blue} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="About you"
            subtitle="So your guides fit their advice to your real life: your weather, your schedule, your people."
          />

          <View style={{ gap: space.md }}>
            <Card accent={color.blue}>
              <Txt variant="small" c={color.textMuted}>
                All optional, in your own words. Your guides use it to make things fit, like moving a walk before
                the Texas heat or planning around night shifts. They never use it to assume what you like,
                believe or can do. Clear it any time.
              </Txt>
            </Card>

            <Card>
              <View style={{ gap: space.lg }}>
                {FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={loading ? "" : values[f.key]}
                    onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                    placeholder={f.placeholder}
                    maxLength={f.max}
                    multiline={f.multiline}
                    accent={color.blue}
                  />
                ))}
              </View>
            </Card>

            {error ? <Notice>{error}</Notice> : null}

            <Button
              label="Save"
              loading={saving}
              onPress={() => save(anything ? filled : null)}
              disabled={saving || loading}
              accent={color.blue}
            />
            {anything ? (
              <Button label="Clear all of it" variant="ghost" onPress={() => save(null)} disabled={saving} />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
