/**
 * Every AI call goes to the right model, in a shape that model accepts, with
 * the team's notes attached.
 *
 *   - Each task picks its model and effort from AI_TASKS: Opus 5.5 for the
 *     work that needs to understand the person, Sonnet 5.5 and Haiku 5.5 for
 *     narrower and mechanical jobs.
 *   - Structured answers use structured outputs, since Opus 5.5 and Sonnet
 *     5.5 reject forced tool calls; the schema is rewritten to the subset
 *     structured outputs accept.
 *   - Opus and Sonnet calls carry refusal fallbacks; Haiku has none.
 *   - The notes in apps/api/guidance/*.md reach the system prompt.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const notesDir = mkdtempSync(join(tmpdir(), "kx-guidance-"));
process.env.GUIDANCE_DIR = notesDir;

const create = vi.fn();
const stream = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = { messages: { create: (...a: unknown[]) => create(...a), stream: (...a: unknown[]) => stream(...a) } };
    messages = { create: (...a: unknown[]) => create(...a) };
  }
  return { default: Anthropic };
});

const { generateStructured, sendToAI, streamFromAI, toStructuredSchema } = await import(
  "../src/modules/ai/services/ai-service.js"
);
const { guidanceFor } = await import("../src/lib/guidance.js");

afterAll(() => rmSync(notesDir, { recursive: true, force: true }));
beforeEach(() => {
  create.mockReset();
  stream.mockReset();
  for (const f of ["_all.md", "chat.md", "kairo.md", "altheo.md", "polish.md", "recommendations.md"]) {
    writeFileSync(join(notesDir, f), "");
  }
});

const structured = (task: Parameters<typeof generateStructured>[0]["task"]) =>
  generateStructured<{ a: string }>({
    task,
    system: "Base prompt.",
    messages: [{ role: "user", content: "x" }],
    toolName: "thing",
    toolDescription: "the thing",
    inputSchema: { type: "object", properties: { a: { type: "string", maxLength: 50 } }, required: ["a"] },
  });

describe("model routing", () => {
  it("sends understanding-heavy work to Opus 5.5 with fallbacks", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"a":"x"}' }] });
    for (const task of ["recommendation", "coach", "habitSuggest", "habitDiscover"] as const) {
      await structured(task);
      const p = create.mock.calls.at(-1)![0];
      expect(p.model, task).toBe("claude-opus-5-5");
      expect(p.output_config.effort, task).toBe("medium");
      expect(p.fallbacks, task).toBe("default");
      expect(p.betas, task).toContain("server-side-fallback-2026-07-01");
    }
  });

  it("sends narrower jobs to Sonnet 5.5 and mechanical ones to Haiku 5.5", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"a":"x"}' }] });
    await structured("checkinPrompt");
    expect(create.mock.calls.at(-1)![0]).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default" });
    await structured("polish");
    expect(create.mock.calls.at(-1)![0].model).toBe("claude-sonnet-5-5");
    await structured("memorySummary");
    const haiku = create.mock.calls.at(-1)![0];
    expect(haiku.model).toBe("claude-haiku-5-5");
    expect(haiku.fallbacks).toBeUndefined();
    expect(haiku.output_config.effort).toBe("low");
  });

  it("runs the guides on Opus 5.5", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Hey." }] });
    expect(await sendToAI("kairo", "You are Kairo.", [{ role: "user", content: "hi" }])).toBe("Hey.");
    expect(create.mock.calls[0][0].model).toBe("claude-opus-5-5");
  });
});

describe("structured output", () => {
  it("uses structured outputs, never a forced tool call", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"a":"hello"}' }] });
    expect(await structured("coach")).toEqual({ a: "hello" });
    const p = create.mock.calls[0][0];
    expect(p.tool_choice).toBeUndefined();
    expect(p.tools).toBeUndefined();
    expect(p.thinking).toBeUndefined();
    expect(p.output_config.format.type).toBe("json_schema");
  });

  it("throws on a refusal or a cut-off reply, so callers fall back", async () => {
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    await expect(structured("coach")).rejects.toThrow(/declined/);
    create.mockResolvedValueOnce({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"a":' }] });
    await expect(structured("coach")).rejects.toThrow(/cut off/);
  });
});

describe("toStructuredSchema", () => {
  it("closes every object and moves unsupported limits into descriptions", () => {
    const out = toStructuredSchema({
      type: "object",
      properties: {
        name: { type: "string", maxLength: 100, description: "The habit" },
        days: { type: "array", maxItems: 7, items: { type: "integer", minimum: 0, maximum: 6 } },
        drafts: {
          type: "array",
          minItems: 1,
          items: { type: "object", properties: { n: { type: "string" } } },
        },
      },
    }) as Record<string, any>;

    expect(out.additionalProperties).toBe(false);
    expect(out.properties.name).toEqual({ type: "string", description: "The habit (at most 100 characters)" });
    expect(out.properties.days.maxItems).toBeUndefined();
    expect(out.properties.days.description).toBe("(at most 7 items)");
    expect(out.properties.days.items).toEqual({ type: "integer", description: "(from 0 to 6)" });
    expect(out.properties.drafts.items.additionalProperties).toBe(false);
  });
});

describe("the team's notes", () => {
  it("reach the system prompt for the task they're for, and only that task", async () => {
    writeFileSync(join(notesDir, "_all.md"), "- Sound human.");
    writeFileSync(join(notesDir, "recommendations.md"), "<!-- from testing, 23 Oct -->\n- Keep it under 12 words.");
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"a":"x"}' }] });

    await structured("recommendation");
    const rec = create.mock.calls.at(-1)![0].system as string;
    expect(rec).toContain("## Notes from the Kinextion team");
    expect(rec).toContain("- Sound human.");
    expect(rec).toContain("- Keep it under 12 words.");
    expect(rec).not.toContain("from testing"); // comments never reach the model

    await structured("polish");
    expect(create.mock.calls.at(-1)![0].system).not.toContain("12 words");
  });

  it("give each guide its own notes on top of the shared chat notes", () => {
    writeFileSync(join(notesDir, "chat.md"), "- Ask one question at a time.");
    writeFileSync(join(notesDir, "kairo.md"), "- Kairo is less formal.");
    writeFileSync(join(notesDir, "altheo.md"), "- Altheo talks training.");
    const kairo = guidanceFor("chat", "kairo");
    expect(kairo).toContain("one question at a time");
    expect(kairo).toContain("less formal");
    expect(kairo).not.toContain("talks training");
  });

  it("pick up an edit on the next call, and say nothing when every file is empty", async () => {
    expect(guidanceFor("polish")).toBe("");
    writeFileSync(join(notesDir, "polish.md"), "- Keep their slang.");
    // mtime resolution can be coarse; force a different timestamp
    const { utimesSync } = await import("node:fs");
    const later = new Date(Date.now() + 5000);
    utimesSync(join(notesDir, "polish.md"), later, later);
    expect(guidanceFor("polish")).toContain("Keep their slang.");
  });

  it("are added to streamed chat too", async () => {
    writeFileSync(join(notesDir, "kairo.md"), "- Never use the word journey.");
    const later = new Date(Date.now() + 10_000);
    (await import("node:fs")).utimesSync(join(notesDir, "kairo.md"), later, later);
    stream.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } };
      },
      finalMessage: async () => ({ stop_reason: "end_turn" }),
    });
    expect(await streamFromAI("kairo", "You are Kairo.", [{ role: "user", content: "hi" }], () => {})).toBe("Hi");
    const p = stream.mock.calls[0][0];
    expect(p.system).toContain("Never use the word journey.");
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.cache_control).toEqual({ type: "ephemeral" });
  });
});
