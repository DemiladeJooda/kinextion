# Habit design guide

Every user-facing surface in Kinextion should trace back to a principle. This
file is the short version of the habits MVP plan
(https://claude.ai/artifact/1XaDq3nxegMPVdVmHkhipk), kept next to the code so a
PR can be checked against it.

## The rule behind every screen

Design for **the gator**, not the judge (Zoe Chance, *Influence Is Your
Superpower*). Picture the user tired, distracted and not trying. If the screen
still works for them, ship it. If it needs motivation, memory or willpower, it
will fail on a bad day.

## Gator checklist (answer in every PR that touches a user-facing screen)

1. Does it work for someone tired, distracted and not trying?
2. How many taps does the core action take? Can it be one?
3. Is the default already the healthy choice?
4. Is the copy a concrete, same-day benefit, phrased as an invitation?
5. Does it reuse the user's own words (their why, identity or precommitment)?
6. Is the user forgiven for a bad day?
7. Could it become compulsive? What stops that?
8. Which principle below does it serve? If none, cut it.

## Principles (numbers match the plan)

| # | Principle | Evidence | Shows up as |
|---|-----------|----------|-------------|
| 1 | Plan exactly when ("After I ___, I'll ___") | Strong | Anchor-first builder, cue on every row |
| 2 | Expect two months or more | Strong | No "21 days"; tiny versions |
| 3 | Measure automaticity | Strong | Weekly SRBAI check, graduation |
| 4 | Record it, share it | Strong | One-tap logging, history, Rooms sharing |
| 5 | Streaks that survive one miss | Moderate | Never miss twice, rest credit, comebacks |
| 6 | Flexible beats rigid | Moderate | Time windows, "X a week" |
| 7 | Reminders point at the cue, then fade | Moderate | Per-habit cue reminders |
| 8 | Plan for the obstacle | Moderate | "What would it take?" → backup plan |
| 9 | Fresh starts | Moderate | Monday reviews, 1st-of-month restarts |
| 10 | ~4 sessions a week for gym habits | Moderate | Altheo's frequency tip |
| 11 | Pair it with something you want | Thin | Optional "pair it with" field |
| 12 | Life changes reopen habits | Thin | Travel / life-change mode |
| 13 | A few at a time | Design judgement | Soft limit of 3 in Building |

The 4Ps (Chance, Gorlin & Dhar 2014) sort the same work by lever:
**Possibilities** (what's offered), **Process** (how the choice is made),
**Persuasion** (how it's said), **Person** (how intentions are reinforced).

## Copy rules

- Same-day, concrete benefits: "You'll sleep better tonight", not "reduces
  long-term cortisol".
- Invitations, not instructions: "Want to try…?" Overtly persuasive health
  appeals can trigger resistance.
- Plain words for the habit loop: *when (after I…)*, *why it matters*, *the
  tiny version*, *today's payoff*. Never name the book in the UI.
- After a miss, ask "What would it take to make this easier tomorrow?"
  Never "you broke your streak".
- Reflect back what the user said before suggesting anything. One suggestion
  at a time.
- Never show the user's raw text back verbatim. Use the AI-tidied reading
  (`displayFields` in `@kinextion/shared`): same meaning, their voice, no
  self-criticism. Keep the raw text for editing and for the model's context,
  and show "How Kinextion reads this" so the tidy-up is never silent. A why
  flagged as distress is never quoted.
- The AI is an assistant working in the background (understanding, tidying,
  planning), not mainly a chat. Prefer doing it for the user over asking.
- Credit Chance's own claims to her (for example "up to 95% of decisions");
  don't state them as established fact.
- Labelled thresholds (rest days, graduation score, the limit of 3) are design
  judgements. Don't call them research-backed in marketing.

## Guardrails

- The Score and streaks are never the goal. Consistency and automaticity lead.
- Watch for compulsive use (dozens of opens a day, logging after midnight).
  Kairo checks in gently and never blocks.
- No public habit leaderboards. Rooms keeps hidden totals and weekly expiry.

## Engineering rules that keep it honest

- "Today" is the user's today: `localDateKey(now, timeZone)` from
  `@kinextion/shared`. The app sends `X-Time-Zone` on every request.
- Due-today, streaks and consistency come from `packages/shared/src/habits/`.
  Don't write another streak loop.
