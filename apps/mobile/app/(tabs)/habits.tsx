import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

import { MicroRecommendation } from "../../components/MicroRecommendation";
import {
  TAB_BAR_CLEARANCE,
  AuroraBackdrop,
  Button,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { useAppState, type Habit } from "../../lib/store";
import { categoryColor, color, radius, space, tint } from "../../theme";

const CATEGORY_LABEL: Record<string, string> = {
  physical: "Body",
  mental: "Mind",
  emotional: "Heart",
  spiritual: "Spirit",
};

/** Real signals derived from what Kinextion actually tracks today — no
 * wearable data yet, so this shows habits/mood/streak rather than faking
 * steps or sleep. Once Integrations (Strava/Whoop/Oura) ship, connected
 * sources join this list instead of replacing it. */
function liveSignals(habits: Habit[], moodLogged: boolean, score: number | null) {
  const done = habits.filter((h) => h.done).length;
  const longestStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  return [
    {
      icon: "checkbox-outline" as const,
      label: "Habits today",
      value: `${done} / ${habits.length}`,
      accent: color.green,
    },
    {
      icon: "flame-outline" as const,
      label: "Longest streak",
      value: longestStreak > 0 ? `${longestStreak}d` : "Not started",
      accent: color.amber,
    },
    {
      icon: "heart-outline" as const,
      label: "Mood today",
      value: moodLogged ? "Logged" : "Not logged",
      accent: color.purple,
    },
    {
      icon: "pulse-outline" as const,
      label: "Kinextion Score",
      value: score === null ? "—" : String(score),
      accent: color.teal,
    },
  ];
}

const PERIOD_LABEL: Record<"weekly" | "monthly" | "yearly", string> = {
  weekly: "Score (week)",
  monthly: "Score (month)",
  yearly: "Score (year)",
};

export default function HabitsScreen() {
  const router = useRouter();
  const { habits, toggleHabit, score, periodScore, moodLogged, reflectionLogged, refresh } =
    useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const signals = liveSignals(habits, moodLogged, score);

  const done = habits.filter((h) => h.done).length;
  const pct = habits.length ? done / habits.length : 0;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  const openNew = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/habit/new" as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.amber} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
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
          title="Habits"
          subtitle="Small enough to win. Every single day."
          right={
            habits.length > 0 ? (
              <Pressable
                onPress={openNew}
                accessibilityRole="button"
                accessibilityLabel="Add a habit"
                hitSlop={10}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tint(color.amber, 0.14),
                  borderWidth: 1,
                  borderColor: tint(color.amber, 0.3),
                }}
              >
                <Ionicons name="add" size={22} color={color.amber} />
              </Pressable>
            ) : undefined
          }
        />

        {habits.length === 0 ? (
          <NoHabitsYet onStart={openNew} />
        ) : (
          <>
            {/* Progress summary */}
            <Card accent={done === habits.length && done > 0 ? color.green : undefined}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: space.sm,
                }}
              >
                <Txt variant="display" c={color.green}>
                  {done}
                </Txt>
                <Txt variant="heading" c={color.textFaint} style={{ marginBottom: 5 }}>
                  / {habits.length}
                </Txt>
                <View style={{ flex: 1 }} />
                {periodScore?.average !== null && periodScore !== null ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Label>{PERIOD_LABEL[periodScore.period]}</Label>
                    <Txt variant="heading" c={color.teal}>
                      {periodScore.average}
                    </Txt>
                  </View>
                ) : null}
              </View>

              {/* Segmented progress — one block per habit, so a glance reads count
                  and completion at the same time. */}
              <View style={{ flexDirection: "row", gap: 4, marginTop: space.lg }}>
                {habits.map((h) => (
                  <Animated.View
                    key={h.id}
                    layout={Layout.springify().damping(18)}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: h.done
                        ? categoryColor[h.category]
                        : "rgba(255,255,255,0.07)",
                    }}
                  />
                ))}
              </View>

              <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
                {done === 0
                  ? "Never a zero day. Pick the easiest one and start there."
                  : pct === 1
                    ? "All of them. That's the whole system working."
                    : `${habits.length - done} left — but you've already broken zero.`}
              </Txt>
            </Card>

            <SectionTitle>Today</SectionTitle>
            <View style={{ gap: space.md }}>
              {habits.map((h, i) => (
                <Animated.View
                  key={h.id}
                  entering={FadeInDown.duration(400).delay(i * 50)}
                  layout={Layout.springify().damping(20)}
                >
                  <HabitRow
                    habit={h}
                    onToggle={() => toggleHabit(h.id)}
                    onEdit={() => router.push(`/habit/${h.id}` as never)}
                  />
                </Animated.View>
              ))}
            </View>

            <Button
              label="Add a habit"
              icon="add"
              variant="secondary"
              accent={color.amber}
              style={{ marginTop: space.xl }}
              onPress={openNew}
            />

            <Card style={{ marginTop: space.xl }} accent={color.blue}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Ionicons name="bulb-outline" size={18} color={color.blue} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" c={color.blue}>
                    The two-minute rule
                  </Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                    If a habit keeps slipping, shrink it until it takes two minutes. A habit you
                    actually do beats one you plan to do — tap any habit above to resize it.
                  </Txt>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* ── Daily check-in ────────────────────────────────────────────── */}
        <SectionTitle accent={color.purple}>How are you, really?</SectionTitle>
        <MoodStrip
          loggedToday={moodLogged}
          reflectionDone={reflectionLogged}
          onLogged={refresh}
          onOpenFull={() => router.push("/checkin" as never)}
        />

        {/* ── Today's one thing ─────────────────────────────────────────── */}
        <SectionTitle>Today&apos;s one thing</SectionTitle>
        <MicroRecommendation />

        {/* ── What Kinextion is reading ─────────────────────────────────── */}
        <SectionTitle>What Kinextion is reading</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {signals.map((s, i) => (
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
          From what you log today. Connect Apple Health or Oura in Profile to add real biometrics.
        </Txt>

        {/* ── Patterns ───────────────────────────────────────────────────── */}
        <PatternsSection />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Patterns ───────────────────────────────────────────────────────────────
/** Real, computed correlations between wearable data, mood, and habits.
 * Silent when there's nothing to show yet — an always-empty section reads
 * worse than no section at all. */
function PatternsSection() {
  const api = useApi();
  const [patterns, setPatterns] = useState<Awaited<ReturnType<typeof api.listPatterns>> | null>(
    null
  );

  useEffect(() => {
    api
      .listPatterns()
      .then(setPatterns)
      .catch(() => setPatterns([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!patterns || patterns.length === 0) return null;

  return (
    <>
      <SectionTitle accent={color.pink}>Patterns</SectionTitle>
      <Card>
        <View style={{ gap: space.md }}>
          {patterns.slice(0, 3).map((p) => (
            <View
              key={`${p.metricType}-${p.summary}`}
              style={{ flexDirection: "row", gap: space.md }}
            >
              <Ionicons
                name="analytics-outline"
                size={16}
                color={color.pink}
                style={{ marginTop: 2 }}
              />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                {p.summary}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </>
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

/** 1-10 scale the mood API expects, evenly spaced across the five taps. */
const MOOD_VALUES = [2, 4, 6, 8, 10] as const;

/**
 * One tap to log a mood, one more to say the rest of it.
 *
 * The strip stays the fast path — five taps' worth of nothing-to-think-about —
 * but it writes through the check-in route, so tapping a face in the morning
 * and writing a journal entry at night edit the same day rather than
 * producing two entries the score has to reconcile.
 */
function MoodStrip({
  loggedToday,
  reflectionDone,
  onLogged,
  onOpenFull,
}: {
  loggedToday: boolean;
  reflectionDone: boolean;
  onLogged: () => Promise<void>;
  onOpenFull: () => void;
}) {
  const api = useApi();
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const onPick = async (i: number) => {
    setPicked(i);
    setFailed(false);
    setSaving(true);
    try {
      await api.submitCheckIn({ mood: MOOD_VALUES[i] });
      await onLogged();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const showLogged = loggedToday || picked !== null;

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
              disabled={saving}
              onPress={() => void onPick(i)}
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
      {failed ? (
        <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
          Couldn't save that. Try again.
        </Txt>
      ) : showLogged ? (
        <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
          Logged. Kairo will pick this up next time you talk.
        </Txt>
      ) : null}

      {/* The rest of the check-in. Framed by what's still unearned rather than
          as a generic "more" link, so the reason to tap it is concrete. */}
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenFull();
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          marginTop: space.lg,
          paddingTop: space.md,
          borderTopWidth: 1,
          borderTopColor: color.border,
        }}
      >
        <Ionicons
          name={reflectionDone ? "checkmark-circle" : "create-outline"}
          size={16}
          color={reflectionDone ? color.green : color.purple}
        />
        <Txt variant="small" c={reflectionDone ? color.green : color.purple} style={{ flex: 1 }}>
          {reflectionDone
            ? "Full check-in done today — tap to edit it"
            : showLogged
              ? "Add energy, stress and a few words — worth 15 points"
              : "Or do the full check-in: energy, stress, gratitude, journal"}
        </Txt>
        <Ionicons name="chevron-forward" size={15} color={color.textFaint} />
      </Pressable>
    </Card>
  );
}

/**
 * The real empty state.
 *
 * This screen used to seed five habits on first load so it never looked bare.
 * That made the app feel populated and quietly capped everyone at the same
 * five forever. An empty list that points at three ways to build the first
 * habit is both more honest and more useful.
 */
function NoHabitsYet({ onStart }: { onStart: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(450)}>
      <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: tint(color.amber, 0.12),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: space.lg,
          }}
        >
          <Ionicons name="leaf-outline" size={26} color={color.amber} />
        </View>
        <Txt variant="heading" style={{ textAlign: "center" }}>
          No habits yet
        </Txt>
        <Txt
          variant="small"
          c={color.textMuted}
          style={{ textAlign: "center", marginTop: space.sm, maxWidth: 280 }}
        >
          Start with one. Kinextion can suggest something from what it already knows about you, work
          it out with you in conversation, or get out of the way while you write your own.
        </Txt>
        <Button
          label="Build your first habit"
          icon="add"
          accent={color.amber}
          style={{ marginTop: space.xl, alignSelf: "stretch" }}
          onPress={onStart}
        />
      </Card>
    </Animated.View>
  );
}

function HabitRow({
  habit,
  onToggle,
  onEdit,
}: {
  habit: Habit;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const accent = categoryColor[habit.category];

  return (
    <PressCard
      accent={habit.done ? accent : undefined}
      haptic="medium"
      onPress={onToggle}
      style={{ padding: space.lg }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {/* Checkbox */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: habit.done ? accent : color.borderStrong,
            backgroundColor: habit.done ? accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {habit.done ? <Ionicons name="checkmark" size={17} color={color.bg} /> : null}
        </View>

        <View style={{ flex: 1 }}>
          <Txt
            variant="bodyStrong"
            c={habit.done ? color.textMuted : color.text}
            style={habit.done ? { textDecorationLine: "line-through" } : undefined}
          >
            {habit.name}
          </Txt>
          {habit.cue ? (
            <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
              {habit.cue}
            </Txt>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <View
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: tint(accent, 0.12),
            }}
          >
            <Txt variant="label" c={accent} style={{ fontSize: 9 }}>
              {CATEGORY_LABEL[habit.category]}
            </Txt>
          </View>
          {habit.streak > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="flame" size={11} color={color.amber} />
              <Txt variant="small" c={color.amber} style={{ fontSize: 11 }}>
                {habit.streak}
              </Txt>
            </View>
          ) : null}
        </View>

        {/* Separate hit target: tapping the row logs the habit, so editing
            needs its own control rather than a long-press nobody discovers. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEdit();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.name}`}
          hitSlop={12}
          style={{ paddingLeft: space.sm }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={color.textFaint} />
        </Pressable>
      </View>
    </PressCard>
  );
}
