import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useState } from "react";
import * as Haptics from "expo-haptics";

import {
  AuroraBackdrop,
  Badge,
  Card,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint } from "../../theme";

/**
 * Data sources the app can read.
 *
 * These toggles are UI-only until the HealthKit / Oura integrations land —
 * labelled as such rather than implying a connection that isn't there.
 */
const SOURCES = [
  { id: "health", icon: "heart-outline", label: "Apple Health", detail: "Steps, heart rate, sleep", accent: color.green },
  { id: "oura", icon: "ellipse-outline", label: "Oura Ring", detail: "Readiness, HRV, temperature", accent: color.purple },
  { id: "calendar", icon: "calendar-outline", label: "Calendar", detail: "Load and open windows", accent: color.blue },
  { id: "spotify", icon: "musical-notes-outline", label: "Spotify", detail: "Environment Design playlists", accent: color.teal },
] as const;

const SETTINGS = [
  { icon: "person-outline", label: "Edit profile", accent: color.text },
  { icon: "notifications-outline", label: "Notifications", accent: color.text },
  { icon: "shield-checkmark-outline", label: "Privacy & data", accent: color.text },
  { icon: "help-circle-outline", label: "Help & support", accent: color.text },
  { icon: "log-out-outline", label: "Sign out", accent: color.red },
] as const;

export default function ProfileScreen() {
  const { habits, score, resetDay } = useAppState();
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const longestStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Profile" />

        {/* Identity card */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  backgroundColor: tint(color.green, 0.14),
                  borderWidth: 2,
                  borderColor: tint(color.green, 0.3),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt variant="title" c={color.green}>
                  K
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="heading">Not signed in</Txt>
                <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                  Sign in to sync habits across devices
                </Txt>
              </View>
            </View>

            <View style={{ flexDirection: "row", marginTop: space.xl, gap: space.md }}>
              <Stat label="Score" value={score === null ? "—" : String(score)} accent={color.teal} />
              <Stat label="Best streak" value={`${longestStreak}d`} accent={color.amber} />
              <Stat label="Habits" value={String(habits.length)} accent={color.green} />
            </View>
          </Card>
        </Animated.View>

        {/* Data sources */}
        <SectionTitle>Data sources</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {SOURCES.map((s, i) => (
            <View
              key={s.id}
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
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: tint(s.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={s.icon} size={17} color={s.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="body">{s.label}</Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
                  {s.detail}
                </Txt>
              </View>
              <Switch
                value={!!connected[s.id]}
                onValueChange={(v) => {
                  void Haptics.selectionAsync();
                  setConnected((p) => ({ ...p, [s.id]: v }));
                }}
                trackColor={{ false: "rgba(255,255,255,0.08)", true: tint(s.accent, 0.45) }}
                thumbColor={connected[s.id] ? s.accent : "#64748B"}
              />
            </View>
          ))}
        </Card>
        <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
          Integrations are not live yet — these toggles record your preference so
          the connection happens the moment each one ships.
        </Txt>

        {/* Settings */}
        <SectionTitle>Settings</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {SETTINGS.map((s, i) => (
            <PressCard
              key={s.label}
              onPress={() => {}}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                backgroundColor: "transparent",
                borderWidth: 0,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: color.border,
                borderRadius: 0,
                shadowOpacity: 0,
                elevation: 0,
              }}
            >
              <Ionicons name={s.icon} size={18} color={s.accent} />
              <Txt variant="body" c={s.accent} style={{ flex: 1 }}>
                {s.label}
              </Txt>
              <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
            </PressCard>
          ))}
        </Card>

        {/* Dev affordance — resetting the day makes the score ring easy to demo. */}
        <SectionTitle>Developer</SectionTitle>
        <PressCard onPress={resetDay} accent={color.amber} style={{ padding: space.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Ionicons name="refresh-outline" size={18} color={color.amber} />
            <View style={{ flex: 1 }}>
              <Txt variant="body" c={color.amber}>
                Reset today
              </Txt>
              <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
                Clears habits, mood, and score
              </Txt>
            </View>
          </View>
        </PressCard>

        <View style={{ alignItems: "center", marginTop: space.xxl, gap: space.sm }}>
          <Badge label="Kinextion 0.1.0" accent={color.textFaint} />
          <Txt variant="small" c={color.textFaint}>
            Made for people who are done starting over.
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint(accent, 0.07),
        borderWidth: 1,
        borderColor: tint(accent, 0.16),
        borderRadius: radius.md,
        paddingVertical: space.md,
        alignItems: "center",
      }}
    >
      <Txt variant="heading" c={accent}>
        {value}
      </Txt>
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 11, marginTop: 1 }}>
        {label}
      </Txt>
    </View>
  );
}
