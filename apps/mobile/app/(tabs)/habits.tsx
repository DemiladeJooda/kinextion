import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

import {
  AuroraBackdrop,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useAppState, type Habit } from "../../lib/store";
import { categoryColor, color, radius, space, tint } from "../../theme";

const CATEGORY_LABEL: Record<string, string> = {
  physical: "Body",
  mental: "Mind",
  emotional: "Heart",
  spiritual: "Spirit",
};

export default function HabitsScreen() {
  const { habits, toggleHabit, score } = useAppState();
  const done = habits.filter((h) => h.done).length;
  const pct = habits.length ? done / habits.length : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.amber} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Habits" subtitle="Small enough to win. Every single day." />

        {/* Progress summary */}
        <Card accent={done === habits.length && done > 0 ? color.green : undefined}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
            <Txt variant="display" c={color.green}>
              {done}
            </Txt>
            <Txt variant="heading" c={color.textFaint} style={{ marginBottom: 5 }}>
              / {habits.length}
            </Txt>
            <View style={{ flex: 1 }} />
            {score !== null ? (
              <View style={{ alignItems: "flex-end" }}>
                <Label>Score</Label>
                <Txt variant="heading" c={color.teal}>
                  {score}
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
              <HabitRow habit={h} onToggle={() => toggleHabit(h.id)} />
            </Animated.View>
          ))}
        </View>

        <Card style={{ marginTop: space.xl }} accent={color.blue}>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Ionicons name="bulb-outline" size={18} color={color.blue} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" c={color.blue}>
                The two-minute rule
              </Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                If a habit keeps slipping, shrink it until it takes two minutes.
                A habit you actually do beats one you plan to do. Ask Althea to
                resize any of these.
              </Txt>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function HabitRow({ habit, onToggle }: { habit: Habit; onToggle: () => void }) {
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
          <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
            {habit.cue}
          </Txt>
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
      </View>
    </PressCard>
  );
}
