/**
 * Live check that the guides act in the app when asked, against the real
 * model. Tools are recorded, not run, so nothing touches the database.
 * Costs a few cents:
 *
 *   pnpm --filter @kinextion/api chat:smoke
 *
 * Exits non-zero if a guide that should have acted didn't, or acted when it
 * shouldn't have.
 */

import { CHAT_ACTIONS_PROMPT, CHAT_TOOLS } from "../src/modules/ai/chat-tools.js";
import { streamChatWithTools } from "../src/modules/ai/services/ai-service.js";

const SYSTEM = `You are Altheo, a warm fitness coach in the Kinextion app.

## Their Habits
- Push-ups (Body, every day); plan: After I pour my coffee, I'll do 5 push-ups on your knees; not done yet today; 3-day streak; id h_push

${CHAT_ACTIONS_PROMPT}`;

const CASES = [
  {
    name: "creates a habit when asked",
    say: "Can you set me up a habit to drink a glass of water every morning? Just add it for me.",
    expect: "create_habit",
  },
  {
    name: "logs a habit they say they did",
    say: "Just did my push-ups, the full 10!",
    expect: "log_habit",
  },
  {
    name: "just talks when nothing should change",
    say: "Why do people say habits take 21 days?",
    expect: null,
  },
] as const;

let failed = 0;
for (const c of CASES) {
  const calls: Array<{ name: string; input: unknown }> = [];
  const started = Date.now();
  try {
    const text = await streamChatWithTools({
      persona: "altheo",
      systemPrompt: SYSTEM,
      messages: [{ role: "user", content: c.say }],
      tools: CHAT_TOOLS,
      onText: () => {},
      runTool: async (name, input) => {
        calls.push({ name, input });
        return { result: "Done.", action: { kind: "test", title: name } };
      },
    });
    const used = calls.map((x) => x.name);
    const ok = c.expect ? used.includes(c.expect) : used.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  (${Date.now() - started}ms)`);
    for (const call of calls) console.log(`      ${call.name} ${JSON.stringify(call.input)}`);
    console.log(`      reply: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${c.name}: ${err instanceof Error ? err.message : err}`);
  }
}
process.exit(failed ? 1 : 0);
