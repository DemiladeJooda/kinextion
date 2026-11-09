/**
 * Getting to know you, one question a day.
 *
 * What onboarding deliberately doesn't ask. Each question says what it's for,
 * can be skipped, and only one shows per day, starting the day after you join.
 */

import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { nextGetToKnow, today, type GetToKnowQuestion, type UserBackground } from "@kinextion/shared";

import { Button, Card, Chip, Label, Txt } from "./ui";
import { useApi } from "../hooks/useApi";
import { color, radius, space, type } from "../theme";

const KEY = "getToKnow.v1";

interface State {
  done: string[];
  lastShown: string | null;
}

async function load(): Promise<State> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // Nothing saved, or unreadable: start fresh.
  }
  return { done: [], lastShown: null };
}

function save(state: State) {
  void SecureStore.setItemAsync(KEY, JSON.stringify(state)).catch(() => {});
}

/** So the first question arrives tomorrow, not straight after onboarding. */
export async function markOnboardingFinished() {
  save({ ...(await load()), lastShown: today() });
}

export function GetToKnowCard() {
  const api = useApi();
  const [state, setState] = useState<State | null>(null);
  const [question, setQuestion] = useState<GetToKnowQuestion | null>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load().then((s) => {
      setState(s);
      setQuestion(nextGetToKnow(s, today()));
    });
  }, []);

  if (!state || !question) return null;

  const close = () => {
    const next = { done: [...state.done, question.id], lastShown: today() };
    setState(next);
    save(next);
    setQuestion(null);
  };

  const answer = async () => {
    setSaving(true);
    try {
      const value = text.trim();
      if (question.id === "fitness") {
        await api.updateProfile({ fitnessLevel: picked[0] as "beginner" | "intermediate" | "advanced" });
      } else if (question.id === "equipment") {
        await api.updateProfile({ equipment: picked });
      } else if (question.id === "support") {
        const support = picked[0] as "regular" | "sometimes" | "none" | "private";
        await api.updateProfile({
          preferences: { supportPerson: support, ...(support === "private" ? {} : { doesTherapy: support === "regular" || support === "sometimes" }) },
        });
      } else {
        const profile = await api.getMyProfile();
        const background = (profile.profile?.background ?? {}) as UserBackground;
        await api.updateProfile({ background: { ...background, [question.id]: value } });
      }
      close();
    } catch {
      // Keep the card: their answer's still in it, so they can try again.
    } finally {
      setSaving(false);
    }
  };

  const canSave = question.options ? picked.length > 0 : text.trim().length > 0;

  return (
    <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOut}>
      <Card accent={color.teal}>
        <Label c={color.teal}>One quick thing</Label>
        <Txt variant="heading" style={{ marginTop: space.sm }}>
          {question.question}
        </Txt>
        <Txt variant="small" c={color.textMuted} style={{ marginTop: space.xs }}>
          {question.why}
        </Txt>

        <View style={{ marginTop: space.md }}>
          {question.options ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {question.options.map((o) => {
                const on = picked.includes(o.value);
                return (
                  <Chip
                    key={o.value}
                    label={o.label}
                    accent={color.teal}
                    selected={on}
                    onPress={() => setPicked((p) => (question.multi ? (on ? p.filter((x) => x !== o.value) : [...p, o.value]) : [o.value]))}
                  />
                );
              })}
            </View>
          ) : (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={question.placeholder}
              placeholderTextColor={color.textFaint}
              autoCapitalize="sentences"
              autoCorrect
              spellCheck
              maxLength={120}
              style={[type.body, { backgroundColor: color.surfaceAlt, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, color: color.text }]}
            />
          )}
        </View>

        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
          <Button label="Skip" variant="ghost" accent={color.textMuted} onPress={close} style={{ flex: 1 }} />
          <Button label="Save" accent={color.teal} onPress={() => void answer()} disabled={!canSave || saving} loading={saving} style={{ flex: 1 }} />
        </View>
      </Card>
    </Animated.View>
  );
}

