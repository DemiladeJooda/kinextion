/**
 * The healthy-use log, kept on this device only.
 *
 * Counts app opens and habit ticks so Kairo can gently check in when the
 * app itself starts to look like the compulsion (see usage.ts in
 * @kinextion/shared for the rules). Nothing here is sent to the server:
 * it's a few numbers in secure storage, pruned to two weeks.
 */

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  dismissConcern,
  emptyUsage,
  localHour,
  recordHabitLog,
  recordOpen,
  today,
  usageConcern,
  type UsageConcern,
  type UsageLog,
} from "@kinextion/shared";

const KEY = "kx_usage_v1";

let log: UsageLog = emptyUsage(today());
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) log = JSON.parse(raw) as UsageLog;
  } catch {
    // A fresh log is fine.
  }
}

function save() {
  void SecureStore.setItemAsync(KEY, JSON.stringify(log)).catch(() => {});
  emit();
}

/** Called by the store on every tick and untick. */
export function noteHabitLog(habitId: string) {
  void load().then(() => {
    log = recordHabitLog(log, today(), localHour(), habitId);
    save();
  });
}

function noteOpen() {
  void load().then(() => {
    log = recordOpen(log, today());
    save();
  });
}

/**
 * The current check-in, if any, and a way to dismiss it. Counts an open on
 * mount and every time the app returns to the foreground.
 */
export function useUsageConcern(habitName: (id: string) => string): {
  concern: UsageConcern | null;
  dismiss: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    listeners.add(onChange);
    noteOpen();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") noteOpen();
    });
    return () => {
      listeners.delete(onChange);
      sub.remove();
    };
  }, []);

  const concern = usageConcern(log, today(), habitName);
  return {
    concern,
    dismiss: () => {
      if (!concern) return;
      log = dismissConcern(log, concern.kind, today());
      save();
    },
  };
}
