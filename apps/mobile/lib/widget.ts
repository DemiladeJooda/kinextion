/**
 * Hands today's habits to the home-screen widget.
 *
 * The widget is a native target (WidgetKit on iOS, an App Widget on
 * Android) that reads a snapshot from storage shared with the app. That
 * target and its small native bridge module ("KinextionWidget") are added at
 * build time — see docs/widgets.md. Until a build has them, publishing is a
 * no-op, so the app behaves the same with or without a widget.
 */

import { useEffect } from "react";
import { requireOptionalNativeModule } from "expo";
import { today, widgetSnapshot, type WidgetSnapshot } from "@kinextion/shared";
import { useAppState } from "./store";

interface WidgetBridge {
  /** Write the snapshot to the shared App Group / SharedPreferences and reload the widget. */
  setSnapshot(json: string): void;
}

const bridge = requireOptionalNativeModule<WidgetBridge>("KinextionWidget");

export const widgetSupported = bridge !== null;

let last = "";

export function publishWidgetSnapshot(snapshot: WidgetSnapshot) {
  if (!bridge) return;
  const json = JSON.stringify(snapshot);
  if (json === last) return;
  last = json;
  try {
    bridge.setSnapshot(json);
  } catch {
    // A widget that can't update shows its last snapshot; never worth a crash.
  }
}

/** Mounted once: republishes whenever today's habits change. */
export function WidgetSync() {
  const { habits } = useAppState();
  useEffect(() => {
    publishWidgetSnapshot(
      widgetSnapshot(
        habits
          .filter((h) => h.status !== "paused")
          .map((h) => ({
            id: h.id,
            name: h.name,
            due: h.due,
            todayState: h.todayState,
            tiny: h.display.response ?? null,
            measured: Boolean(h.measure),
          })),
        today()
      )
    );
  }, [habits]);
  return null;
}
