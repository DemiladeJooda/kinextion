/**
 * The bottom of a voice conversation: one orb.
 *
 * Tap it to talk. It breathes with your voice while listening, pulses
 * slowly while the guide thinks, and glows while the guide speaks. Tapping
 * it while the guide is talking interrupts and listens, like cutting in on
 * a person. The words you're saying appear above it as you say them.
 */

import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Txt } from "./ui";
import { color, space, tint } from "../theme";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const ORB = 76;

const HINT: Record<VoiceState, string> = {
  idle: "Tap to talk",
  listening: "Listening… tap when you're done",
  thinking: "Thinking…",
  speaking: "Tap to cut in",
};

export function VoiceDock({
  state,
  partial,
  volume,
  accent,
  speakAloud,
  error,
  onOrb,
  onKeyboard,
  onToggleSpeech,
}: {
  state: VoiceState;
  partial: string;
  volume: number;
  accent: string;
  speakAloud: boolean;
  error: string | null;
  onOrb: () => void;
  onKeyboard: () => void;
  onToggleSpeech: () => void;
}) {
  const ring = useSharedValue(1);
  const glow = useSharedValue(0.25);

  // Breathe with the voice while listening.
  useEffect(() => {
    if (state === "listening") ring.value = withSpring(1 + volume * 0.45, { damping: 14, stiffness: 180 });
  }, [state, volume, ring]);

  useEffect(() => {
    cancelAnimation(glow);
    if (state === "thinking") {
      ring.value = withTiming(1, { duration: 200 });
      glow.value = withRepeat(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else if (state === "speaking") {
      glow.value = withRepeat(withTiming(0.75, { duration: 420, easing: Easing.inOut(Easing.quad) }), -1, true);
      ring.value = withRepeat(withTiming(1.12, { duration: 420 }), -1, true);
    } else if (state === "idle") {
      ring.value = withTiming(1, { duration: 250 });
      glow.value = withTiming(0.25, { duration: 250 });
    } else {
      glow.value = withTiming(0.45, { duration: 150 });
    }
  }, [state, glow, ring]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ring.value }], opacity: glow.value }));

  const icon = state === "listening" ? "mic" : state === "speaking" ? "volume-high" : state === "thinking" ? "ellipsis-horizontal" : "mic-outline";

  return (
    <View
      style={{
        paddingTop: space.md,
        paddingBottom: space.lg,
        paddingHorizontal: space.lg,
        borderTopWidth: 1,
        borderTopColor: color.border,
        backgroundColor: "rgba(14,21,36,0.92)",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <View style={{ minHeight: 22, paddingHorizontal: space.lg }}>
        {error ? (
          <Txt variant="small" c={color.red} style={{ textAlign: "center" }}>
            {error}
          </Txt>
        ) : partial ? (
          <Txt variant="body" c={color.text} style={{ textAlign: "center" }} numberOfLines={3}>
            {partial}
          </Txt>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", justifyContent: "space-between" }}>
        <SideButton icon="keypad-outline" label="Type" onPress={onKeyboard} />

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOrb();
          }}
          accessibilityRole="button"
          accessibilityLabel={HINT[state]}
          style={{ width: ORB * 1.6, height: ORB * 1.6, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View
            style={[
              { position: "absolute", width: ORB * 1.4, height: ORB * 1.4, borderRadius: ORB, backgroundColor: tint(accent, 0.35) },
              ringStyle,
            ]}
          />
          <View
            style={{
              width: ORB,
              height: ORB,
              borderRadius: ORB / 2,
              backgroundColor: state === "idle" ? tint(accent, 0.22) : accent,
              borderWidth: 1,
              borderColor: tint(accent, 0.6),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={30} color={state === "idle" ? accent : color.bg} />
          </View>
        </Pressable>

        <SideButton
          icon={speakAloud ? "volume-medium-outline" : "volume-mute-outline"}
          label={speakAloud ? "Voice on" : "Voice off"}
          onPress={onToggleSpeech}
        />
      </View>

      <Txt variant="small" c={color.textFaint}>
        {HINT[state]}
      </Txt>
    </View>
  );
}

function SideButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ width: 64, alignItems: "center", gap: 4 }} accessibilityLabel={label}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Ionicons name={icon} size={19} color={color.textMuted} />
      </View>
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
