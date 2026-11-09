/**
 * Sitting down with Kairo.
 *
 * Someone says what they want; Kairo goes gently underneath it, one question
 * at a time, until the real reason comes out. As they talk, what they said
 * stacks up the screen: from the goal, down to why it matters. By the end
 * they can see it.
 *
 * It's never called therapy, and it can always be skipped.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, ZoomIn } from "react-native-reanimated";
import type { SessionTurn } from "@kinextion/shared";

import { Button, Txt } from "../ui";
import { useApi } from "../../hooks/useApi";
import { color, radius, space, tint, type } from "../../theme";
import { AnswerDock, LiveOrb, useGuideVoice, type StagePhase } from "./voice-stage";

const COLORS = [color.purple, "#3B82F6"] as const;

/** If the connection drops, the conversation keeps going rather than stopping dead. */
const OFFLINE_QUESTIONS = [
  "If this got better, what would actually change for you?",
  "And who's that for, really?",
  "When did that start to matter so much?",
];

export interface WhyOutcome {
  ladder: string[];
  coreWhy?: string;
  concern?: boolean;
}

export function WhySession({
  name,
  area,
  specifics,
  routine,
  obstacles,
  onDone,
}: {
  name: string;
  area: string;
  specifics: string[];
  routine?: string;
  obstacles: string[];
  onDone: (outcome: WhyOutcome) => void;
}) {
  const api = useApi();
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(true);
  const [ladder, setLadder] = useState<string[]>([area]);
  const [finished, setFinished] = useState(false);
  const [coreWhy, setCoreWhy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [concern, setConcern] = useState(false);

  const turns = useRef<SessionTurn[]>([]);
  const talking = useRef(false);
  const sendRef = useRef<(text: string) => void>(() => {});

  const { listener, speak, hush, speaking, canListen } = useGuideVoice("kairo", (text) => sendRef.current(text));

  const land = useCallback(
    (say: string, opts: { done?: boolean }) => {
      setLine(say);
      setThinking(false);
      turns.current.push({ role: "guide", text: say });
      if (opts.done) setFinished(true);
      speak(say, () => {
        if (!opts.done && talking.current) void listener.start();
      });
    },
    [speak, listener]
  );

  const ask = useCallback(async () => {
    setThinking(true);
    try {
      const r = await api.whyTurn({ name, area, specifics, routine, obstacles, turns: turns.current });
      if (r.ladder) setLadder((l) => [...l, r.ladder as string]);
      if (r.concern) setConcern(true);
      if (r.coreWhy) setCoreWhy(r.coreWhy);
      land(r.say, { done: r.done });
    } catch {
      const asked = turns.current.filter((t) => t.role === "guide").length;
      const said = turns.current.filter((t) => t.role === "you");
      if (asked >= OFFLINE_QUESTIONS.length) {
        setCoreWhy(said[said.length - 1]?.text.slice(0, 140) ?? null);
        land("I think that's it. That's what this is for.", { done: true });
      } else {
        land(OFFLINE_QUESTIONS[asked], {});
      }
    }
  }, [api, area, land, name, obstacles, routine, specifics]);

  useEffect(() => {
    void ask();
    // Opens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    (text: string) => {
      hush();
      turns.current.push({ role: "you", text });
      void ask();
    },
    [ask, hush]
  );
  sendRef.current = send;

  const typed = (text: string) => {
    talking.current = false;
    send(text);
  };

  const onOrb = () => {
    if (finished) return;
    if (listener.state === "listening") return listener.stop();
    if (thinking || listener.state === "transcribing") return;
    hush();
    talking.current = true;
    void listener.start();
  };

  const phase: StagePhase = listener.state === "listening" ? "listening" : thinking || listener.state === "transcribing" ? "thinking" : speaking ? "speaking" : "idle";

  const finish = () => {
    hush();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone({ ladder, coreWhy: coreWhy?.trim() || undefined, concern });
  };

  if (finished) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, justifyContent: "center" }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Ladder rungs={ladder} />

        {coreWhy && !concern ? (
          <Animated.View entering={ZoomIn.duration(650).delay(300)} style={{ marginTop: space.lg }}>
            <LinearGradient colors={[tint(color.purple, 0.32), tint(color.green, 0.14)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: space.xl, borderWidth: 1, borderColor: tint(color.purple, 0.45) }}>
              <Txt variant="label" c={color.purple} style={{ marginBottom: space.sm }}>
                WHY THIS MATTERS
              </Txt>
              {editing ? (
                <TextInput
                  value={coreWhy}
                  onChangeText={setCoreWhy}
                  multiline
                  autoFocus
                  maxLength={140}
                  style={[type.title, { color: color.text, padding: 0 }]}
                />
              ) : (
                <Txt variant="title">{coreWhy}</Txt>
              )}
            </LinearGradient>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.delay(600)}>
          <Txt variant="body" c={color.textMuted} style={{ marginTop: space.xl }}>
            {line}
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(900)} style={{ gap: space.sm, marginTop: space.xxl }}>
          <Button label={coreWhy && !concern ? (editing ? "Yes, that's it" : "That's it") : "Keep going"} accent={color.purple} onPress={finish} />
          {coreWhy && !concern && !editing ? <Button label="Let me say it better" variant="ghost" accent={color.purple} onPress={() => setEditing(true)} /> : null}
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: space.xl }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable onPress={finish} hitSlop={12}>
          <Txt variant="small" c={color.textFaint}>
            Skip for now
          </Txt>
        </Pressable>
      </View>

      <LiveOrb phase={phase} volume={listener.volume} colors={COLORS} onPress={canListen ? onOrb : undefined} label={phase === "listening" ? "Stop listening" : "Talk to Kairo"} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {line ? (
          <Animated.View key={line} entering={FadeInDown.duration(500)}>
            <Txt variant="heading" style={{ textAlign: "center", fontWeight: "600", lineHeight: 29 }}>
              {line}
            </Txt>
          </Animated.View>
        ) : null}
        <View style={{ flex: 1, minHeight: space.xl }} />
        <Ladder rungs={ladder} />
      </ScrollView>

      <AnswerDock phase={phase} canListen={canListen} partial={listener.partial} error={listener.error} accent={color.purple} onSend={typed} placeholder="Say it however it comes out" />
    </KeyboardAvoidingView>
  );
}

/** What they've said so far, climbing toward the real reason. Newest on top. */
function Ladder({ rungs }: { rungs: string[] }) {
  const newestFirst = [...rungs].reverse();

  return (
    <View style={{ alignItems: "center" }}>
      {newestFirst.map((rung, i) => (
        <Animated.View key={rung + (rungs.length - i)} layout={LinearTransition.springify().damping(18)} entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
          {i > 0 ? <View style={{ width: 2, height: 14, backgroundColor: tint(color.purple, 0.45) }} /> : null}
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              backgroundColor: i === 0 ? tint(color.purple, 0.28) : tint(color.purple, 0.09),
              borderWidth: 1,
              borderColor: i === 0 ? tint(color.purple, 0.6) : tint(color.purple, 0.2),
              opacity: 1 - Math.min(0.45, i * 0.14),
            }}
          >
            <Txt variant="small" c={color.text} numberOfLines={2} style={{ textAlign: "center", fontWeight: i === 0 ? "600" : "400" }}>
              {rung}
            </Txt>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
