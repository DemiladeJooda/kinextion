/**
 * Shared UI primitives.
 *
 * Screens compose these rather than restyling Views, so spacing, elevation,
 * and press feedback stay identical everywhere. Every interactive element
 * fires haptics — on a phone that tactile confirmation is most of what makes
 * an app feel finished rather than like a web page in a frame.
 */

import { ReactNode, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { color, glow, motion, radius, shadow, space, tint, type } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Text ─────────────────────────────────────────────────────────────────────
type TypeVariant = keyof typeof type;

export function Txt({
  variant = "body",
  c = color.text,
  style,
  children,
  numberOfLines,
}: {
  variant?: TypeVariant;
  /** Colour. Named `c` because `color` is the imported palette. */
  c?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[type[variant] as TextStyle, { color: c }, style]}
    >
      {children}
    </Text>
  );
}

/** Uppercase section eyebrow. */
export function Label({ children, c = color.textFaint }: { children: ReactNode; c?: string }) {
  return (
    <Text style={[type.label as TextStyle, { color: c, textTransform: "uppercase" }]}>
      {children}
    </Text>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  children,
  accent,
  style,
  padded = true,
}: {
  children: ReactNode;
  /** Accent colour — tints the fill and border. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        padded && { padding: space.xl },
        accent
          ? { backgroundColor: tint(accent, 0.06), borderColor: tint(accent, 0.2) }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Card that responds to touch. Scales down and fires a light tap. */
export function PressCard({
  children,
  onPress,
  accent,
  style,
  disabled,
  haptic = "light",
}: {
  children: ReactNode;
  onPress: () => void;
  accent?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: "light" | "medium" | "none";
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.97, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      onPress={() => {
        if (haptic !== "none") {
          void Haptics.impactAsync(
            haptic === "medium"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
        }
        onPress();
      }}
      style={[
        styles.card,
        { padding: space.xl },
        accent
          ? { backgroundColor: tint(accent, 0.06), borderColor: tint(accent, 0.2) }
          : null,
        disabled && { opacity: 0.45 },
        animated,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({
  label,
  onPress,
  variant = "primary",
  accent = color.green,
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isOff = disabled || loading;

  const body = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? color.bg : accent}
        />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={variant === "primary" ? color.bg : accent}
            />
          ) : null}
          <Text
            style={[
              type.bodyStrong as TextStyle,
              { color: variant === "primary" ? color.bg : accent },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </>
  );

  return (
    <AnimatedPressable
      disabled={isOff}
      onPressIn={() => {
        scale.value = withSpring(0.96, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={[styles.btn, isOff && { opacity: 0.5 }, animated, style]}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={[accent, color.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnInner}
        >
          {body}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.btnInner,
            variant === "secondary"
              ? { backgroundColor: tint(accent, 0.12), borderWidth: 1, borderColor: tint(accent, 0.3) }
              : null,
          ]}
        >
          {body}
        </View>
      )}
    </AnimatedPressable>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
export function Chip({
  label,
  accent = color.textMuted,
  selected,
  onPress,
  icon,
}: {
  label: string;
  accent?: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? tint(accent, 0.16) : "rgba(255,255,255,0.04)",
          borderColor: selected ? tint(accent, 0.4) : color.border,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={selected ? accent : color.textFaint} /> : null}
      <Text
        style={[
          type.small as TextStyle,
          { color: selected ? accent : color.textMuted, fontWeight: selected ? "700" : "500" },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      {content}
    </Pressable>
  );
}

/** Small status pill — "Live", "Beta", "Coming soon". */
export function Badge({ label, accent }: { label: string; accent: string }) {
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: tint(accent, 0.14),
        borderWidth: 1,
        borderColor: tint(accent, 0.28),
      }}
    >
      <Text style={[type.label as TextStyle, { color: accent, fontSize: 9 }]}>{label}</Text>
    </View>
  );
}

// ─── Screen scaffolding ───────────────────────────────────────────────────────
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Txt variant="display">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({
  children,
  accent,
  style,
}: {
  children: ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: space.md, marginTop: space.xl }, style]}>
      <Label c={accent ?? color.textFaint}>{children}</Label>
    </View>
  );
}

/** Empty / zero-data state. Honest placeholder rather than fake content. */
export function EmptyState({
  icon,
  title,
  body,
  accent = color.textFaint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.lg,
          backgroundColor: tint(accent, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: space.md,
        }}
      >
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <Txt variant="bodyStrong" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      <Txt
        variant="small"
        c={color.textMuted}
        style={{ textAlign: "center", marginTop: 4, maxWidth: 260 }}
      >
        {body}
      </Txt>
    </Card>
  );
}

/** Soft aurora wash behind a screen. Purely decorative. */
export function AuroraBackdrop({ accent = color.green }: { accent?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[tint(accent, 0.13), "transparent"]}
        style={{ position: "absolute", top: -180, left: -120, width: 420, height: 420, borderRadius: 210 }}
      />
      <LinearGradient
        colors={[tint(color.purple, 0.1), "transparent"]}
        style={{ position: "absolute", top: 120, right: -160, width: 380, height: 380, borderRadius: 190 }}
      />
    </View>
  );
}

/** Three-dot typing indicator. */
export function TypingDots({ accent }: { accent: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} accent={accent} delay={i * 160} />
      ))}
    </View>
  );
}

function Dot({ accent, delay }: { accent: string; delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    // Stagger each dot, then pulse forever on the UI thread.
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420 }),
          withTiming(0.3, { duration: 420 })
        ),
        -1,
        false
      )
    );
  }, [delay, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }, animated]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    ...shadow.card,
  },
  btn: {
    borderRadius: radius.pill,
    overflow: "hidden",
    ...glow(color.green, 0.22),
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: 15,
    paddingHorizontal: space.xxl,
    borderRadius: radius.pill,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: space.xl,
  },
});
