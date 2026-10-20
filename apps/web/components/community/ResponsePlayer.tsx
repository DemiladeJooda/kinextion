"use client";

/**
 * The player.
 *
 * Landscape is the signal on the phone; on the web the equivalent is focus —
 * the page dims, the controls are the browser's, and nothing autoplays into
 * the next thing. You finish a thought, then choose the next one.
 *
 * Audio responses get artwork rather than a black rectangle: audio is a first
 * class way to answer, not a lesser video.
 */

import { useEffect, useRef, useState } from "react";

export interface PlayerSource {
  url: string;
  kind: "video" | "audio";
  durationSec?: number | null;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ResponsePlayer({
  source,
  title,
  speaker,
  autoFocusMode = true,
}: {
  source: PlayerSource | null;
  title: string;
  speaker: string | null;
  autoFocusMode?: boolean;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!autoFocusMode) return;
    const el = ref.current;
    if (!el) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    el.addEventListener("play", on);
    el.addEventListener("pause", off);
    el.addEventListener("ended", off);
    return () => {
      el.removeEventListener("play", on);
      el.removeEventListener("pause", off);
      el.removeEventListener("ended", off);
    };
  }, [autoFocusMode]);

  if (!source) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-sm text-slate-400">
        This recording is no longer available.
      </div>
    );
  }

  return (
    <>
      {focused ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-slate-950/70 transition-opacity" />
      ) : null}
      <div className="relative z-10">
        {source.kind === "video" ? (
          <video
            ref={ref}
            src={source.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black shadow-2xl"
          />
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-[#7B2FBE] via-[#3B82F6] to-[#0ABAB5] p-6 shadow-2xl">
            <div className="flex aspect-[3/1] flex-col justify-end">
              <p className="text-xs uppercase tracking-widest text-white/70">Audio</p>
              <p className="mt-1 text-lg font-semibold text-white">{speaker ?? "A member"}</p>
              <p className="line-clamp-2 text-sm text-white/80">{title}</p>
            </div>
            <audio ref={ref} src={source.url} controls preload="metadata" className="mt-4 w-full" />
          </div>
        )}
      </div>
    </>
  );
}
