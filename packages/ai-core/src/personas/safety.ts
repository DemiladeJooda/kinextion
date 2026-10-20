/**
 * Shared safety rules — appended to EVERY guide's system prompt.
 *
 * The crisis protocol used to live only in Kairo's prompt, which left a real
 * gap: a user can disclose self-harm to the coach just as easily as to the
 * listener, and the marketing-site chat had no protocol at all. Safety is not
 * persona-specific, so it is composed in centrally for every guide and every
 * surface.
 */

/**
 * Crisis resources, as data.
 *
 * Structured rather than embedded in the prompt string below because they now
 * have a second consumer: a static screen in the app, so someone in trouble can
 * find them without first having to start a conversation and disclose enough
 * for a model to decide to offer them. Both surfaces read this list, so the
 * numbers a guide gives and the numbers on the screen cannot diverge.
 */
export const CRISIS_RESOURCES = [
  {
    name: "988 Suicide & Crisis Lifeline",
    region: "US",
    detail: "call or text 988",
    href: "tel:988",
  },
  {
    name: "Crisis Text Line",
    region: "US",
    detail: "text HOME to 741741",
    href: "sms:741741",
  },
  {
    name: "International Association for Suicide Prevention",
    region: "Worldwide",
    detail: "https://www.iasp.info/resources/Crisis_Centres/",
    href: "https://www.iasp.info/resources/Crisis_Centres/",
  },
] as const;

const RESOURCE_LINES = CRISIS_RESOURCES.map(
  (r) => `   - ${r.name} (${r.region}): ${r.detail}`
).join("\n");

export const CRISIS_PROTOCOL = `## Crisis Safety Protocol (overrides everything else)
If the conversation suggests self-harm or suicidal ideation, severe hopelessness, abuse, or immediate danger, drop the persona's usual style and respond with:
1. Immediate, plain empathy and validation — no coaching, no reframing, no metrics.
2. Clear, non-judgmental encouragement to reach out to a professional or a trusted person.
3. These resources, verbatim:
${RESOURCE_LINES}
4. A reminder that they are not alone and that asking for support is a sign of strength.

Never attempt to diagnose, treat, or replace professional mental health support. Never minimise, and never respond to a disclosure like this with a habit suggestion or a data readout.`;

export const MEDICAL_BOUNDARIES = `## Medical Boundaries
- You are not a doctor, therapist, dietitian, or physiotherapist, and you never imply otherwise.
- Pain, injury, or medical symptoms → recommend a qualified healthcare provider. Do not diagnose.
- Never prescribe medication, treatment plans, or therapeutic diets for medical conditions.
- If the user discloses a history of disordered eating, permanently avoid weight, calorie, and restriction framing with them and focus on energy, strength, and how they feel.
- Be honest about uncertainty. "I don't know" is a valid, trust-building answer.`;

/** Composed safety block appended after the persona and before the format rules. */
export const SAFETY_BLOCK = `${CRISIS_PROTOCOL}\n\n${MEDICAL_BOUNDARIES}`;
