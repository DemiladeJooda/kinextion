/**
 * Habits & streaks — the healthy-use settings.
 *
 * Streaks help many people and stress some. Zoe Chance's own pedometer story
 * is the warning: when the number becomes the goal, it stops serving the
 * habit. So streaks can be switched off entirely; consistency, the calendar
 * and the "automatic yet?" curve still show progress without a count to
 * protect.
 */

import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";

import { AuroraBackdrop, Card, ScreenHeader, Txt } from "../../components/ui";
import { useAppState } from "../../lib/store";
import { color, space, tint } from "../../theme";

export default function HabitSettingsScreen() {
  const { showStreaks, setShowStreaks } = useAppState();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["bottom"]}
    >
      <Stack.Screen
        options={{
          title: "Habits & streaks",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: space.xxxl,
          gap: space.md,
        }}
      >
        <ScreenHeader
          title="Habits & streaks"
          subtitle="Progress that helps, without a number to protect."
        />

        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Show streaks</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                Turn off if counting days makes it feel like a test. Your
                calendar, consistency and the weekly &quot;automatic yet?&quot;
                check still show how it&apos;s going.
              </Txt>
            </View>
            <Switch
              value={showStreaks}
              onValueChange={(v) => {
                void Haptics.selectionAsync();
                void setShowStreaks(v);
              }}
              trackColor={{
                false: "rgba(255,255,255,0.08)",
                true: tint(color.teal, 0.45),
              }}
              thumbColor={showStreaks ? color.teal : "#64748B"}
              accessibilityLabel="Show streaks"
            />
          </View>
        </Card>

        <Card accent={color.purple}>
          <Txt variant="bodyStrong" c={color.purple}>
            Kinextion keeps an eye out for you
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
            If the app starts looking like the habit — dozens of opens a day,
            logging after midnight most nights, ticking the same thing on and
            off — Kairo will check in gently. It never blocks you. These counts
            stay on this phone and are never sent anywhere.
          </Txt>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
