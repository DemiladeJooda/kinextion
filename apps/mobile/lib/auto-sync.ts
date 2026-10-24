/**
 * Keep auto-logged habits current without anyone pressing "sync".
 *
 * When the Habits tab comes into view, each service a habit is linked to is
 * synced — at most every 15 minutes per service — and if that logged
 * anything, the list refreshes so the tick and its "Logged automatically ·
 * Strava: 32 min" line appear by themselves.
 */

import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import type { Habit } from "./store";
import type { Api } from "../hooks/useApi";
import type { IntegrationProvider } from "../services";
import { healthSource, readRecentDays } from "./health";

const EVERY_MS = 15 * 60 * 1000;
const lastSync = new Map<string, number>();

export function useAutoSync(habits: readonly Habit[], api: Api, refresh: () => Promise<void>) {
  const providers = [...new Set(habits.flatMap((h) => (h.autoLog && h.status !== "paused" ? [h.autoLog.provider] : [])))];
  const key = providers.sort().join(",");

  useFocusEffect(
    useCallback(() => {
      if (!providers.length) return;
      let cancelled = false;
      void (async () => {
        let logged = 0;
        for (const p of providers) {
          if (Date.now() - (lastSync.get(p) ?? 0) < EVERY_MS) continue;
          lastSync.set(p, Date.now());
          try {
            const phone = healthSource();
            if (p === "apple_health" || p === "health_connect") {
              if (!phone || phone.provider !== p) continue;
              const days = await readRecentDays();
              if (!days.length) continue;
              const r = await api.ingestDeviceHealth(p, days);
              logged += r.autoLogged.length;
              continue;
            }
            const r = await api.syncIntegration(p as IntegrationProvider);
            logged += r.autoLogged?.length ?? 0;
          } catch {
            // Not connected or the service is down: try again next time.
          }
        }
        if (logged && !cancelled) await refresh();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
  );
}
