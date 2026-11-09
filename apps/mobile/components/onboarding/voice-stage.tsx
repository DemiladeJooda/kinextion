/**
 * What the two onboarding conversations share: the guide's voice, the listener,
 * the living orb, and the place to answer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { Persona } from "@kinextion/shared";

import { Txt } from "../ui";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../lib/auth";
import { createSpeaker, useListener, voiceSupported, type Speaker } from "../../lib/voice";
import { color, radius, space, tint, type } from "../../theme";

export type StagePhase = "idle" | "listening" | "thinking" | "speaking";

export function useGuideVoice(persona: Persona, onHeard: (text: string) => void) {
  const api = useApi();
  const { getToken } = useAuth();
  const [speaking, setSpeaking] = useState(false);
  const [canListen, setCanListen] = useState(voiceSupported);
  const speaker = useRef<Speaker | null>(null);
  const heard = useRef(onHeard);
  heard.current = onHeard;

  const listener = useListener({ onFinal: (text) => heard.current(text), getToken });

  const voice = useRef(api.getVoice().catch(() => ({ premium: false, listening: false })));
  useEffect(() => {
    void voice.current.then((v) => {
      if (v.listening) setCanListen(true);
    });
  }, []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      speaker.current?.stop();
      void voice.current.then((v) => {
        const next = createSpeaker({
          persona,
          premium: v.premium,
          getToken,
          onSpeaking: setSpeaking,
          onIdle: () => {
            setSpeaking(false);
            onDone?.();
          },
        });
        speaker.current = next;
        next.say(text);
        next.end();
      });
    },
    [persona, getToken]
  );

  const hush = useCallback(() => {
    speaker.current?.stop();
    speaker.current = null;
    setSpeaking(false);
  }, []);

  useEffect(() => () => speaker.current?.stop(), []);

  return { listener, speak, hush, speaking, canListen };
}

/** A breathing orb: swells with your voice, ripples while the guide talks. */
export function LiveOrb({
  phase,
  volume,
  colors,
  size = 136,
  onPress,
  label,
}: {
  phase: StagePhase;
  volume: number;
  colors: readonly [string, string];
  size?: number;
  onPress?: () => void;
  label: string;
}) {
  const core = useSharedValue(1);
  const outer = useSharedValue(1);
  const inner = useSharedValue(1);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    if (phase === "listening") core.value = withSpring(1 + volume * 0.32, { damping: 12, stiffness: 190 });
  }, [phase, volume, core]);

  useEffect(() => {
    for (const v of [core, outer, inner, glow]) cancelAnimation(v);
    const pulse = (duration: number, to: number) => withRepeat(withTiming(to, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);

    if (phase === "speaking") {
      core.value = pulse(380, 1.13);
      outer.value = pulse(520, 1.34);
      inner.value = withDelay(120, pulse(440, 1.2));
      glow.value = pulse(420, 0.7);
    } else if (phase === "thinking") {
      core.value = pulse(800, 1.05);
      outer.value = pulse(1100, 1.14);
      inner.value = withDelay(220, pulse(950, 1.09));
      glow.value = pulse(800, 0.5);
    } else if (phase === "listening") {
      outer.value = pulse(900, 1.18);
      inner.value = withDelay(120, pulse(780, 1.1));
      glow.value = withTiming(0.62, { duration: 200 });
    } else {
      core.value = pulse(2400, 1.03);
      outer.value = pulse(2800, 1.07);
      inner.value = withDelay(400, pulse(2500, 1.05));
      glow.value = withTiming(0.3, { duration: 300 });
    }
  }, [phase, core, outer, inner, glow]);

  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: core.value }] }));
  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outer.value }], opacity: glow.value * 0.55 }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: inner.value }], opacity: glow.value }));

  const box = size * 1.7;

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: box, height: box, alignItems: "center", justifyContent: "center", alignSelf: "center" }}
    >
      <Animated.View style={[{ position: "absolute", width: size * 1.55, height: size * 1.55, borderRadius: size, backgroundColor: tint(colors[0], 0.22) }, outerStyle]} />
      <Animated.View style={[{ position: "absolute", width: size * 1.22, height: size * 1.22, borderRadius: size, backgroundColor: tint(colors[1], 0.32) }, innerStyle]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }, coreStyle]}>
        <LinearGradient colors={colors} start={{ x: 0.15, y: 0.05 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {phase === "listening" ? <Ionicons name="mic" size={size * 0.3} color={color.bg} /> : phase === "idle" ? <Ionicons name="mic-outline" size={size * 0.3} color={color.bg} /> : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/** Words as you say them, the hint, and the way to type instead. */
export function AnswerDock({
  phase,
  canListen,
  partial,
  error,
  accent,
  onSend,
  placeholder,
}: {
  phase: StagePhase;
  canListen: boolean;
  partial: string;
  error: string | null;
  accent: string;
  onSend: (text: string) => void;
  placeholder: string;
}) {
  const [typing, setTyping] = useState(!canListen);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!canListen) setTyping(true);
  }, [canListen]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSend(text);
  };

  const hint =
    phase === "listening" ? "Listening. Tap the circle when you're done." : phase === "thinking" ? "Thinking" : phase === "speaking" ? "Tap the circle to cut in" : "Tap the circle and just talk";

  return (
    <View style={{ gap: space.sm, minHeight: 92 }}>
      {error ? (
        <Txt variant="small" c={color.red} style={{ textAlign: "center" }}>
          {error}
        </Txt>
      ) : partial ? (
        <Txt variant="body" c={color.text} style={{ textAlign: "center" }} numberOfLines={3}>
          {partial}
        </Txt>
      ) : !typing ? (
        <Txt variant="small" c={color.textFaint} style={{ textAlign: "center" }}>
          {hint}
        </Txt>
      ) : null}

      {typing ? (
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={color.textFaint}
            multiline
            maxLength={800}
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            style={[
              type.body,
              {
                flex: 1,
                maxHeight: 110,
                backgroundColor: color.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.border,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                color: color.text,
              },
            ]}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || phase === "thinking"}
            accessibilityLabel="Send"
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() ? accent : color.surfaceAlt }}
          >
            <Ionicons name="arrow-up" size={22} color={draft.trim() ? color.bg : color.textFaint} />
          </Pressable>
        </View>
      ) : null}

      {canListen ? (
        <Pressable onPress={() => setTyping((t) => !t)} hitSlop={10} style={{ alignSelf: "center", paddingVertical: space.xs }}>
          <Txt variant="small" c={color.textMuted}>
            {typing ? "Talk instead" : "Type instead"}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
