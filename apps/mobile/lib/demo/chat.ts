/**
 * Scripted guide replies for demo mode, streamed a few words at a time so the
 * typing feel matches the real thing. Replies reference the demo data (the
 * lunchtime walk, the ring, the calendar) so the "it remembers you" part of
 * the product comes across.
 */

import type { GuideId } from "@kinextion/ai-core";

type Script = { match: RegExp; reply: string }[];

const SCRIPTS: Record<GuideId, { scripts: Script; fallback: string[] }> = {
  altheo: {
    scripts: [
      {
        match: /^(?!.*(skip|missing)).*(train|rest|today|workout)/i,
        reply:
          "Train — but keep it honest. Your HRV is 54 this morning, above your two-week average, and you slept 7h20. That's a green light.\n\nGiven you ran Tuesday, I'd go for 30 minutes of strength rather than another run: squats, push-ups, rows with the bands, and a plank to finish. Your calendar's clear from 6:15 to 7:30, so that's the slot.\n\nWant me to turn it into a habit for Thursdays?",
      },
      {
        match: /skip|keep missing|same workout|consisten/i,
        reply:
          "You've skipped the stretch 5 of the last 9 days — and every one of those was a day with more than six hours of meetings. The kettle cue works at home; on office days there's no kettle moment.\n\nTwo options: anchor it to something that happens on busy days too (closing your laptop at lunch already works for your walk), or make it smaller — one minute, hips only. Which sounds more like you?",
      },
      {
        match: /20|session|build|plan/i,
        reply:
          "Here's 20 minutes, no equipment beyond your bands:\n\n• 3 min — easy mobility: hips, shoulders, ankles\n• 12 min — 4 rounds: 10 squats, 8 band rows, 8 push-ups, 20s plank\n• 5 min — cool-down stretch, long exhales\n\nYour resting heart rate has dropped 3 bpm this month, so if round four feels easy, add a fifth next week.",
      },
    ],
    fallback: [
      "Good question. Looking at your last two weeks — sleep trending up, the lunchtime walk holding at 12 days — you've got more capacity than you did a month ago. I'd use it on consistency before intensity. What's the one thing you'd most like to get easier?",
    ],
  },
  kairo: {
    scripts: [
      {
        match: /off|feeling|weird|low/i,
        reply:
          "Thank you for saying so. \"Off\" is worth taking seriously, even when it's hard to name.\n\nI noticed you tagged Monday and Tuesday as \"scattered\", and your stress has sat at 6 or above since the weekend. That's a real shift from last week.\n\nNo need to fix anything yet. If you had to put a single word to what's underneath it — tired, worried, lonely, something else — what would it be?",
      },
      {
        match: /consisten|stick|keep going|give up/i,
        reply:
          "Can I reflect something back? Your consistency isn't breaking randomly. It holds on days that have a shape — the walk after lunch has lasted 12 days because lunch always happens.\n\nIt breaks on days that get taken from you: long meetings, late nights. That isn't a willpower problem. It's that the habit had nowhere to live that day.\n\nWhat would it feel like to plan for the hard days rather than the good ones?",
      },
      {
        match: /weigh|heavy|stress|anxious|worried/i,
        reply:
          "I'm glad you brought it here. You don't have to have it sorted before you say it.\n\nTake your time. What's the part of it that keeps coming back when you're trying to switch off?",
      },
      {
        match: /apologis|community|room|question/i,
        reply:
          "This week's question is a big one. I won't answer it for you — but I can help you find your way in.\n\nThink back to the last time you said sorry and then thought, \"why did I say that?\" Where were you, and who were you with? Often the answer lives in that moment, not in the abstract.",
      },
    ],
    fallback: [
      "I hear you. Say a little more — I'd rather understand it properly than rush to an answer.",
    ],
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoStreamChat(
  guide: GuideId,
  text: string,
  onDelta: (full: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { scripts, fallback } = SCRIPTS[guide];
  const reply = scripts.find((s) => s.match.test(text))?.reply ?? fallback[0]!;

  await wait(900); // "thinking"
  const tokens = reply.split(/(\s+)/);
  let full = "";
  for (let i = 0; i < tokens.length; i += 3) {
    if (signal?.aborted) break;
    full += tokens.slice(i, i + 3).join("");
    onDelta(full);
    await wait(45);
  }
  return full;
}
