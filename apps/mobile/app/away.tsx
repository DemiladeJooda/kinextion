/**
 * Going away, and coming back.
 *
 * Away: pick why (travel, illness, family, a move), roughly when you're back,
 * and which habits to pause — all of them by default. Nothing counts as
 * missed while you're gone.
 *
 * Back: the habits restart, and each one's cue gets a quick check. A new job
 * or a new city often means "after I pour my coffee" isn't a moment any
 * more, and a habit with no cue is the one that quietly stops. "Still works"
 * or "Change it" — one tap each.
 */

import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { addDays, today } from "@kinextion/shared";

import { AuroraBackdrop, Button, Card, Chip, Label, Notice, ScreenHeader, Txt } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { useAppState } from "../lib/store";
import type { AwayReason, RemoteAway, RestartedHabit } from "../services";
import { color, space } from "../theme";

const REASONS: { value: AwayReason; label: string; icon: "airplane-outline" | "medkit-outline" | "people-outline" | "home-outline" | "pause-outline" }[] = [
  { value: "travel", label: "Travelling", icon: "airplane-outline" },
  { value: "illness", label: "Unwell", icon: "medkit-outline" },
  { value: "family", label: "Family", icon: "people-outline" },
  { value: "move", label: "Moving", icon: "home-outline" },
  { value: "other", label: "Something else", icon: "pause-outline" },
];

const LENGTHS = [
  { label: "A few days", days: 3 },
  { label: "A week", days: 7 },
  { label: "Two weeks", days: 14 },
  { label: "Not sure", days: null },
] as const;

export default function AwayScreen() {
  const api = useApi();
  const router = useRouter();
  const { habits, refresh } = useAppState();
  const [away, setAway] = useState<RemoteAway | null | undefined>(undefined);
  const [reason, setReason] = useState<AwayReason>("travel");
  const [length, setLength] = useState<number | null>(7);
  const active = habits.filter((h) => h.status !== "paused");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restarted, setRestarted] = useState<RestartedHabit[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getAway().then(setAway).catch(() => setAway(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setChosen(new Set(active.map((h) => h.id))), [active.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const goAway = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.startAway({
        reason,
        ...(length ? { until: addDays(today(), length) } : {}),
        habitIds: [...chosen],
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't pause your habits.");
      setBusy(false);
    }
  };

  const comeBack = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.endAway();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRestarted(r.restarted);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't restart your habits.");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: away ? "Welcome back" : "Going away",
        headerStyle: { backgroundColor: color.bg },
        headerShadowVisible: false,
        headerTintColor: color.text,
        headerBackTitle: "Back",
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      {header}
      <AuroraBackdrop accent={color.blue} />
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.lg }}>
        {away === undefined ? null : restarted ? (
          // ── Back: does each cue still fit? ───────────────────────────────
          <>
            <ScreenHeader
              title="Good to have you back"
              subtitle="Your habits are back on. Nothing counted while you were away. Quick check: do these moments still happen?"
            />
            {restarted.length === 0 ? (
              <Card>
                <Txt variant="body" c={color.textMuted}>
                  Nothing needed restarting.
                </Txt>
              </Card>
            ) : (
              restarted.map((h, i) => (
                <Animated.View key={h.id} entering={FadeInDown.delay(i * 60)}>
                  <Card>
                    <Txt variant="bodyStrong">{h.name}</Txt>
                    <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                      {h.plan}
                    </Txt>
                    {checked.has(h.id) ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md }}>
                        <Ionicons name="checkmark-circle" size={16} color={color.green} />
                        <Txt variant="small" c={color.green}>
                          Still works
                        </Txt>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
                        <Chip
                          label="Still works"
                          accent={color.green}
                          onPress={() => setChecked((prev) => new Set([...prev, h.id]))}
                        />
                        <Chip label="Change it" accent={color.amber} onPress={() => router.push(`/habit/${h.id}` as never)} />
                      </View>
                    )}
                  </Card>
                </Animated.View>
              ))
            )}
            <Button label="Done" accent={color.blue} onPress={() => router.back()} />
          </>
        ) : away ? (
          // ── Away now ────────────────────────────────────────────────────
          <>
            <ScreenHeader
              title="Ready to pick back up?"
              subtitle={`${away.habits.length} habit${away.habits.length === 1 ? " is" : "s are"} paused. Coming back turns the days away into rest days, so nothing counts as missed.`}
            />
            <Card>
              <Label>Paused</Label>
              <View style={{ gap: space.xs, marginTop: space.sm }}>
                {away.habits.map((h) => (
                  <Txt key={h.id} variant="body">
                    {h.name}
                  </Txt>
                ))}
              </View>
            </Card>
            {error ? <Notice>{error}</Notice> : null}
            <Button label="I'm back" accent={color.blue} loading={busy} onPress={comeBack} />
          </>
        ) : (
          // ── Going away ──────────────────────────────────────────────────
          <>
            <ScreenHeader
              title="Going away?"
              subtitle="Pause your habits so nothing counts as missed. When you're back, we'll check each one still fits."
            />
            <Card>
              <Label>What's happening</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
                {REASONS.map((r) => (
                  <Chip key={r.value} label={r.label} icon={r.icon} accent={color.blue} selected={reason === r.value} onPress={() => setReason(r.value)} />
                ))}
              </View>
            </Card>
            <Card>
              <Label>For about</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
                {LENGTHS.map((l) => (
                  <Chip key={l.label} label={l.label} accent={color.blue} selected={length === l.days} onPress={() => setLength(l.days)} />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
                Just a guess is fine. You can come back any time.
              </Txt>
            </Card>
            <Card>
              <Label>Pause</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
                {active.map((h) => (
                  <Chip
                    key={h.id}
                    label={h.name}
                    accent={color.blue}
                    selected={chosen.has(h.id)}
                    onPress={() =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (next.has(h.id)) next.delete(h.id);
                        else next.add(h.id);
                        return next;
                      })
                    }
                  />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
                Keep one going if it travels well, like drinking water.
              </Txt>
            </Card>
            {error ? <Notice>{error}</Notice> : null}
            <Button
              label={chosen.size ? `Pause ${chosen.size} habit${chosen.size === 1 ? "" : "s"}` : "Nothing to pause"}
              accent={color.blue}
              loading={busy}
              disabled={!chosen.size}
              onPress={goAway}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
