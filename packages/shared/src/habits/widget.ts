/**
 * What the home-screen widget shows: today's habits, small enough to read
 * at a glance and tick without opening the app.
 *
 * The app writes this snapshot whenever its habits change; the native
 * widget (WidgetKit on iOS, an App Widget on Android) only reads it and
 * opens a quick-log link when tapped. Keeping the widget dumb means the
 * rules for what counts stay in one place, here and on the server.
 */

export const WIDGET_MAX_ITEMS = 4;

export interface WidgetHabitInput {
  id: string;
  name: string;
  due: boolean;
  todayState: "done" | "minimum" | "rest" | null;
  /** Tidied tiny version, if it has one. */
  tiny: string | null;
  measured: boolean;
}

export interface WidgetSnapshot {
  /** The day this was made for; the widget shows "Open Kinextion" once it's stale. */
  date: string;
  /** "2 of 4 done". */
  summary: string;
  items: {
    id: string;
    name: string;
    done: boolean;
    /** "Tiny: 5 push-ups" under the name while it's still to do. */
    hint: string | null;
    /** Opens the app and logs it. Measured habits open the amount sheet instead. */
    url: string;
  }[];
}

export function widgetSnapshot(habits: readonly WidgetHabitInput[], date: string): WidgetSnapshot {
  const due = habits.filter((h) => h.due || h.todayState === "done" || h.todayState === "minimum");
  const done = (h: WidgetHabitInput) => h.todayState === "done" || h.todayState === "minimum";
  // Still to do first, so the widget's few rows are the useful ones.
  const ordered = [...due.filter((h) => !done(h)), ...due.filter(done)];
  const kept = due.filter(done).length;
  return {
    date,
    summary: due.length === 0 ? "Nothing due today" : kept === due.length ? "All done today" : `${kept} of ${due.length} done`,
    items: ordered.slice(0, WIDGET_MAX_ITEMS).map((h) => ({
      id: h.id,
      name: h.name,
      done: done(h),
      hint: !done(h) && h.tiny ? `Tiny: ${h.tiny}` : null,
      url: h.measured ? `kinextion://habit/${h.id}` : `kinextion://quick-log?habit=${encodeURIComponent(h.id)}&state=done`,
    })),
  };
}
