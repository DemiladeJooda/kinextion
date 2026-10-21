/**
 * Habit discovery transcript handling.
 *
 * Written for a bug caught in review rather than in production: the discovery
 * screen renders its opening question locally and posts the whole visible
 * transcript back, so the first request's messages array began with an
 * assistant turn. The Messages API requires the first message to come from the
 * user and roles to alternate after that, so every first message in the
 * feature would have failed with a 400 — on the happy path, not an edge case.
 *
 * The model call is mocked; what's under test is the shape of the transcript
 * handed to it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ANTHROPIC_API_KEY = "sk-ant-test";

const generateStructured = vi.fn();

vi.mock("../src/modules/ai/services/ai-service.js", () => ({
  generateStructured: (...args: unknown[]) => generateStructured(...args),
}));

const { discoverHabits } = await import("../src/modules/habits/assistant.js");

const CONTEXT = { contextBlock: "", basis: [], localHour: null, timeZone: null };

/** The last messages array actually passed to the model. */
function sentMessages(): Array<{ role: string; content: string }> {
  return generateStructured.mock.calls.at(-1)?.[0].messages;
}

beforeEach(() => {
  generateStructured.mockReset();
  generateStructured.mockResolvedValue({ reply: "And what time do you finish work?" });
});

describe("discoverHabits transcript handling", () => {
  it("strips the locally-rendered opener so the first message is the user's", async () => {
    await discoverHabits(CONTEXT, [
      { role: "assistant", content: "Tell me how a normal day goes." },
      { role: "user", content: "Up at six, gym never happens." },
    ]);

    const messages = sentMessages();
    expect(messages[0].role).toBe("user");
    expect(messages).toHaveLength(1);
  });

  it("keeps roles alternating across a longer conversation", async () => {
    await discoverHabits(CONTEXT, [
      { role: "assistant", content: "Opener." },
      { role: "user", content: "First answer." },
      { role: "assistant", content: "Follow-up question." },
      { role: "user", content: "Second answer." },
    ]);

    const roles = sentMessages().map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "user"]);
  });

  it("answers locally instead of calling the model when the user hasn't spoken", async () => {
    const result = await discoverHabits(CONTEXT, [{ role: "assistant", content: "Opener." }]);

    expect(generateStructured).not.toHaveBeenCalled();
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.drafts).toEqual([]);
    expect(result.complete).toBe(false);
  });

  it("never reports complete without drafts to show", async () => {
    generateStructured.mockResolvedValue({ reply: "All set.", complete: true, drafts: [] });

    const result = await discoverHabits(CONTEXT, [{ role: "user", content: "Anything." }]);

    // "Complete" with nothing on screen would leave the user at a dead end.
    expect(result.complete).toBe(false);
  });

  it("discards drafts that don't satisfy the habit schema", async () => {
    generateStructured.mockResolvedValue({
      reply: "Here's what I'd start with.",
      complete: true,
      drafts: [
        { name: "Walk after lunch", category: "physical", frequency: "daily", rationale: "You said lunch is fixed." },
        { name: "Broken", category: "not-a-category", frequency: "daily", rationale: "x" },
        { category: "mental", frequency: "daily", rationale: "no name" },
      ],
    });

    const result = await discoverHabits(CONTEXT, [{ role: "user", content: "Anything." }]);

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].name).toBe("Walk after lunch");
    expect(result.complete).toBe(true);
  });

  it("falls back to a question rather than an empty reply", async () => {
    generateStructured.mockResolvedValue({ reply: "   " });

    const result = await discoverHabits(CONTEXT, [{ role: "user", content: "Anything." }]);

    expect(result.reply.trim().length).toBeGreaterThan(0);
  });
});

describe("what the assistant is told", () => {
  const systemPrompt = () => generateStructured.mock.calls.at(-1)?.[0].system as string;

  it("asks about obstacles and turns them into a backup plan", async () => {
    await discoverHabits(CONTEXT, [{ role: "user", content: "I want to stretch more." }]);
    expect(systemPrompt()).toMatch(/get in the way/);
    expect(systemPrompt()).toMatch(/backupPlan/);
  });

  it("offers rather than instructs, and never names the book", async () => {
    await discoverHabits(CONTEXT, [{ role: "user", content: "I want to stretch more." }]);
    expect(systemPrompt()).toMatch(/Offer, don't instruct/);
    expect(systemPrompt()).not.toMatch(/Atomic Habits/);
  });

  it("requires an anchor and a tiny version on every draft", async () => {
    await discoverHabits(CONTEXT, [{ role: "user", content: "I want to stretch more." }]);
    const schema = generateStructured.mock.calls.at(-1)?.[0].inputSchema;
    expect(schema.properties.drafts.items.required).toEqual(
      expect.arrayContaining(["cue", "response"])
    );
  });

  it("keeps the new fields when the model returns them", async () => {
    generateStructured.mockResolvedValueOnce({
      reply: "Here's what I'd start with.",
      complete: true,
      drafts: [
        {
          name: "Stretch",
          category: "physical",
          cue: "After I get out of bed",
          response: "One minute of stretching",
          frequency: "daily",
          timeWindow: "morning",
          backupPlan: "If I oversleep, I'll stretch before my shower.",
          rationale: "You said mornings are the only quiet time.",
        },
      ],
    });
    const result = await discoverHabits(CONTEXT, [{ role: "user", content: "Mornings are quiet." }]);
    expect(result.drafts[0]).toMatchObject({ timeWindow: "morning", backupPlan: expect.any(String) });
  });
});
