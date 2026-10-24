/**
 * Who someone is, in their own words — so the guides can fit advice to a
 * real life instead of an average one.
 *
 * A Black man in Houston, a night-shift nurse with two kids, a student in
 * Minneapolis: the same "walk after work" plan lands differently for each.
 * Texas heat moves a walk to 7am; a night shift moves "morning" to 6pm.
 *
 * Everything here is optional, self-described free text, never inferred,
 * and can be cleared at any time. The rules travel with the data: it shapes
 * fit, it is never a basis for assumptions.
 */

import { z } from "zod";

const field = (max: number) => z.string().trim().max(max).optional();

export const backgroundSchema = z.object({
  /** "man", "woman", "non-binary" — whatever they write. */
  gender: field(40),
  /** Race, ethnicity or cultural background: "Black", "Nigerian-American". */
  ethnicity: field(80),
  /** City and state or country: "Houston, Texas". */
  location: field(80),
  /** What their days look like: "nurse, night shifts". */
  work: field(120),
  /** Who they live with: "my wife and two kids under 5". */
  household: field(120),
  /** Anything else they want their guides to know. */
  notes: field(300),
});

export type UserBackground = z.infer<typeof backgroundSchema>;

const LABELS: Record<keyof UserBackground, string> = {
  gender: "Gender",
  ethnicity: "Background",
  location: "Lives in",
  work: "Work",
  household: "Household",
  notes: "Also wants you to know",
};

/** One line per filled-in field, in their words. */
export function backgroundLines(bg: UserBackground | null | undefined): string[] {
  if (!bg) return [];
  return (Object.keys(LABELS) as Array<keyof UserBackground>)
    .map((k) => [k, bg[k]?.trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${LABELS[k]}: ${v}`);
}

/** How the AI may and may not use the section. Sent with it, every time. */
export const BACKGROUND_RULES = `How to use this: it is here so advice fits their actual life — the climate and seasons where they live, their schedule, the food, family and community around them, and references that land for them.
- Never assume tastes, beliefs, income, fitness or health from race, ethnicity, gender or place. If something matters, ask.
- Don't announce it ("as a Black man…", "since you're in Texas…"). It should show in how well the advice fits, not in labels.
- Health differences between groups: only if they bring it up, only what is well established, and framed as worth raising with their doctor.
- If what they say now differs from this, believe what they say now.`;

/** The full prompt section, or null when they've shared nothing. */
export function formatBackground(bg: UserBackground | null | undefined): string | null {
  const lines = backgroundLines(bg);
  if (!lines.length) return null;
  return `## About Them, in Their Own Words\n${lines.join("\n")}\n\n${BACKGROUND_RULES}`;
}
