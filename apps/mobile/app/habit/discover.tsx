/**
 * Talk it through.
 *
 * A short conversation about the shape of someone's actual day, which ends in
 * habit drafts rather than advice. Two or three exchanges, then proposals.
 *
 * On speech: this uses the dictation built into the user's own keyboard (the
 * mic key on iOS and Android) rather than recording audio in-app. That choice
 * is worth stating plainly — it means no microphone permission, no audio
 * leaving the device to a transcription vendor, and no third service holding
 * recordings of someone describing their life. The text arrives in the field
 * exactly as if typed, and the assistant is prompted to expect the rambling,
 * self-correcting shape of speech rather than tidy prose.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { draftToCreateInput, type HabitDraft } from "@kinextion/shared";

import { BasisChips, HabitDraftCard } from "../../components/HabitDraftCard";
import {
  AuroraBackdrop,
  Button,
  Card,
  Txt,
  TypingDots,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint } from "../../theme";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Local opener so the screen has something to say before the first request —
 *  the server's reply comes from the model on the user's first message. */
const OPENER =
  "Tell me how a normal day goes for you — when you're up, what's already fixed in it, and where it usually falls apart.";

export default function DiscoverHabitsScreen() {
  const api = useApi();
  const router = useRouter();
  const { addHabits } = useAppState();

  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: OPENER },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [drafts, setDrafts] = useState<HabitDraft[]>([]);
  const [basis, setBasis] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the newest turn in view as the conversation grows.
    const id = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(id);
  }, [turns, drafts, thinking]);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || thinking) return;

    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    setThinking(true);
    setError(null);

    try {
      const result = await api.discoverHabits(next);
      setTurns([...next, { role: "assistant", content: result.reply }]);
      if (result.drafts.length) {
        setDrafts(result.drafts);
        setBasis(result.basis);
        // Everything proposed starts selected — the user deselects what they
        // don't want, which is less work than opting into each one.
        setSelected(new Set(result.drafts.map((_, i) => i)));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      // Put their words back so a failed send doesn't lose what they said.
      setTurns(turns);
      setInput(content);
    } finally {
      setThinking(false);
    }
  }, [api, input, thinking, turns]);

  const onAddSelected = async () => {
    const chosen = drafts.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await addHabits(chosen.map(draftToCreateInput));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("Couldn't save those. Try again.");
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
          title: "Talk it through",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.teal} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: space.xl,
            gap: space.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {turns.map((turn, i) => (
            <Animated.View key={i} entering={FadeIn.duration(260)}>
              <Bubble turn={turn} />
            </Animated.View>
          ))}

          {thinking ? (
            <View style={{ paddingLeft: space.md, paddingVertical: space.sm }}>
              <TypingDots accent={color.teal} />
            </View>
          ) : null}

          {drafts.length > 0 ? (
            <View style={{ gap: space.md, marginTop: space.md }}>
              <BasisChips basis={basis} />

              {drafts.map((draft, i) => (
                <Animated.View
                  key={`${draft.name}-${i}`}
                  entering={FadeInDown.duration(360).delay(i * 70)}
                >
                  <Pressable
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                  >
                    <HabitDraftCard draft={draft} accepted={selected.has(i)}>
                      <Txt
                        variant="small"
                        c={selected.has(i) ? color.green : color.textFaint}
                      >
                        {selected.has(i)
                          ? "Selected — tap to remove"
                          : "Tap to include"}
                      </Txt>
                    </HabitDraftCard>
                  </Pressable>
                </Animated.View>
              ))}

              <Button
                label={
                  selected.size === 0
                    ? "Select at least one"
                    : `Add ${selected.size} habit${selected.size === 1 ? "" : "s"}`
                }
                accent={color.green}
                disabled={selected.size === 0}
                loading={saving}
                onPress={() => void onAddSelected()}
              />
            </View>
          ) : null}

          {error ? (
            <Txt variant="small" c={color.red}>
              {error}
            </Txt>
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: space.sm,
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: space.md,
            borderTopWidth: 1,
            borderTopColor: color.border,
            backgroundColor: color.surface,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type, or use the mic on your keyboard…"
            placeholderTextColor={color.textFaint}
            multiline
            maxLength={4000}
            style={{
              flex: 1,
              color: color.text,
              fontSize: 15,
              lineHeight: 21,
              maxHeight: 120,
              minHeight: 44,
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.border,
              paddingHorizontal: space.lg,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          />
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void send();
            }}
            disabled={!input.trim() || thinking}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                input.trim() && !thinking ? color.teal : tint(color.teal, 0.14),
            }}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={input.trim() && !thinking ? color.bg : color.textFaint}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";

  if (isUser) {
    return (
      <View style={{ alignItems: "flex-end" }}>
        <View
          style={{
            maxWidth: "88%",
            backgroundColor: tint(color.teal, 0.16),
            borderRadius: radius.lg,
            borderTopRightRadius: 6,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
          }}
        >
          <Txt variant="body">{turn.content}</Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "flex-start" }}>
      <Card
        style={{ maxWidth: "92%", padding: space.lg, borderTopLeftRadius: 6 }}
      >
        <Txt variant="body" c={color.textMuted}>
          {turn.content}
        </Txt>
      </Card>
    </View>
  );
}
