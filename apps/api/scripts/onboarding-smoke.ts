/**
 * Live check of the onboarding conversations against the real model.
 *
 *   pnpm --filter @kinextion/api exec tsx scripts/onboarding-smoke.ts
 *
 * Plays one scripted person through Kairo's "why" conversation and Althea's
 * negotiation, printing every turn. Costs a few cents. Read the output: the
 * thing being tested is whether it sounds like someone who's listening.
 */

import type { HabitProposal, SessionTurn } from "@kinextion/shared";
import { runNegotiationTurn, runWhyTurn } from "../src/modules/users/onboarding-session.js";

const person = {
  name: "Dee",
  area: "Moving my body",
  specifics: ["Staying consistent"],
  routine: "I've tried, and nothing's stuck",
  obstacles: ["I start strong, then drop off", "Other people need me"],
};

const ANSWERS = [
  "I want to go to the gym and actually keep going.",
  "I guess I want to look good and be healthy.",
  "Honestly it's my kids. I want to be able to keep up with them.",
  "My dad got sick when I was twelve. He couldn't do anything with us after that. I don't want that for them.",
  "Yeah. That's it.",
];

async function why(): Promise<string | undefined> {
  const turns: SessionTurn[] = [];
  for (let i = 0; i <= ANSWERS.length; i++) {
    const r = await runWhyTurn({ ...person, turns });
    console.log(`\nKAIRO: ${r.say}`);
    if (r.ladder) console.log(`  [ladder] ${r.ladder}`);
    if (r.done) {
      console.log(`  [core why] ${r.coreWhy}`);
      return r.coreWhy ?? undefined;
    }
    turns.push({ role: "guide", text: r.say });
    console.log(`YOU: ${ANSWERS[i]}`);
    turns.push({ role: "you", text: ANSWERS[i] });
  }
  return undefined;
}

async function negotiate(coreWhy: string | undefined) {
  const turns: SessionTurn[] = [];
  let proposal: HabitProposal | undefined;
  for (const answer of [null, "I want to go to the gym five days a week before work.", "Fine. Make it smaller.", "That works for me."]) {
    if (answer) {
      console.log(`YOU: ${answer}`);
      turns.push({ role: "you", text: answer });
    }
    const r = await runNegotiationTurn({ ...person, coreWhy, helpStyle: "straight", proposal, turns });
    console.log(`\nALTHEA: ${r.say}`);
    if (r.proposal) {
      proposal = r.proposal;
      console.log(`  [proposal] ${JSON.stringify(r.proposal)}`);
    }
    if (r.agreed) console.log("  [agreed]");
    turns.push({ role: "guide", text: r.say });
  }
}

const coreWhy = await why();
console.log("\n──────────");
await negotiate(coreWhy);
