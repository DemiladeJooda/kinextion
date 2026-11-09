/**
 * What Kinextion asks when you arrive, and what it saves for later.
 *
 * Onboarding asks only what it needs to help today: what's wrong, specifically,
 * what's been in the way, and why it matters. Everything else (your days, your
 * home, your kit, whether you see a therapist) arrives later, one question at
 * a time, each saying why it's being asked.
 */

import { z } from "zod";

export interface FocusArea {
  id: string;
  label: string;
  /** Asked straight after, because "better sleep" means ten different things. */
  question: string;
  specifics: readonly string[];
  category: "physical" | "mental" | "emotional" | "spiritual";
}

export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    id: "sleep",
    label: "My sleep",
    question: "When you think about your sleep, what's actually the problem?",
    specifics: ["Falling asleep", "Waking up in the night", "Getting up in the morning", "Not getting enough hours", "Waking up tired anyway"],
    category: "physical",
  },
  {
    id: "moving",
    label: "Moving my body",
    question: "What's the hard part about moving more?",
    specifics: ["Getting started", "Staying consistent", "Finding the time", "Knowing what to do", "Coming back after a break"],
    category: "physical",
  },
  {
    id: "strength",
    label: "Getting stronger or fitter",
    question: "Where are you stuck with getting stronger?",
    specifics: ["I've plateaued", "I keep getting hurt", "I don't have a real plan", "I can't stay consistent", "Recovering between sessions"],
    category: "physical",
  },
  {
    id: "food",
    label: "How I eat",
    question: "What feels off about how you're eating?",
    specifics: ["Skipping meals", "Eating late at night", "Too much takeout", "Eating when I'm stressed", "Not knowing what's right for me"],
    category: "physical",
  },
  {
    id: "stress",
    label: "Stress",
    question: "How does stress show up for you?",
    specifics: ["I can't switch off", "Too much on my plate", "I get short with people", "It sits in my body", "I avoid things"],
    category: "mental",
  },
  {
    id: "focus",
    label: "Focus and my phone",
    question: "What pulls you off course most?",
    specifics: ["My phone", "Putting things off", "Too many things at once", "Running out of energy by afternoon"],
    category: "mental",
  },
  {
    id: "self",
    label: "Feeling more like myself",
    question: "What's felt different lately?",
    specifics: ["Low energy", "Low mood", "I've lost my routine", "I don't feel confident", "I've stopped doing things I love"],
    category: "emotional",
  },
  {
    id: "people",
    label: "The people around me",
    question: "What would you want to be different?",
    specifics: ["Seeing friends more", "Feeling less alone", "Being more present at home", "Finding people like me"],
    category: "emotional",
  },
];

export const ROUTINE_OPTIONS = [
  "Yes, and it mostly works",
  "Yes, but it keeps falling apart",
  "I've tried, and nothing's stuck",
  "Not really",
] as const;

export const OBSTACLE_OPTIONS = [
  "I start strong, then drop off",
  "I forget",
  "My schedule changes a lot",
  "I don't know where to start",
  "I get overwhelmed",
  "I lose interest",
  "Other people need me",
  "I'm too tired",
] as const;

export const HELP_STYLES = [
  { id: "straight", label: "Give it to me straight", intensity: "intense", note: "Direct, and holds you to it" },
  { id: "gentle", label: "Be gentle with me", intensity: "gentle", note: "Patient on the hard days" },
  { id: "plan", label: "Just tell me what to do", intensity: "balanced", note: "Clear next steps, less talk" },
  { id: "why", label: "Help me work out why", intensity: "balanced", note: "Questions before answers" },
] as const;

export type HelpStyleId = (typeof HELP_STYLES)[number]["id"];

export const understandingSchema = z.object({
  area: z.string().trim().min(1).max(60),
  specifics: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
  routine: z.string().trim().max(60).optional(),
  obstacles: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  helpStyle: z.enum(["straight", "gentle", "plan", "why"]).optional(),
  /** From what they want, down to the real reason, in their words. */
  whyLadder: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  coreWhy: z.string().trim().max(200).optional(),
});

export type Understanding = z.infer<typeof understandingSchema>;

/** One side of the conversation, as the session routes receive it. */
export const sessionTurnSchema = z.object({
  role: z.enum(["guide", "you"]),
  text: z.string().trim().min(1).max(1500),
});

export type SessionTurn = z.infer<typeof sessionTurnSchema>;

export const whyTurnSchema = z.object({
  name: z.string().trim().max(50).optional(),
  area: z.string().trim().min(1).max(60),
  specifics: z.array(z.string().trim().max(120)).max(6).default([]),
  routine: z.string().trim().max(60).optional(),
  obstacles: z.array(z.string().trim().max(120)).max(8).default([]),
  turns: z.array(sessionTurnSchema).max(14).default([]),
});

export type WhyTurnInput = z.infer<typeof whyTurnSchema>;

export interface WhyTurnResult {
  /** What the guide says next. Spoken aloud. */
  say: string;
  /** Their latest answer as a short label for the ladder, in their words. */
  ladder: string | null;
  done: boolean;
  coreWhy: string | null;
  concern: boolean;
}

export const habitProposalSchema = z.object({
  name: z.string().trim().min(1).max(100),
  anchor: z.string().trim().min(1).max(160),
  tiny: z.string().trim().min(1).max(160),
  full: z.string().trim().min(1).max(160),
  timeWindow: z.enum(["morning", "midday", "evening", "anytime"]),
  daysPerWeek: z.number().int().min(1).max(7),
});

export type HabitProposal = z.infer<typeof habitProposalSchema>;

export const negotiateTurnSchema = whyTurnSchema.extend({
  helpStyle: z.enum(["straight", "gentle", "plan", "why"]).optional(),
  coreWhy: z.string().trim().max(200).optional(),
  proposal: habitProposalSchema.optional(),
});

export type NegotiateTurnInput = z.infer<typeof negotiateTurnSchema>;

export interface NegotiateTurnResult {
  say: string;
  proposal: HabitProposal | null;
  agreed: boolean;
}

/** A settled proposal as a habit, carrying their why. */
export function habitFromProposal(proposal: HabitProposal, coreWhy: string | undefined, category: FocusArea["category"]) {
  const everyDay = proposal.daysPerWeek >= 7;
  return {
    name: proposal.name,
    category,
    cue: proposal.anchor.slice(0, 200),
    response: proposal.tiny.slice(0, 200),
    fullVersion: proposal.full.slice(0, 200),
    ...(coreWhy ? { craving: coreWhy.slice(0, 200) } : {}),
    frequency: everyDay ? ("daily" as const) : ("weekly" as const),
    ...(everyDay ? {} : { perWeekTarget: proposal.daysPerWeek }),
    timeWindow: proposal.timeWindow,
  };
}

// ─── Getting to know you, a little at a time ─────────────────────────────────

export type GetToKnowField = "work" | "household" | "location" | "fitness" | "equipment" | "support";

export interface GetToKnowQuestion {
  id: GetToKnowField;
  question: string;
  /** What it's for. Shown every time, so nothing feels like prying. */
  why: string;
  placeholder?: string;
  options?: readonly { label: string; value: string }[];
  multi?: boolean;
}

export const GET_TO_KNOW: readonly GetToKnowQuestion[] = [
  {
    id: "work",
    question: "What does a normal weekday look like for you?",
    why: "So we don't plan a 6am anything around someone working nights. Only your guides see this.",
    placeholder: "e.g. desk job, home by six",
  },
  {
    id: "fitness",
    question: "How active are you right now?",
    why: "It keeps your first few weeks the right size.",
    options: [
      { label: "Not very", value: "beginner" },
      { label: "Somewhat", value: "intermediate" },
      { label: "Very", value: "advanced" },
    ],
  },
  {
    id: "household",
    question: "Who's at home with you?",
    why: "Evenings look different with kids at bath time or a partner on shifts. Skip it if you'd rather.",
    placeholder: "e.g. my partner and two kids",
  },
  {
    id: "equipment",
    question: "Is there anything you'd actually want to use?",
    why: "Having a gym membership and wanting to go are different things. Pick only what you'd use.",
    multi: true,
    options: [
      { label: "A gym", value: "A gym" },
      { label: "Weights at home", value: "Weights at home" },
      { label: "Somewhere to walk", value: "Somewhere to walk" },
      { label: "A bike", value: "A bike" },
      { label: "A friend to do it with", value: "A friend to do it with" },
      { label: "Just my body", value: "Just my body" },
    ],
  },
  {
    id: "location",
    question: "Roughly where do you live?",
    why: "Heat, cold and daylight change what's realistic. A city is plenty.",
    placeholder: "e.g. Houston",
  },
  {
    id: "support",
    question: "Do you talk to anyone for support, like a therapist or coach?",
    why: "Kairo can work alongside that and never replaces it. It doesn't need any details.",
    options: [
      { label: "Yes, regularly", value: "regular" },
      { label: "Now and then", value: "sometimes" },
      { label: "Not right now", value: "none" },
      { label: "I'd rather not say", value: "private" },
    ],
  },
];

/** The next question to ask, or null when there's nothing left or it's too soon. */
export function nextGetToKnow(state: { done: readonly string[]; lastShown: string | null }, today: string): GetToKnowQuestion | null {
  if (state.lastShown === today) return null;
  return GET_TO_KNOW.find((q) => !state.done.includes(q.id)) ?? null;
}
