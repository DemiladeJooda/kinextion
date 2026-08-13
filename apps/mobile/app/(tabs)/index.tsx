import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GUIDES } from "@kinextion/ai-core";

import { ScoreRing } from "../../components/ScoreRing";
import { MicroRecommendation } from "../../components/MicroRecommendation";
import {
  AuroraBackdrop,
  Badge,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint } from "../../theme";

/** Signals the app is currently reading — mirrors the website's taxonomy. */
const LIVE_SIGNALS = [
  { icon: "walk-outline", label: "Movement", value: "4,820 steps", accent: color.green },
  { icon: "moon-outline", label: "Sleep", value: "6h 41m", accent: color.purple },
  { icon: "calendar-outline", label: "Schedule", value: "3 meetings", accent: color.blue },
  { icon: "people-outline", label: "Pod", value: "2 active", accent: color.teal },
] as const;

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Winding down";
}

export default function TodayScreen() {
  const router = useRouter();
  const { score, habits, logMood } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const greeting = useMemo(() => greetingFor(now.getHours()), [now]);
  const doneCount = habits.filter((h) => h.done).length;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Nothing to re-fetch until the habits API is wired; the gesture still
    // exists so the screen feels alive and the seam is obvious.
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.green} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.textFaint}
          />
        }
      >
        <ScreenHeader
          title={greeting}
          subtitle={now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        />

        {/* ── Score ─────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
            <Label>Kinextion Score</Label>
            <View style={{ marginVertical: space.lg }}>
              <ScoreRing score={score} />
            </View>
            <Txt
              variant="small"
              c={color.textMuted}
              style={{ textAlign: "center", maxWidth: 250 }}
            >
              {score === null
                ? "Complete one habit to start today's score. Something always beats nothing."
                : `${doneCount} of ${habits.length} habits done. Every one moves the dial.`}
            </Txt>
          </Card>
        </Animated.View>

        {/* ── Today's one thing ─────────────────────────────────────────── */}
        <SectionTitle accent={color.purple}>Today&apos;s one thing</SectionTitle>
        <Animated.View entering={FadeInDown.duration(500).delay(80)}>
          <MicroRecommendation />
        </Animated.View>

        {/* ── Talk to a guide ───────────────────────────────────────────── */}
        <SectionTitle>Talk to a guide</SectionTitle>
        <View style={{ flexDirection: "row", gap: space.md }}>
          {(["altheo", "kairo"] as const).map((id, i) => {
            const g = GUIDES[id];
            return (
              <Animated.View
                key={id}
                style={{ flex: 1 }}
                entering={FadeInDown.duration(450).delay(120 + i * 60)}
              >
                <PressCard
                  accent={g.color}
                  onPress={() => router.push(`/chat/${id}` as never)}
                  style={{ padding: space.lg }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: tint(g.color, 0.14),
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: space.md,
                    }}
                  >
                    <Ionicons
                      name={id === "altheo" ? "flash" : "water"}
                      size={20}
                      color={g.color}
                    />
                  </View>
                  <Txt variant="heading" c={g.color}>
                    {g.name}
                  </Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                    {g.role}
                  </Txt>
                </PressCard>
              </Animated.View>
            );
          })}
        </View>

        {/* ── What Kinextion is reading ─────────────────────────────────── */}
        <SectionTitle>What Kinextion is reading</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {LIVE_SIGNALS.map((s, i) => (
            <View
              key={s.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: color.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.sm,
                  backgroundColor: tint(s.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={s.icon} size={16} color={s.accent} />
              </View>
              <Txt variant="body" style={{ flex: 1 }}>
                {s.label}
              </Txt>
              <Txt variant="bodyStrong" c={s.accent}>
                {s.value}
              </Txt>
            </View>
          ))}
        </Card>
        <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
          Sample readings. Connect Apple Health or Oura in Profile to use your own.
        </Txt>

        {/* ── Mood check-in ─────────────────────────────────────────────── */}
        <SectionTitle>How are you, really?</SectionTitle>
        <MoodStrip onLog={logMood} />

        {/* ── Feature shortcuts ─────────────────────────────────────────── */}
        <SectionTitle accent={color.amber}>In your pocket</SectionTitle>
        <View style={{ gap: space.md }}>
          <FeatureRow
            icon="videocam-outline"
            title="Smart Referee"
            body="Calls the game, and shows you why."
            accent={color.green}
            onPress={() => router.push("/features/referee" as never)}
          />
          <FeatureRow
            icon="body-outline"
            title="Form Control"
            body="Each checkpoint scored, with the reason."
            accent={color.amber}
            onPress={() => router.push("/features/form" as never)}
          />
          <FeatureRow
            icon="color-filter-outline"
            title="Environment Design"
            body="Reads your actual room. Names the fixes."
            accent={color.teal}
            onPress={() => router.push("/features/environment" as never)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Mood strip ───────────────────────────────────────────────────────────────
const MOODS = [
  { emoji: "😞", label: "Rough", accent: color.red },
  { emoji: "😐", label: "Flat", accent: color.amber },
  { emoji: "🙂", label: "Okay", accent: color.blue },
  { emoji: "😄", label: "Good", accent: color.green },
  { emoji: "🤩", label: "Great", accent: color.purple },
] as const;

function MoodStrip({ onLog }: { onLog: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {MOODS.map((m, i) => {
          const active = picked === i;
          return (
            <PressCard
              key={m.label}
              accent={active ? m.accent : undefined}
              haptic="medium"
              onPress={() => {
                setPicked(i);
                onLog();
              }}
              style={{
                flex: 1,
                marginHorizontal: 3,
                paddingVertical: space.md,
                paddingHorizontal: 0,
                alignItems: "center",
                backgroundColor: active ? tint(m.accent, 0.12) : "transparent",
                borderColor: active ? tint(m.accent, 0.32) : "transparent",
                shadowOpacity: 0,
                elevation: 0,
              }}
            >
              <Txt variant="heading" style={{ fontSize: 26 }}>
                {m.emoji}
              </Txt>
              <Txt
                variant="small"
                c={active ? m.accent : color.textFaint}
                style={{ marginTop: 4, fontSize: 11 }}
              >
                {m.label}
              </Txt>
            </PressCard>
          );
        })}
      </View>
      {picked !== null ? (
        <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
          Logged. Kairo will pick this up next time you talk.
        </Txt>
      ) : null}
    </Card>
  );
}

// ─── Feature row ──────────────────────────────────────────────────────────────
function FeatureRow({
  icon,
  title,
  body,
  accent,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <PressCard accent={accent} onPress={onPress} style={{ padding: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.md,
            backgroundColor: tint(accent, 0.14),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={21} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Txt variant="bodyStrong">{title}</Txt>
            {badge ? <Badge label={badge} accent={accent} /> : null}
          </View>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
            {body}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
      </View>
    </PressCard>
  );
}
