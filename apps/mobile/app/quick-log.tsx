/**
 * kinextion://quick-log?habit=<id>&state=done
 *
 * Where a widget button lands: log the habit, then show Today. Logs go
 * through the same rules as a tap and are marked as coming from the widget.
 */

import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useAppState } from "../lib/store";
import { color } from "../theme";

export default function QuickLog() {
  const { habit, state } = useLocalSearchParams<{ habit?: string; state?: string }>();
  const { habits, setHabitDay } = useAppState();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const target = habits.find((h) => h.id === habit);
    // Habits load after sign-in; wait for them rather than giving up.
    if (habit && !target && habits.length === 0) return;
    done.current = true;
    void (async () => {
      if (target) {
        const s = state === "minimum" ? "minimum" : "done";
        if (!target.done) {
          await setHabitDay(target.id, s, { source: "widget" });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      router.replace("/(tabs)/habits" as never);
    })();
  }, [habits, habit, state, setHabitDay, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.bg }}>
      <ActivityIndicator color={color.green} />
    </View>
  );
}
