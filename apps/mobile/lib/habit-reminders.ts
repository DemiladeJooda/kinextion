/**
 * Habit reminders on the device.
 *
 * Local notifications, re-planned from scratch whenever habits or logs change:
 * every reminder this file owns is cancelled and replaced with the list from
 * `plannedReminders` in @kinextion/shared. That's what keeps a reminder from
 * firing for a habit you ticked an hour ago.
 *
 * Each habit reminder carries Done and Tiny-version buttons, so a habit can
 * be logged from the lock screen. The buttons are handled by
 * HabitReminderSync (components), which has the app state to log with.
 *
 * Everything here fails soft. Expo Go on Android can't deliver local
 * notifications (a development build is needed), and an opt-in reminder must
 * never be the reason the app crashes.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { PlannedReminder } from "@kinextion/shared";

export const HABIT_CATEGORY = "habit-reminder";
export const ACTION_DONE = "habit-done";
export const ACTION_TINY = "habit-tiny";
const CHANNEL = "habits";

/** Identifiers this file owns. Anything else (the daily check-in nudge) is
 *  left alone. */
const OWNED = /^(habit|lastcall)-/;

let categoryReady: Promise<void> | null = null;

/** Register the Done / Tiny-version buttons and the Android channel once. */
export function ensureHabitCategory(): Promise<void> {
  categoryReady ??= (async () => {
    try {
      await Notifications.setNotificationCategoryAsync(HABIT_CATEGORY, [
        {
          identifier: ACTION_DONE,
          buttonTitle: "Done",
          options: { opensAppToForeground: false },
        },
        {
          identifier: ACTION_TINY,
          buttonTitle: "Did the tiny version",
          options: { opensAppToForeground: false },
        },
      ]);
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: "Habit reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    } catch {
      // Best effort — see the file comment.
    }
  })();
  return categoryReady;
}

/** True only if the user has already allowed notifications. Never prompts. */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Whether the OS would show a permission prompt if asked now. */
export async function canAskForNotifications(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return !p.granted && p.canAskAgain;
  } catch {
    return false;
  }
}

function fireDate(r: PlannedReminder): Date {
  const [y, m, d] = r.day.split("-").map(Number);
  return new Date(y, m - 1, d, r.hour, r.minute, 0, 0);
}

/** Cancel every habit reminder, then schedule `planned` (or nothing). */
export async function syncHabitReminders(
  planned: PlannedReminder[],
): Promise<void> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => OWNED.test(n.identifier))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(
            () => {},
          ),
        ),
    );

    if (planned.length === 0) return;
    await ensureHabitCategory();

    const now = Date.now();
    for (const r of planned) {
      const date = fireDate(r);
      if (date.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title,
          body: r.body,
          data: { kind: r.kind, habitId: r.habitId ?? null, day: r.day },
          ...(r.kind === "habit" ? { categoryIdentifier: HABIT_CATEGORY } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
        },
      });
    }
  } catch {
    // Best effort — see the file comment.
  }
}
