/**
 * Local daily reminder for the micro-recommendation.
 *
 * This is a local, on-device notification — not server push. There's no
 * backend push pipeline (no stored Expo push tokens, no send job), so this
 * can't carry that day's actual recommendation text yet; it's a repeating
 * daily nudge that points back at the "Today's one thing" card, timed to the
 * reminder slot already saved in Profile → Notifications. A repeating
 * trigger, once scheduled, keeps firing across app restarts without the app
 * needing to re-schedule it on every launch.
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

/** Fixed id so re-scheduling replaces the previous reminder instead of stacking a second one. */
const DAILY_REMINDER_ID = "kinextion-daily-micro-rec";

// Expo Go on Android has no-op'd local notifications since SDK 53 (a
// development build is required there), and some SDKs can throw on this call
// before the module finishes loading. Guarded so a routing-level import of
// this file can never crash app startup over a feature that's opt-in anyway.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // No-op — scheduling calls below will fail soft the same way.
}

/** Physical-device check mirrors Expo's own guidance: simulators/emulators
 *  can't register for local notification delivery the same way. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** "HH:MM", 24-hour, in the user's own local time — same format the
 *  Notifications settings screen already stores. */
function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

export async function scheduleDailyReminder(time: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("daily-reminder", {
        name: "Daily reminder",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { hour, minute } = parseTime(time);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: "Today's one thing",
        body: "Your micro-recommendation is waiting on the Habits tab.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === "android" ? { channelId: "daily-reminder" } : {}),
      },
    });
  } catch {
    // Scheduling is best-effort — Expo Go on Android no-ops this (SDK 53+
    // needs a development build there), and we'd rather fail silently than
    // surface a scary error for an opt-in reminder.
  }
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}
