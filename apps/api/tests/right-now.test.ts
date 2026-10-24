import { describe, expect, it, vi } from "vitest";

vi.mock("@kinextion/database", () => ({ prisma: {} }));
const { rightNow } = await import("../src/modules/ai/conversation.js");

describe("the guides know what day it is", () => {
  it("in the user's own time zone, to the hour", () => {
    const at = new Date("2026-10-25T03:30:00Z"); // still Saturday evening in Dallas
    expect(rightNow("America/Chicago", at)).toBe(
      "## Right now\nIt's Saturday, October 24, 2026, around 10pm where they are (2026-10-24)."
    );
  });
});
