/**
 * Reminder settings.
 *
 * Saves the preference to Profile as before, and now actually schedules a
 * local, repeating daily notification at that time via lib/notifications.ts
 * — there's still no server push pipeline, so this is a device-side nudge
 * pointing back at the micro-recommendation card, not that day's specific
 * recommendation text (see notifications.ts for why).
 */

import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  AuroraBackdrop,
  Button,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { cancelDailyReminder, requestNotificationPermission, scheduleDailyReminder } from "../../lib/notifications";
import { color, radius, space, tint } from "../../theme";

/** Times offered. A fixed set beats a wheel picker for a once-a-day choice. */
const TIMES = ["07:00", "08:00", "09:00", "12:00", "18:00", "20:00", "21:00", "22:00"];

export default function NotificationSettingsScreen() {
  const api = useApi();

  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyProfile()
      .then((user) => {
        if (cancelled) return;
        const prefs = user.profile?.preferences;
        setEnabled(prefs?.notificationsEnabled ?? false);
        setTime(prefs?.dailyCheckInTime ?? "20:00");
      })
      .catch(() => setError("Couldn't load your settings."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let actuallyEnabled = enabled;

      if (enabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          actuallyEnabled = false;
          setError(
            "Notifications are blocked for Kinextion in your device settings — the preference below is saved, but nothing will arrive until you allow them there."
          );
        } else {
          await scheduleDailyReminder(time);
        }
      } else {
        await cancelDailyReminder();
      }

      await api.updateProfile({
        preferences: { notificationsEnabled: actuallyEnabled, dailyCheckInTime: time },
      });
      setEnabled(actuallyEnabled);
      setSaved(true);
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.amber} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Reminders" subtitle="One nudge a day, at a time that suits you." />

        {/* Sets expectations: this is a local, on-device nudge pointing back
            at the app, not a push carrying that day's specific text. */}
        <Card accent={color.teal}>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Ionicons
              name="notifications-outline"
              size={18}
              color={color.teal}
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" c={color.teal}>
                A nudge, not the recommendation itself
              </Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                This points you back to today's one thing on the Habits tab — it can't carry that
                day's specific text yet, since there's no server sending it.
              </Txt>
            </View>
          </View>
        </Card>

        {loading ? null : (
          <>
            <Card style={{ marginTop: space.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">Daily check-in reminder</Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                    A prompt to log how the day went, while you still remember it.
                  </Txt>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(v) => {
                    void Haptics.selectionAsync();
                    setEnabled(v);
                    setSaved(false);
                  }}
                  trackColor={{
                    false: "rgba(255,255,255,0.08)",
                    true: tint(color.amber, 0.45),
                  }}
                  thumbColor={enabled ? color.amber : "#64748B"}
                />
              </View>
            </Card>

            {enabled ? (
              <Card style={{ marginTop: space.md }}>
                <Label>Remind me at</Label>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space.sm,
                    marginTop: space.md,
                  }}
                >
                  {TIMES.map((t) => (
                    <PressCard
                      key={t}
                      haptic="light"
                      onPress={() => {
                        setTime(t);
                        setSaved(false);
                      }}
                      style={{
                        paddingVertical: space.sm,
                        paddingHorizontal: space.lg,
                        borderRadius: radius.pill,
                        backgroundColor: time === t ? tint(color.amber, 0.16) : "transparent",
                        borderColor: time === t ? tint(color.amber, 0.4) : color.border,
                        shadowOpacity: 0,
                        elevation: 0,
                      }}
                    >
                      <Txt variant="small" c={time === t ? color.amber : color.textMuted}>
                        {t}
                      </Txt>
                    </PressCard>
                  ))}
                </View>
                <Txt
                  variant="small"
                  c={color.textFaint}
                  style={{ marginTop: space.md, fontSize: 11 }}
                >
                  Your local time.
                </Txt>
              </Card>
            ) : null}

            {error ? (
              <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
                {error}
              </Txt>
            ) : null}

            <Button
              label={saved ? "Saved" : "Save preference"}
              icon={saved ? "checkmark" : undefined}
              accent={saved ? color.green : color.amber}
              variant={saved ? "secondary" : "primary"}
              loading={saving}
              onPress={() => void onSave()}
              style={{ marginTop: space.xl }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
