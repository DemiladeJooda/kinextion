/**
 * Live check that every AI task works against the real API, with the real
 * models and schemas. Costs a few cents per run — run it after changing
 * AI_TASKS, a schema, or the SDK:
 *
 *   pnpm --filter @kinextion/api ai:smoke
 *
 * Exits non-zero if any task fails.
 */

import { TOPIC_OPTIONS_SCHEMA } from "@kinextion/ai-core";
import { aiTask, type AITask } from "@kinextion/shared";
import { generateStructured, streamFromAI } from "../src/modules/ai/services/ai-service.js";
import { discoverHabits, suggestHabits } from "../src/modules/habits/assistant.js";
import { polishHabitText } from "../src/modules/habits/polish.js";
import { reflectOnMiss } from "../src/modules/habits/coach.js";
import { generateRecommendation } from "../src/modules/recommendations/generator.js";
import { generateCheckInPrompt } from "../src/modules/checkin/prompt.js";
import { extractFacts, summarizeConversation } from "../src/lib/memory/extract.js";

const context = {
  contextBlock:
    "## Profile\n- Goal: Get stronger\n## Current habits\n- Push-ups (physical, every day) — cue: \"After I pour my coffee\": done 4 of 7 due (57%)",
  basis: ["1 current habit"],
  localHour: 9,
  timeZone: "America/Chicago",
};

const habit = {
  name: "Push-ups",
  category: "physical",
  cue: "After I pour my coffee",
  response: "10 push-ups",
  craving: "To feel strong",
  backupPlan: null,
  frequency: "daily",
  targetDays: null,
  perWeekTarget: null,
  timeWindow: "morning",
  polished: null,
};

const checks: Array<[AITask, () => Promise<unknown>]> = [
  [
    "chat",
    async () => {
      let streamed = "";
      const text = await streamFromAI(
        "kairo",
        "You are Kairo, a warm listener. Reply in one short sentence.",
        [{ role: "user", content: "Rough day, but I did my push-ups." }],
        (c) => (streamed += c)
      );
      if (!streamed) throw new Error("nothing streamed");
      return text;
    },
  ],
  ["habitSuggest", async () => (await suggestHabits(context, { count: 2 })).map((d) => d.name)],
  [
    "habitDiscover",
    async () =>
      (await discoverHabits(context, [{ role: "user", content: "I want to move more but mornings are chaos." }])).reply,
  ],
  ["coach", async () => reflectOnMiss(habit, "2026-10-22", "mornings are too rushed for ten")],
  [
    "recommendation",
    async () =>
      generateRecommendation(context, {
        profile: { answered: 0, acted: 0, overallRate: null, categories: [], timesOfDay: [], provisional: true } as never,
        lines: [],
        landed: [],
        ignored: [],
      }),
  ],
  ["checkinPrompt", async () => generateCheckInPrompt(context)],
  [
    "community",
    async () =>
      generateStructured({
        task: "community",
        system: "Propose two short weekly discussion topics for a fitness community.",
        messages: [{ role: "user", content: "Members talked about morning routines and recovery this week." }],
        toolName: "propose_topics",
        toolDescription: "Topic options.",
        inputSchema: TOPIC_OPTIONS_SCHEMA as Record<string, unknown>,
      }),
  ],
  ["polish", async () => polishHabitText("Push-ups", { cue: "after i get my coffe or whatever", craving: "im lazy and i hate it" })],
  ["memoryExtract", async () => extractFacts("User: I hurt my left knee last month so I avoid running.\nAssistant: Got it.")],
  ["memorySummary", async () => summarizeConversation(null, "User: I'm training for a 5k.\nAssistant: Nice — when is it?")],
];

let failed = 0;
for (const [task, run] of checks) {
  const { model, effort } = aiTask(task);
  const started = Date.now();
  try {
    const out = await run();
    console.log(`PASS ${task.padEnd(15)} ${model} (${effort}) ${Date.now() - started}ms\n     ${JSON.stringify(out).slice(0, 220)}`);
  } catch (err) {
    failed++;
    const e = err as { status?: number; error?: { error?: { message?: string } }; message?: string };
    console.log(`FAIL ${task.padEnd(15)} ${model} ${e.status ?? ""} ${e.error?.error?.message ?? e.message}`);
  }
}
process.exit(failed ? 1 : 0);
