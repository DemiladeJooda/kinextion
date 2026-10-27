/**
 * "What do you have access to?", asked about the person someone wants to
 * become rather than assuming they want to get fit.
 *
 * Someone becoming "a calmer parent" has no use for a kettlebell question,
 * and someone becoming "a writer who finishes things" does need to say
 * whether they have a quiet hour and a laptop. The options come from what
 * they wrote and the goals they picked; an AI pass can add more for wording
 * these keywords miss. The fitness labels match EQUIPMENT_OPTIONS exactly,
 * because starter habits and workout context still key off them.
 */

import { EQUIPMENT_OPTIONS } from "../constants/index.js";

interface AccessTopic {
  /** Matched against their identity line and goals, lower-cased. */
  words: RegExp;
  options: readonly string[];
}

const MOVEMENT: readonly string[] = [
  ...EQUIPMENT_OPTIONS,
  "Somewhere safe to walk or run",
  "A pool",
];

const TOPICS: readonly AccessTopic[] = [
  {
    words: /\b(fit|strong|stronger|train|trains|gym|lift|lifts|run|runs|runner|marathon|athlet|active|move|moves|body|muscle|weight|lean|sport|yoga|cardio|walk|walks|swim|cycl|bike|stay active|get stronger|lose weight)/,
    options: MOVEMENT,
  },
  {
    words: /\b(calm|stress|anxi|mind|mental|clarity|focus|present|meditat|breath|peace|patien|grounded|therap|journal)/,
    options: ["A quiet spot at home", "A journal or notebook", "Headphones", "A meditation app", "Ten minutes to myself"],
  },
  {
    words: /\b(sleep|rest|rested|tired|energy|wind down|morning person|early riser|bed)/,
    options: ["A bedroom I can keep dark", "A charger outside the bedroom", "A regular wake-up time", "An alarm clock that isn't my phone"],
  },
  {
    words: /\b(eat|eats|food|cook|cooks|nutrition|diet|healthy|meal|protein|sugar|lose weight|weight)/,
    options: ["A kitchen to cook in", "Time to meal prep", "A grocery store nearby", "A water bottle"],
  },
  {
    words: /\b(read|reads|reader|learn|learns|study|student|skill|language|knowledge|curious)/,
    options: ["Books or an e-reader", "A library nearby", "A laptop or tablet", "A commute I can use"],
  },
  {
    words: /\b(writ|creat|art|artist|music|musician|paint|draw|design|build|builds|maker|photograph|film|poet|novel)/,
    options: ["A laptop or tablet", "A quiet hour most days", "A place to make things", "My instrument or tools"],
  },
  {
    words: /\b(career|work|business|founder|entrepreneur|leader|product|money|financ|save|saves|disciplin|organi[sz]ed|consisten|shows up|promises)/,
    options: ["A calendar I actually use", "A quiet hour most days", "A laptop or tablet", "Someone to keep me accountable"],
  },
  {
    words: /\b(confiden|brave|social|friend|connect|outgoing|speak|community|parent|partner|family|kind|present for)/,
    options: ["A friend to do it with", "A local club or group", "Time with family most days", "Someone to keep me accountable"],
  },
];

/** Shown when nothing they wrote matches a topic. */
const GENERAL: readonly string[] = [
  "No equipment (bodyweight)",
  "Somewhere safe to walk or run",
  "A quiet spot at home",
  "A journal or notebook",
  "Ten minutes to myself",
  "A friend to do it with",
];

const MAX_OPTIONS = 12;

/**
 * Options for "What do you have access to?", most relevant first. The
 * identity line counts before the goals: it's the more personal answer.
 */
export function accessOptionsFor(identity: string | null | undefined, goals: readonly string[] = []): string[] {
  const sources = [identity ?? "", ...goals].map((s) => s.toLowerCase()).filter(Boolean);
  const picked: string[] = [];
  for (const source of sources) {
    for (const topic of TOPICS) {
      if (topic.words.test(source)) picked.push(...topic.options);
    }
  }
  const options = [...new Set(picked.length ? picked : GENERAL)];
  return options.slice(0, MAX_OPTIONS);
}
