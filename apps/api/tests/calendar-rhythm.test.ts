/**
 * Calendar reduction tests.
 *
 * Two things are being protected here. The first is correctness — a habit cue
 * placed in a gap that isn't really free is worse than no cue. The second, and
 * the reason these assertions are strict rather than illustrative, is that this
 * function is the only boundary between a user's calendar and Kinextion's
 * database: if it ever returns something other than five numbers a day, event
 * titles start being stored. The "keeps nothing but numbers" test fails loudly
 * if that boundary is ever widened.
 */

import { describe, expect, it } from "vitest";
import { deriveRhythm, rhythmWindow } from "../src/modules/integrations/providers/calendar-rhythm.js";

/** A day with a 09:00–10:00 meeting and a 15:00–15:30 one. */
const TWO_MEETINGS = [
  { start: "2026-09-08T09:00:00-05:00", end: "2026-09-08T10:00:00-05:00" },
  { start: "2026-09-08T15:00:00-05:00", end: "2026-09-08T15:30:00-05:00" },
];

function byType(metrics: ReturnType<typeof deriveRhythm>) {
  return Object.fromEntries(metrics.map((m) => [m.metricType, m.value]));
}

describe("deriveRhythm", () => {
  it("reads wall-clock time from the offset, not the server's zone", () => {
    // The server running this test is not in -05:00, and the answer must not
    // depend on where it runs: 09:00 local is minute 540 regardless.
    const m = byType(deriveRhythm(TWO_MEETINGS, "google_calendar"));
    expect(m.calendar_first_busy_minute).toBe(9 * 60);
    expect(m.calendar_last_busy_minute).toBe(15 * 60 + 30);
  });

  it("counts booked time once when meetings overlap", () => {
    const overlapping = [
      { start: "2026-09-08T09:00:00Z", end: "2026-09-08T10:00:00Z" },
      { start: "2026-09-08T09:30:00Z", end: "2026-09-08T11:00:00Z" },
    ];
    const m = byType(deriveRhythm(overlapping, "google_calendar"));
    // 09:00–11:00 is two hours, not the two-and-a-half the naive sum gives.
    expect(m.calendar_busy_minutes).toBe(120);
  });

  it("finds the longest free block and when it starts", () => {
    const m = byType(deriveRhythm(TWO_MEETINGS, "google_calendar"));
    // Gaps inside 06:00–23:00: 06:00–09:00 (180), 10:00–15:00 (300),
    // 15:30–23:00 (450). The last is longest.
    expect(m.calendar_longest_free_minutes).toBe(450);
    expect(m.calendar_free_block_start_minute).toBe(15 * 60 + 30);
  });

  it("ignores all-day events, which say nothing about the shape of a day", () => {
    const metrics = deriveRhythm(
      [{ start: "2026-09-08T00:00:00Z", end: "2026-09-09T00:00:00Z", allDay: true }],
      "google_calendar"
    );
    expect(metrics).toHaveLength(0);
  });

  it("emits nothing for a day with no timed events", () => {
    // An empty calendar is absence of data, not a day with zero commitments;
    // recording it as 0 would drag every average that reads this.
    expect(deriveRhythm([], "google_calendar")).toEqual([]);
  });

  it("drops free blocks too short to hold a habit", () => {
    const packed = [
      { start: "2026-09-08T06:00:00Z", end: "2026-09-08T12:00:00Z" },
      { start: "2026-09-08T12:10:00Z", end: "2026-09-08T23:00:00Z" },
    ];
    const m = byType(deriveRhythm(packed, "google_calendar"));
    expect(m.calendar_longest_free_minutes).toBeUndefined();
    expect(m.calendar_busy_minutes).toBeGreaterThan(0);
  });

  it("keeps nothing but numbers — no titles, attendees or free text survive", () => {
    const withPrivateDetail = [
      {
        start: "2026-09-08T09:00:00Z",
        end: "2026-09-08T10:00:00Z",
        // Deliberately passed as excess properties: even if an adapter is
        // changed to forward them, they must not reach the returned metrics.
        summary: "Oncology follow-up",
        attendees: ["dr.smith@hospital.example"],
        location: "Ward 4",
      } as never,
    ];

    const metrics = deriveRhythm(withPrivateDetail, "google_calendar");
    expect(metrics.length).toBeGreaterThan(0);

    const serialised = JSON.stringify(metrics);
    expect(serialised).not.toContain("Oncology");
    expect(serialised).not.toContain("hospital.example");
    expect(serialised).not.toContain("Ward 4");

    for (const metric of metrics) {
      expect(typeof metric.value).toBe("number");
      expect(metric.metricType.startsWith("calendar_")).toBe(true);
      // `raw` is where provider payloads are kept for the wearable adapters.
      // Calendars must never populate it.
      expect(metric.raw).toBeUndefined();
    }
  });

  it("separates days rather than merging them", () => {
    const twoDays = [
      { start: "2026-09-08T09:00:00Z", end: "2026-09-08T10:00:00Z" },
      { start: "2026-09-09T14:00:00Z", end: "2026-09-09T15:00:00Z" },
    ];
    const dates = new Set(deriveRhythm(twoDays, "google_calendar").map((m) => m.date));
    expect([...dates].sort()).toEqual(["2026-09-08", "2026-09-09"]);
  });
});

describe("rhythmWindow", () => {
  it("never asks a provider for more than 30 days of history", () => {
    const { from } = rhythmWindow(new Date("2020-01-01"));
    const daysBack = (Date.now() - from.getTime()) / 86_400_000;
    expect(daysBack).toBeLessThanOrEqual(31);
  });

  it("looks a week ahead so today's free block is known before it happens", () => {
    const { to } = rhythmWindow(new Date());
    expect(to.getTime()).toBeGreaterThan(Date.now());
  });
});
