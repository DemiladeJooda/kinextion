/**
 * Shared UI primitives.
 *
 * Screens compose these rather than restyling Views, so spacing, elevation,
 * and press feedback stay identical everywhere. Every interactive element
 * fires haptics — on a phone that tactile confirmation is most of what makes
 * an app feel finished rather than like a web page in a frame.
 */

import { ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
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
    <Text numberOfLines={numberOfLines} style={[type[variant] as TextStyle, { color: c }, style]}>
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
          ? {
              backgroundColor: tint(accent, 0.06),
              borderColor: tint(accent, 0.2),
            }
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
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
          ? {
              backgroundColor: tint(accent, 0.06),
              borderColor: tint(accent, 0.2),
            }
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
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const isOff = disabled || loading;

  const body = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? color.bg : accent} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={18} color={variant === "primary" ? color.bg : accent} />
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
              ? {
                  backgroundColor: tint(accent, 0.12),
                  borderWidth: 1,
                  borderColor: tint(accent, 0.3),
                }
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
          {
            color: selected ? accent : color.textMuted,
            fontWeight: selected ? "700" : "500",
          },
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

// ─── Text input ───────────────────────────────────────────────────────────────
/**
 * Labelled text field.
 *
 * The mic on the user's own keyboard is the dictation path throughout the app,
 * which is why multiline fields are generous and never auto-capitalise
 * mid-sentence — a spoken journal entry arrives as one long run of text and
 * shouldn't be fought by the field it lands in.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  accent = color.green,
  autoFocus,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  accent?: string;
  autoFocus?: boolean;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Label c={focused ? accent : color.textFaint}>{label}</Label>
        <View style={{ flex: 1 }} />
        {maxLength && value.length > maxLength * 0.75 ? (
          <Text style={[type.small as TextStyle, { color: color.textFaint, fontSize: 11 }]}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Dictated text arrives as continuous prose; sentence-casing it again
        // produces stray capitals mid-thought.
        autoCapitalize={multiline ? "sentences" : "none"}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          type.body as TextStyle,
          {
            color: color.text,
            backgroundColor: color.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: focused ? tint(accent, 0.4) : color.border,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            minHeight: multiline ? 110 : 48,
          },
        ]}
      />

      {hint ? (
        <Text style={[type.small as TextStyle, { color: color.textFaint, fontSize: 12 }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Scale ────────────────────────────────────────────────────────────────────
/**
 * A 1–10 picker rendered as ten bars.
 *
 * Bars rather than a slider: a slider invites a value nobody meant, and on a
 * phone it's the hardest control to hit accurately one-handed. Ten taps are
 * ten unambiguous answers, and an unset scale stays visibly unset rather than
 * defaulting to the middle and recording a number the user never chose.
 */
export function Scale({
  value,
  onChange,
  accent,
  lowLabel,
  highLabel,
}: {
  value: number | null;
  onChange: (next: number) => void;
  accent: string;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = value !== null && n <= value;
          return (
            <Pressable
              key={n}
              accessibilityRole="adjustable"
              accessibilityLabel={`${n} out of 10`}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(n);
              }}
              style={{ flex: 1, paddingVertical: space.sm }}
            >
              <View
                style={{
                  height: 32,
                  borderRadius: radius.sm,
                  backgroundColor: active ? tint(accent, 0.9) : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderColor: active ? tint(accent, 0.5) : color.border,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[type.small as TextStyle, { color: color.textFaint, fontSize: 11 }]}>
          {lowLabel}
        </Text>
        <View style={{ flex: 1, alignItems: "center" }}>
          {value !== null ? (
            <Text style={[type.small as TextStyle, { color: accent, fontWeight: "700" }]}>
              {value}
            </Text>
          ) : null}
        </View>
        <Text style={[type.small as TextStyle, { color: color.textFaint, fontSize: 11 }]}>
          {highLabel}
        </Text>
      </View>
    </View>
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
        style={{
          position: "absolute",
          top: -180,
          left: -120,
          width: 420,
          height: 420,
          borderRadius: 210,
        }}
      />
      <LinearGradient
        colors={[tint(color.purple, 0.1), "transparent"]}
        style={{
          position: "absolute",
          top: 120,
          right: -160,
          width: 380,
          height: 380,
          borderRadius: 190,
        }}
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
        withSequence(withTiming(1, { duration: 420 }), withTiming(0.3, { duration: 420 })),
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

// ─── Navigation ───────────────────────────────────────────────────────────────
/**
 * Bottom inset for scrollable tab screens. On iOS the tab bar floats over the
 * content (so it can blur what's beneath), which means the last card needs
 * this much room to scroll clear of it.
 */
export const TAB_BAR_CLEARANCE = Platform.OS === "ios" ? 120 : space.xxxl;

/** Round back control for screens that draw their own header. */
export function BackButton({ onPress, label }: { onPress?: () => void; label?: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? "Back"}
      hitSlop={10}
      onPress={() => {
        void Haptics.selectionAsync();
        if (onPress) onPress();
        else if (router.canGoBack()) router.back();
        else router.replace("/(tabs)" as never);
      }}
      style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="chevron-back" size={20} color={color.text} />
      {label ? (
        <Text style={[type.small as TextStyle, { color: color.text, fontWeight: "600" }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
/** Shimmering placeholder block. Shapes the page before data lands. */
export function Skeleton({
  height = 16,
  width = "100%",
  style,
}: {
  height?: number;
  width?: ViewStyle["width"];
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 850 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius.sm,
          backgroundColor: color.surfaceAlt,
        },
        animated,
        style,
      ]}
    />
  );
}

/** A card-shaped skeleton — the common case. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <Card style={{ gap: space.sm, marginBottom: space.sm }}>
      <Skeleton height={20} width="55%" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? "70%" : "100%"} />
      ))}
    </Card>
  );
}

// ─── Brand ────────────────────────────────────────────────────────────────────
/** The Kinextion mark: two interlocking aurora rings, gently breathing. */
export function BrandMark({ size = 64, animate = true }: { size?: number; animate?: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!animate) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })),
      -1,
      false
    );
  }, [animate, pulse]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const ring = size * 0.62;

  return (
    <Animated.View style={[{ width: size, height: size }, glow(color.green, 0.45), animated]}>
      <LinearGradient
        colors={[tint(color.green, 0.22), tint(color.purple, 0.22)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: size * 0.3,
          borderWidth: 1,
          borderColor: color.borderStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: ring * 1.45, height: ring }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderWidth: size * 0.06,
              borderColor: color.green,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 0,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderWidth: size * 0.06,
              borderColor: color.purple,
            }}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/** Text input with a leading icon and optional reveal toggle — auth forms. */
export function IconField({
  icon,
  value,
  onChangeText,
  placeholder,
  secure,
  accent = color.green,
  inputProps,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  secure?: boolean;
  accent?: string;
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "secureTextEntry">;
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View
      style={[
        styles.iconField,
        focused && {
          borderColor: tint(accent, 0.55),
          backgroundColor: tint(accent, 0.05),
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={focused ? accent : color.textFaint} />
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        secureTextEntry={secure && !revealed}
        selectionColor={accent}
        onFocus={(e) => {
          setFocused(true);
          inputProps?.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps?.onBlur?.(e);
        }}
        style={[type.body as TextStyle, { flex: 1, color: color.text, paddingVertical: 15 }]}
      />
      {secure ? (
        <Pressable
          hitSlop={10}
          accessibilityLabel={revealed ? "Hide password" : "Show password"}
          onPress={() => {
            void Haptics.selectionAsync();
            setRevealed((r) => !r);
          }}
        >
          <Ionicons
            name={revealed ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={color.textFaint}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Inline error/notice banner. */
export function Notice({
  children,
  accent = color.red,
  icon = "alert-circle",
}: {
  children: ReactNode;
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: tint(accent, 0.1),
        borderWidth: 1,
        borderColor: tint(accent, 0.25),
      }}
    >
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={[type.small as TextStyle, { color: accent, flex: 1 }]}>{children}</Text>
    </Animated.View>
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
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    minWidth: 40,
    height: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: space.lg,
  },
  iconField: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
  },
});
