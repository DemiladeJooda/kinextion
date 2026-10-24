import { describe, expect, it } from "vitest";
import { widgetSnapshot, type WidgetHabitInput } from "./widget.js";

const h = (over: Partial<WidgetHabitInput>): WidgetHabitInput => ({
  id: "h1",
  name: "Push-ups",
  due: true,
  todayState: null,
  tiny: "5 push-ups",
  measured: false,
  ...over,
});

describe("the widget snapshot", () => {
  it("puts what's left first and says how the day is going", () => {
    const s = widgetSnapshot(
      [h({ id: "a", name: "Water", todayState: "done" }), h({ id: "b" }), h({ id: "c", due: false })],
      "2026-10-23"
    );
    expect(s.summary).toBe("1 of 2 done");
    expect(s.items.map((i) => [i.name, i.done, i.hint])).toEqual([
      ["Push-ups", false, "Tiny: 5 push-ups"],
      ["Water", true, null],
    ]);
    expect(s.items[0].url).toBe("kinextion://quick-log?habit=b&state=done");
  });

  it("sends measured habits to their page, where the amount is asked", () => {
    expect(widgetSnapshot([h({ measured: true })], "2026-10-23").items[0].url).toBe("kinextion://habit/h1");
  });

  it("has a calm line for an empty or finished day", () => {
    expect(widgetSnapshot([], "2026-10-23").summary).toBe("Nothing due today");
    expect(widgetSnapshot([h({ todayState: "minimum" })], "2026-10-23").summary).toBe("All done today");
  });
});
