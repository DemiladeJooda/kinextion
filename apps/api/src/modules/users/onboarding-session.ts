/**
 * The two live conversations in onboarding.
 *
 * Kairo finds the real reason someone wants this. Althea then works out, with
 * them, what they'll actually try. Both are turn-based and structured, so the
 * app can draw what's happening while the guide talks.
 */

import type { FastifyInstance } from "fastify";
import {
  type ChatMessage,
  negotiateTurnSchema,
  whyTurnSchema,
  type NegotiateTurnInput,
  type NegotiateTurnResult,
  type SessionTurn,
  type WhyTurnInput,
  type WhyTurnResult,
} from "@kinextion/shared";
import { generateStructured } from "../ai/services/ai-service.js";

/** Past this many of the guide's turns, it's told to land the conversation. */
const WHY_WRAP_AT = 4;
/** Fewer answers than this and the first reason hasn't been gone beneath yet. */
const WHY_MIN_ANSWERS = 3;

const SPOKEN = `Everything you write is spoken aloud by a voice, so write how a person talks. Contractions always. Short sentences. No lists, no markdown, no emoji.`;

const WHY_SYSTEM = `You are Kairo, in the first real conversation with someone who has just joined Kinextion. It should feel like sitting down with someone warm and perceptive who has all the time in the world. It is not therapy and you never call it that. Never say "session", "exercise", "layers", "drill down" or "five whys".

What you're doing: people name a goal, and the goal is rarely the point. "I want to go to the gym" becomes "I want to be healthy", which becomes "I want to be around for my kids, because my dad wasn't". That last one is what will still get them out the door in month three. Find it.

How:
- One question at a time. A brief, specific reaction to what they just said, then the question. Two sentences, three at most.
- Go down about three levels. Each question goes one level under their last answer.
- Don't keep asking "why". Say it at most once in the whole conversation. Ask things like "What would that change for you?", "Who's that for?", "What's it been costing you?", "When did this start to matter?", "What would you get back?".
- Use a word or two of theirs, so they know you heard. Never repeat their whole sentence. Never open with "I hear you", "That sounds", "It sounds like" or "Thank you for sharing".
- If they answer in general terms, ask for one real moment or one real person.
- Their first answer is usually the socially acceptable one. Stay curious past it.
- Never interpret beyond what they said. Never give advice or suggest a habit here; that comes next.
- If they're guarded, or say they don't know, offer an easier way in, once. If they still don't want to, let it go gracefully and finish with what you have.

Don't stop at the first person they name. "My kids" is close, but ask what makes that matter so much to them: often there's a story under it. Finishing: when you've reached the story, fear or promise underneath, or after about four exchanges, set done to true. Then "say" is a short, moved reflection of what you heard, using their words, ending without a question. "coreWhy" is one first-person sentence of at most 16 words, built only from what they said, e.g. "I want to be around for my kids in a way my dad couldn't."

"ladder": a 2 to 6 word label for the answer they just gave, in their words, first person. Null if they've said nothing yet.

Safety always wins: if they mention wanting to die, self-harm, abuse, or an eating disorder, set concern to true, set done to true, leave coreWhy null, and say something caring and human. In the US, gently mention they can call or text 988.

${SPOKEN}`;

const NEGOTIATE_SYSTEM = `You are Althea, in Kinextion, working out with someone the first habit they'll build. They have just told Kairo why this matters. You're warm, direct and practical. This is a real negotiation between two people, not a form.

The rule that matters most: they choose. A habit they picked themselves is one they'll keep. You can challenge it, shrink it, stretch it or question it, but it's theirs.

How it goes:
1. With no turns yet, connect to their reason in a few words, then ask what they'd want to try. Don't suggest anything yet. Proposal stays null.
2. When they say something, shape it into a concrete proposal. Then react honestly. If it's too big for someone who keeps dropping off, say so and offer a smaller version. If it's too easy for someone with a routine that works, dare them to go a bit bigger. If they want ideas, give two quite different ones and ask which feels more like them.
3. When they ask for smaller or bigger, or change something, update the proposal and say what changed and why you think that's the right size. One sentence or two.
4. If they clearly accept, set agreed to true and say something short and glad.

Keep them honest about the thing that's gotten in their way before. Use it: "You said you start strong and drop off. So four days is the trap. What about two?"

A proposal has: name (short, like "Evening walk"), anchor (an existing moment, starting "After I" or "When I"), tiny (the version that takes under two minutes and still counts), full (the version for good days), timeWindow, daysPerWeek. Always return the current proposal once one exists.

Their "why" is the reason. Bring it up only when it lands, in their words. Never invent anything about them.

Reply in two or three short sentences, usually ending with one question. Never give medical advice, never suggest a calorie target or weight goal, and if something sounds like an injury or an eating problem, suggest a professional and keep the habit gentle.

${SPOKEN}`;

function contextLine(input: WhyTurnInput): string {
  return [
    input.name ? `Their name: ${input.name}` : null,
    `What they want help with: ${input.area}`,
    input.specifics.length ? `Specifically: ${input.specifics.join("; ")}` : null,
    input.routine ? `Do they have a routine for it: ${input.routine}` : null,
    input.obstacles.length ? `What gets in the way: ${input.obstacles.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The conversation as the model sees it; `kickoff` opens it, since it must start on a user turn. */
function toMessages(context: string, turns: readonly SessionTurn[], kickoff: string, note?: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "user", content: `${context}\n\n${kickoff}` }];
  for (const t of turns) {
    messages.push({ role: t.role === "guide" ? "assistant" : "user", content: t.text });
  }
  if (messages[messages.length - 1].role === "assistant") messages.push({ role: "user", content: "(Go on.)" });
  if (note) messages[messages.length - 1].content += `\n\n(${note})`;
  return messages;
}

export async function runWhyTurn(input: WhyTurnInput): Promise<WhyTurnResult> {
  const guideTurns = input.turns.filter((t) => t.role === "guide").length;
  const answers = input.turns.filter((t) => t.role === "you").length;
  const result = await generateStructured<{ say: string; ladder?: string | null; done: boolean; coreWhy?: string | null; concern?: boolean }>({
    task: "whySession",
    system: WHY_SYSTEM,
    messages: toMessages(
      contextLine(input),
      input.turns,
      "They've just arrived at this conversation. Open it: greet them by name if you have it, name what they said in a few words, and ask your first question.",
      guideTurns >= WHY_WRAP_AT
        ? "You've gone far enough. Land it now: set done to true."
        : answers < WHY_MIN_ANSWERS && answers > 0
          ? "Not yet: they've only just started. Stay curious and go one level deeper. Unless they're shutting down, keep done false."
          : undefined
    ),
    toolName: "why_turn",
    toolDescription: "What Kairo says next, and what it means for the ladder.",
    inputSchema: {
      type: "object",
      properties: {
        say: { type: "string", maxLength: 420 },
        ladder: { type: ["string", "null"], maxLength: 60 },
        done: { type: "boolean" },
        coreWhy: { type: ["string", "null"], maxLength: 140 },
        concern: { type: "boolean" },
      },
      required: ["say", "ladder", "done", "coreWhy", "concern"],
    },
  });

  const concern = Boolean(result.concern);
  return {
    say: result.say.trim(),
    ladder: input.turns.some((t) => t.role === "you") ? result.ladder?.trim() || null : null,
    done: Boolean(result.done) || concern,
    coreWhy: concern ? null : result.coreWhy?.trim() || null,
    concern,
  };
}

export async function runNegotiationTurn(input: NegotiateTurnInput): Promise<NegotiateTurnResult> {
  const context = [
    contextLine(input),
    input.helpStyle ? `How they want to be helped: ${input.helpStyle}` : null,
    input.coreWhy ? `Why it matters, in their words: ${input.coreWhy}` : null,
    input.proposal ? `The proposal on the table: ${JSON.stringify(input.proposal)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateStructured<{ say: string; proposal?: NegotiateTurnResult["proposal"]; agreed: boolean }>({
    task: "habitNegotiate",
    system: NEGOTIATE_SYSTEM,
    messages: toMessages(context, input.turns, "They've just come over from Kairo. Open the conversation."),
    toolName: "negotiation_turn",
    toolDescription: "What Althea says next and the habit currently on the table.",
    inputSchema: {
      type: "object",
      properties: {
        say: { type: "string", maxLength: 420 },
        proposal: {
          anyOf: [
            { type: "null" },
            {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 80 },
            anchor: { type: "string", maxLength: 150 },
            tiny: { type: "string", maxLength: 150 },
            full: { type: "string", maxLength: 150 },
            timeWindow: { type: "string", enum: ["morning", "midday", "evening", "anytime"] },
            daysPerWeek: { type: "integer" },
          },
          required: ["name", "anchor", "tiny", "full", "timeWindow", "daysPerWeek"],
            },
          ],
        },
        agreed: { type: "boolean" },
      },
      required: ["say", "proposal", "agreed"],
    },
  });

  const proposal = result.proposal
    ? { ...result.proposal, daysPerWeek: Math.min(7, Math.max(1, Math.round(result.proposal.daysPerWeek))) }
    : (input.proposal ?? null);
  return { say: result.say.trim(), proposal, agreed: Boolean(result.agreed) && proposal !== null };
}

export function registerOnboardingSessionRoutes(app: FastifyInstance) {
  const limit = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

  app.post("/me/onboarding/why", limit, async (request, reply) => {
    const parsed = whyTurnSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "That didn't come through." });
    try {
      return { success: true, data: await runWhyTurn(parsed.data) };
    } catch (err) {
      request.log.warn({ err }, "why turn failed");
      return reply.status(503).send({ success: false, error: "Your guide lost the thread. Try that again?" });
    }
  });

  app.post("/me/onboarding/negotiate", limit, async (request, reply) => {
    const parsed = negotiateTurnSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "That didn't come through." });
    try {
      return { success: true, data: await runNegotiationTurn(parsed.data) };
    } catch (err) {
      request.log.warn({ err }, "negotiation turn failed");
      return reply.status(503).send({ success: false, error: "Your guide lost the thread. Try that again?" });
    }
  });
}
