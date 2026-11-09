/**
 * Agreeing the first habit with Althea.
 *
 * Asks what they want to try, then pushes back: too big, too easy, what about
 * the thing that's stopped you before. They can tap smaller or bigger, or just
 * say what they think. It ends in a commitment they make with their thumb.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { HabitProposal, HelpStyleId, SessionTurn } from "@kinextion/shared";

import { Button, Chip, Txt } from "../ui";
import { useApi } from "../../hooks/useApi";
import { color, radius, space, tint } from "../../theme";
import { AnswerDock, LiveOrb, useGuideVoice, type StagePhase } from "./voice-stage";

const COLORS = [color.green, color.teal] as const;

const WHEN: Record<HabitProposal["timeWindow"], string> = {
  morning: "Mornings",
  midday: "Middle of the day",
  evening: "Evenings",
  anytime: "Any time",
};

function daysLabel(n: number): string {
  return n >= 7 ? "Every day" : `${n} ${n === 1 ? "day" : "days"} a week`;
}

export function HabitNegotiation({
  name,
  area,
  specifics,
  routine,
  obstacles,
  helpStyle,
  coreWhy,
  submitting,
  onCommit,
  onSkip,
}: {
  name: string;
  area: string;
  specifics: string[];
  routine?: string;
  obstacles: string[];
  helpStyle?: HelpStyleId;
  coreWhy?: string;
  submitting: boolean;
  onCommit: (proposal: HabitProposal) => void;
  onSkip: () => void;
}) {
  const api = useApi();
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(true);
  const [proposal, setProposal] = useState<HabitProposal | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const turns = useRef<SessionTurn[]>([]);
  const talking = useRef(false);
  const current = useRef<HabitProposal | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  const { listener, speak, hush, speaking, canListen } = useGuideVoice("altheo", (text) => sendRef.current(text));

  const ask = useCallback(async () => {
    setThinking(true);
    setNotice(null);
    try {
      const r = await api.negotiateTurn({
        name,
        area,
        specifics,
        routine,
        obstacles,
        helpStyle,
        coreWhy,
        turns: turns.current,
        ...(current.current ? { proposal: current.current } : {}),
      });
      if (r.proposal) {
        current.current = r.proposal;
        setProposal(r.proposal);
      }
      setLine(r.say);
      setThinking(false);
      turns.current.push({ role: "guide", text: r.say });
      if (r.agreed) setAgreed(true);
      speak(r.say, () => {
        if (!r.agreed && talking.current) void listener.start();
      });
    } catch {
      setThinking(false);
      if (!line) setLine("What's one thing you'd want to try?");
      setNotice("Lost the connection for a second. Say that again?");
      turns.current.pop();
    }
  }, [api, area, coreWhy, helpStyle, line, listener, name, obstacles, routine, speak, specifics]);

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

  const nudge = (text: string) => {
    void Haptics.selectionAsync();
    talking.current = false;
    send(text);
  };

  const onOrb = () => {
    if (listener.state === "listening") return listener.stop();
    if (thinking || listener.state === "transcribing") return;
    hush();
    talking.current = true;
    void listener.start();
  };

  const phase: StagePhase = listener.state === "listening" ? "listening" : thinking || listener.state === "transcribing" ? "thinking" : speaking ? "speaking" : "idle";

  if (agreed && proposal) {
    return <Commitment name={name} proposal={proposal} coreWhy={coreWhy} submitting={submitting} onCommit={() => { hush(); onCommit(proposal); }} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: space.xl }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable onPress={() => { hush(); onSkip(); }} hitSlop={12}>
          <Txt variant="small" c={color.textFaint}>
            I'll pick a habit later
          </Txt>
        </Pressable>
      </View>

      <LiveOrb phase={phase} volume={listener.volume} colors={COLORS} size={proposal ? 72 : 124} onPress={canListen ? onOrb : undefined} label={phase === "listening" ? "Stop listening" : "Talk to Althea"} />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {line ? (
          <Animated.View key={line} entering={FadeInDown.duration(450)}>
            <Txt variant="heading" style={{ textAlign: "center", fontWeight: "600", lineHeight: 28 }}>
              {line}
            </Txt>
          </Animated.View>
        ) : null}

        {notice ? (
          <Txt variant="small" c={color.amber} style={{ textAlign: "center", marginTop: space.sm }}>
            {notice}
          </Txt>
        ) : null}

        {proposal ? (
          <Animated.View entering={FadeInUp.duration(500)} layout={LinearTransition.springify().damping(18)} style={{ marginTop: space.xl }}>
            <View style={{ borderRadius: radius.xl, padding: space.xl, backgroundColor: color.surface, borderWidth: 1, borderColor: tint(color.green, 0.35), gap: space.md }}>
              <Txt variant="label" c={color.green}>
                ON THE TABLE
              </Txt>
              <Txt variant="title">{proposal.name}</Txt>
              <Row icon="link-outline" text={proposal.anchor} />
              <Row icon="leaf-outline" text={proposal.tiny} note="On a bad day, this still counts" />
              <Row icon="flame-outline" text={proposal.full} note="On a good day" />
              <Row icon="calendar-outline" text={`${daysLabel(proposal.daysPerWeek)} · ${WHEN[proposal.timeWindow]}`} />
            </View>

            <View style={{ flexDirection: "row", gap: space.sm, justifyContent: "center", marginTop: space.md }}>
              <Chip label="Smaller" icon="remove" accent={color.amber} onPress={() => nudge("Make it smaller.")} />
              <Chip label="Bigger" icon="add" accent={color.teal} onPress={() => nudge("I could do more than that. Make it bigger.")} />
            </View>

            <Button label="This feels right" accent={color.green} style={{ marginTop: space.md }} disabled={thinking} onPress={() => setAgreed(true)} />
          </Animated.View>
        ) : null}
      </ScrollView>

      <AnswerDock phase={phase} canListen={canListen} partial={listener.partial} error={listener.error} accent={color.green} onSend={(t) => { talking.current = false; send(t); }} placeholder="What do you want to try?" />
    </KeyboardAvoidingView>
  );
}

function Row({ icon, text, note }: { icon: keyof typeof Ionicons.glyphMap; text: string; note?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <Ionicons name={icon} size={18} color={color.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Txt variant="body">{text}</Txt>
        {note ? (
          <Txt variant="small" c={color.textFaint}>
            {note}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const HOLD_MS = 1400;

/** The promise, and what happens after it that a chat window can't do. */
function Commitment({
  name,
  proposal,
  coreWhy,
  submitting,
  onCommit,
}: {
  name: string;
  proposal: HabitProposal;
  coreWhy?: string;
  submitting: boolean;
  onCommit: () => void;
}) {
  const [held, setHeld] = useState(false);
  const fill = useSharedValue(0);

  const complete = () => {
    setHeld(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const press = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(complete)();
    });
  };

  const release = () => {
    if (held) return;
    cancelAnimation(fill);
    fill.value = withTiming(0, { duration: 180 });
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const promise = `${proposal.anchor}, I'll ${lowerFirst(proposal.tiny)}.`;

  const next = [
    { icon: "notifications-outline" as const, text: `We'll nudge you at the moment it matters: ${lowerFirst(proposal.anchor)}.` },
    { icon: "refresh-outline" as const, text: "Miss a day and nothing resets. We'll ask what got in the way and change the plan." },
    { icon: "heart-outline" as const, text: "Your reason stays. On a hard day, we'll say it back to you." },
  ];

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(500)}>
        <Txt variant="label" c={color.green}>
          {name ? `${name.toUpperCase()}'S FIRST PROMISE` : "YOUR FIRST PROMISE"}
        </Txt>
        <Txt variant="display" style={{ marginTop: space.md }}>
          {promise}
        </Txt>
        {coreWhy ? (
          <Txt variant="heading" c={color.purple} style={{ marginTop: space.lg, fontWeight: "500" }}>
            {coreWhy}
          </Txt>
        ) : null}
      </Animated.View>

      {held ? (
        <Animated.View entering={FadeInUp.duration(500)} style={{ marginTop: space.xxl, gap: space.lg }}>
          <Txt variant="heading">Here's what happens now</Txt>
          {next.map((n, i) => (
            <Animated.View key={n.icon} entering={FadeInDown.delay(150 + i * 170)} style={{ flexDirection: "row", gap: space.md }}>
              <Ionicons name={n.icon} size={20} color={color.green} style={{ marginTop: 1 }} />
              <Txt variant="body" c={color.textMuted} style={{ flex: 1 }}>
                {n.text}
              </Txt>
            </Animated.View>
          ))}
          <Button label="Let's begin" accent={color.green} loading={submitting} disabled={submitting} onPress={onCommit} style={{ marginTop: space.md }} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(500)} style={{ marginTop: space.xxxl }}>
          <Pressable
            onPressIn={press}
            onPressOut={release}
            accessibilityRole="button"
            accessibilityLabel="Hold to commit"
            onAccessibilityTap={complete}
            style={{ height: 64, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: tint(color.green, 0.4), overflow: "hidden", justifyContent: "center", alignItems: "center" }}
          >
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0 }, fillStyle]}>
              <LinearGradient colors={[color.green, color.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </Animated.View>
            <Txt variant="bodyStrong">Hold to commit</Txt>
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}
