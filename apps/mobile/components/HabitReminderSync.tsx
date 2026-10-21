/**
 * Keeps habit reminders in step with the app, and handles their buttons.
 *
 * Renders nothing. Mounted once inside AppStateProvider so it sees every log
 * the moment it happens:
 *
 *   - When habits or logs change, or the app comes back to the foreground
 *     (which also covers a new day starting), the reminders are re-planned
 *     from scratch — so ticking a habit cancels its reminder.
 *   - Tapping Done or "Did the tiny version" on a reminder logs the habit
 *     for the day the reminder was for, marked as coming from a notification.
 *     Tapping the reminder itself opens Today.
 *
 * Reminders only run once the user has allowed notifications; this never
 * prompts. The "Get a nudge at the right moment" card on Today does.
 */

import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { localHour, plannedReminders, today } from "@kinextion/shared";

import { useApi } from "../hooks/useApi";
import { useAuth } from "../lib/auth";
import {
  ACTION_DONE,
  ACTION_TINY,
  notificationsAllowed,
  syncHabitReminders,
} from "../lib/habit-reminders";
import { useAppState } from "../lib/store";

/** Let a burst of ticks settle before re-planning. */
const SYNC_DELAY_MS = 1200;

export function HabitReminderSync() {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const router = useRouter();
  const { reminderHabits, setHabitDay } = useAppState();

  // Latest values for listeners that are registered once.
  const setHabitDayRef = useRef(setHabitDay);
  setHabitDayRef.current = setHabitDay;
  const enabledRef = useRef<boolean | null>(null);
  // Bumped after the preference is (re)read, to force a re-plan.
  const [tick, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  // The user's switch in Settings → Notifications. Read on sign-in and on
  // every return to the foreground, so a change there applies right away.
  useEffect(() => {
    if (!isSignedIn) return;
    const read = () =>
      api
        .getMyProfile()
        .then((me) => {
          enabledRef.current =
            me.profile?.preferences?.habitReminders !== false;
          bump();
        })
        .catch(() => {});
    void read();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void read();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Re-plan whenever anything that changes the plan changes.
  useEffect(() => {
    if (!isSignedIn || enabledRef.current === null) return;
    const timer = setTimeout(async () => {
      const allowed = enabledRef.current && (await notificationsAllowed());
      if (!allowed) {
        await syncHabitReminders([]);
        return;
      }
      const hour = localHour();
      const minute = new Date().getMinutes();
      await syncHabitReminders(
        plannedReminders(reminderHabits, today(), hour * 60 + minute),
      );
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isSignedIn, reminderHabits, tick]);

  // The buttons on a reminder, and a tap on the reminder itself.
  useEffect(() => {
    if (!isSignedIn) return;

    const handle = async (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) return;
      const data = response.notification.request.content.data as {
        kind?: string;
        habitId?: string | null;
        day?: string;
      };
      const action = response.actionIdentifier;
      // Clear first: getLastNotificationResponseAsync would otherwise hand
      // the same tap back on the next launch and log it twice.
      await Notifications.clearLastNotificationResponseAsync().catch(() => {});

      if (data?.kind === "habit" && data.habitId && data.day) {
        if (action === ACTION_DONE || action === ACTION_TINY) {
          await setHabitDayRef.current(
            data.habitId,
            action === ACTION_DONE ? "done" : "minimum",
            {
              date: data.day,
              source: "notification",
            },
          );
          return;
        }
      }
      if (data?.kind === "habit" || data?.kind === "last-call") {
        router.push("/(tabs)/habits" as never);
      }
    };

    // A button pressed while the app wasn't running is delivered on launch.
    void Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(
      (r) => void handle(r),
    );
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return null;
}
