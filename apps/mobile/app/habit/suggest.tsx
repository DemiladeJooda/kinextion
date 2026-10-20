/**
 * Habits suggested from what Kinextion already tracks.
 *
 * The screen is deliberately upfront about how thin or thick the basis is: the
 * chips under the header list every signal the proposals were actually built
 * from, and on a brand-new account that list is short and says so. A
 * suggestion presented as personalised when it was generic is the fastest way
 * to lose someone's trust in every later suggestion.
 */

import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { WELLNESS_CATEGORIES, WELLNESS_LABELS } from "@kinextion/shared";
import type { HabitDraft } from "@kinextion/shared";

import { BasisChips, HabitDraftCard } from "../../components/HabitDraftCard";
import {
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  EmptyState,
  ScreenHeader,
  Txt,
  TypingDots,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { categoryColor, color, space, type Category } from "../../theme";

export default function SuggestHabitsScreen() {
  const api = useApi();
  const router = useRouter();
  const { addHabit } = useAppState();

  const [drafts, setDrafts] = useState<HabitDraft[]>([]);
  const [basis, setBasis] = useState<string[]>([]);
  const [focus, setFocus] = useState<Category | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  /** Indices already added, so a double tap can't create two of the same. */
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(
    async (nextFocus: Category | null) => {
      setState("loading");
      setAccepted(new Set());
      try {
        const result = await api.suggestHabits({
          count: 3,
          ...(nextFocus ? { focus: nextFocus } : {}),
        });
        setDrafts(result.drafts);
        setBasis(result.basis);
        setState("ready");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Couldn't put suggestions together just now."
        );
        setState("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAccept = async (draft: HabitDraft, index: number) => {
    setSaving(index);
    try {
      await addHabit({
        name: draft.name,
        category: draft.category,
        cue: draft.cue,
        craving: draft.craving,
        response: draft.response,
        reward: draft.reward,
        frequency: draft.frequency,
        targetDays: draft.targetDays,
      });
      setAccepted((prev) => new Set(prev).add(index));
    } catch {
      setErrorMsg("Couldn't add that one. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Suggestions",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.purple} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Ideas for you"
          subtitle="Each one comes with the reason it was picked. Add the ones that fit."
        />

        {/* Focus filter — regenerates rather than filtering client-side, so a
            focused request gets three real suggestions, not the leftovers. */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: space.sm,
            marginBottom: space.lg,
          }}
        >
          <Chip
            label="Anything"
            accent={color.purple}
            selected={focus === null}
            onPress={() => {
              setFocus(null);
              void load(null);
            }}
          />
          {WELLNESS_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={WELLNESS_LABELS[c]}
              accent={categoryColor[c as Category]}
              selected={focus === c}
              onPress={() => {
                setFocus(c as Category);
                void load(c as Category);
              }}
            />
          ))}
        </View>

        {state === "loading" ? (
          <Card>
            <TypingDots accent={color.purple} />
            <Txt variant="small" c={color.textFaint} style={{ marginTop: space.md }}>
              Reading what you&apos;ve been doing…
            </Txt>
          </Card>
        ) : state === "error" ? (
          <View style={{ gap: space.lg }}>
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load suggestions"
              body={errorMsg}
              accent={color.amber}
            />
            <Button
              label="Try again"
              variant="secondary"
              accent={color.purple}
              onPress={() => void load(focus)}
            />
          </View>
        ) : drafts.length === 0 ? (
          <EmptyState
            icon="bulb-outline"
            title="Nothing to suggest yet"
            body="Log a few days first, or build one yourself and come back."
            accent={color.purple}
          />
        ) : (
          <>
            <View style={{ marginBottom: space.lg }}>
              <BasisChips basis={basis} />
            </View>

            <View style={{ gap: space.md }}>
              {drafts.map((draft, i) => (
                <Animated.View
                  key={`${draft.name}-${i}`}
                  entering={FadeInDown.duration(400).delay(i * 70)}
                >
                  <HabitDraftCard draft={draft} accepted={accepted.has(i)}>
                    <Button
                      label={accepted.has(i) ? "Added" : "Add this habit"}
                      icon={accepted.has(i) ? "checkmark" : "add"}
                      variant={accepted.has(i) ? "secondary" : "primary"}
                      accent={
                        accepted.has(i) ? color.green : categoryColor[draft.category as Category]
                      }
                      loading={saving === i}
                      disabled={accepted.has(i)}
                      onPress={() => void onAccept(draft, i)}
                    />
                  </HabitDraftCard>
                </Animated.View>
              ))}
            </View>

            <View style={{ gap: space.md, marginTop: space.xl }}>
              <Button
                label="Suggest different ones"
                icon="shuffle"
                variant="ghost"
                accent={color.textMuted}
                onPress={() => void load(focus)}
              />
              {accepted.size > 0 ? (
                <Button
                  label={`Done — ${accepted.size} added`}
                  accent={color.green}
                  onPress={() => router.back()}
                />
              ) : null}
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: space.sm,
                marginTop: space.xl,
              }}
            >
              <Ionicons name="information-circle-outline" size={14} color={color.textFaint} />
              <Txt variant="small" c={color.textFaint} style={{ flex: 1, fontSize: 12 }}>
                Suggestions only cite data you&apos;ve actually logged or connected. Nothing here is
                invented — if the basis above is short, the ideas are general.
              </Txt>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
