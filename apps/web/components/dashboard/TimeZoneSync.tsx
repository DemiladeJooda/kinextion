"use client";

/**
 * Tells the server which time zone this browser is in.
 *
 * The dashboard renders on the server, which has no idea where the reader is.
 * This writes the browser's IANA zone to a cookie the data layer forwards to
 * the API as X-Time-Zone, then re-renders once if it changed — so "today" on
 * the web matches "today" on the phone instead of rolling over at UTC
 * midnight.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const TZ_COOKIE = "kx_tz";

export function TimeZoneSync({ current }: { current: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || tz === current) return;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [current, router]);

  return null;
}
