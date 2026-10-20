/**
 * Turning a calendar into rhythm, and nothing else.
 *
 * A calendar is the most revealing thing a user can connect: who they meet,
 * where they go, what they're treated for. Kinextion needs none of that. What
 * a habit needs is *shape* — when the day starts, how booked it is, where the
 * reliable gap sits — so this module reduces events to five numbers per day
 * and never returns anything else.
 *
 * Titles, attendees, locations, descriptions and organiser names are dropped
 * here, at the boundary, before storage. There is deliberately no option to
 * keep them: the adapters call this function and can only return what it
 * produces, so no later change to a route or a prompt can quietly widen what
 * was collected.
 */

import type { WearableMetricInput } from "./types.js";

export interface CalendarEvent {
  /** ISO start. The wall-clock portion is read as-is — see localMinutes. */
  start: string;
  end: string;
  /** All-day events say nothing about the shape of a day, and are skipped. */
  allDay?: boolean;
}

/** The window a habit could realistically live in. Outside it, "free" is sleep. */
const WAKING_START = 6 * 60; // 06:00
const WAKING_END = 23 * 60; // 23:00

/** Ignore slivers — a 10-minute gap between meetings isn't a habit slot. */
const MIN_USEFUL_FREE_BLOCK = 20;

/**
 * Minutes from midnight, in the user's own wall clock.
 *
 * Read straight off the ISO string rather than via `new Date()`, which would
 * convert to the server's zone — and the server is UTC in a datacentre. The
 * characters after the "T" are already the local time the user sees on their
 * own calendar, which is exactly what a cue like "after your 9am" needs.
 */
function localMinutes(iso: string): number | null {
  const t = iso.indexOf("T");
  if (t === -1) return null;
  const hh = Number(iso.slice(t + 1, t + 3));
  const mm = Number(iso.slice(t + 4, t + 6));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/** Local calendar date (YYYY-MM-DD), likewise read from the string. */
function localDate(iso: string): string | null {
  const t = iso.indexOf("T");
  return t === -1 ? null : iso.slice(0, t);
}

/** Merge overlapping intervals so double-booked hours are counted once. */
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]];

  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** The longest unbooked stretch inside waking hours, and when it starts. */
function longestFreeBlock(busy: Array<[number, number]>): { length: number; start: number } {
  let best = { length: 0, start: WAKING_START };
  let cursor = WAKING_START;

  for (const [start, end] of busy) {
    if (end <= WAKING_START || start >= WAKING_END) continue;
    const gap = Math.min(start, WAKING_END) - cursor;
    if (gap > best.length) best = { length: gap, start: cursor };
    cursor = Math.max(cursor, Math.min(end, WAKING_END));
  }

  const tail = WAKING_END - cursor;
  if (tail > best.length) best = { length: tail, start: cursor };

  return best;
}

/**
 * Reduce events to per-day metrics.
 *
 * Emits nothing for a day with no timed events — an empty calendar is absence
 * of data, not a day with zero commitments, and recording it as 0 would drag
 * every average this feeds.
 */
export function deriveRhythm(events: CalendarEvent[], provider: string): WearableMetricInput[] {
  const byDate = new Map<string, Array<[number, number]>>();

  for (const event of events) {
    if (event.allDay) continue;
    const date = localDate(event.start);
    const start = localMinutes(event.start);
    const end = localMinutes(event.end);
    if (!date || start === null || end === null) continue;

    // Events crossing midnight are clipped to the end of their start day;
    // the tail matters far less than not corrupting the next day's shape.
    const clippedEnd = end > start ? end : 24 * 60;

    const list = byDate.get(date) ?? [];
    list.push([start, clippedEnd]);
    byDate.set(date, list);
  }

  const metrics: WearableMetricInput[] = [];

  for (const [date, intervals] of byDate) {
    const busy = mergeIntervals(intervals);
    if (busy.length === 0) continue;

    const busyMinutes = busy.reduce((sum, [s, e]) => sum + (e - s), 0);
    const free = longestFreeBlock(busy);

    metrics.push(
      { metricType: "calendar_busy_minutes", date, value: busyMinutes, unit: "min" },
      { metricType: "calendar_first_busy_minute", date, value: busy[0][0], unit: "min" },
      {
        metricType: "calendar_last_busy_minute",
        date,
        value: busy[busy.length - 1][1],
        unit: "min",
      }
    );

    if (free.length >= MIN_USEFUL_FREE_BLOCK) {
      metrics.push(
        { metricType: "calendar_longest_free_minutes", date, value: free.length, unit: "min" },
        { metricType: "calendar_free_block_start_minute", date, value: free.start, unit: "min" }
      );
    }
  }

  // `provider` is accepted so adapters read symmetrically with the wearable
  // ones; the caller stamps it onto the stored row.
  void provider;
  return metrics;
}

/** Window to pull: recent past for the typical shape, a week ahead for today. */
export function rhythmWindow(since: Date): { from: Date; to: Date } {
  const earliest = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const from = since < earliest ? earliest : since;
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}
