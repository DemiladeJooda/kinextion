/**
 * General questions for weeks when a room hasn't given the facilitator enough
 * to work with — too few suggestions, or a model that's unavailable.
 *
 * Written to the same standard as a synthesized option: open rather than
 * leading, answerable from anyone's own life, and not bait. None assumes a
 * faith, a relationship status, a job or a politics. They are starting
 * points a community would plausibly want to talk about, not content.
 */

import type { TopicTheme } from "@kinextion/shared";

export interface BankPrompt {
  text: string;
  theme: TopicTheme;
}

export const PROMPT_BANK: readonly BankPrompt[] = [
  { text: "What's something you changed your mind about in the last few years?", theme: "growth" },
  { text: "What does a good week actually look like for you right now?", theme: "growth" },
  { text: "What's a habit you've tried to build that just didn't stick — and why?", theme: "growth" },
  { text: "What advice did you get early on that turned out to be wrong?", theme: "growth" },
  { text: "Is it better to be really good at one thing or decent at many?", theme: "growth" },
  { text: "What does being a good friend ask of you that you didn't expect?", theme: "relationships" },
  { text: "How do you know when a friendship has run its course?", theme: "relationships" },
  { text: "Is it harder to make close friends as an adult, or do we just try less?", theme: "relationships" },
  { text: "What makes someone easy to disagree with?", theme: "relationships" },
  { text: "What's something your family did that you want to keep doing?", theme: "family" },
  { text: "What's something your family did that you've decided not to repeat?", theme: "family" },
  { text: "How much should your parents' expectations shape your choices?", theme: "family" },
  { text: "Would you take a job you loved for less money than one you'd tolerate?", theme: "work" },
  { text: "Is ambition something to encourage or something to be careful with?", theme: "work" },
  { text: "What does rest look like for you, and do you actually get it?", theme: "work" },
  { text: "Should your work be part of your identity?", theme: "work" },
  { text: "What's a money decision you're proud of, big or small?", theme: "money" },
  { text: "How much is enough — and has your answer changed?", theme: "money" },
  { text: "Is it fine to talk openly about money with friends?", theme: "money" },
  { text: "What's one thing that genuinely helps you when your head is noisy?", theme: "health" },
  { text: "Do we talk about mental health too much now, or still not enough?", theme: "health" },
  { text: "What's a small thing you do for your body that makes a big difference?", theme: "health" },
  { text: "Where do you find stillness in an ordinary day?", theme: "faith" },
  { text: "What's something you believe that you find hard to explain to others?", theme: "faith" },
  { text: "How has what gives your life meaning changed as you've grown up?", theme: "faith" },
  { text: "What part of who you are do people most often misread?", theme: "identity" },
  { text: "Where you grew up — how much of it do you still carry?", theme: "identity" },
  { text: "When do you feel most like yourself?", theme: "identity" },
  { text: "What does it mean to be a good neighbour today?", theme: "community" },
  { text: "What would make this community better a year from now?", theme: "community" },
  { text: "Who is someone in your life who deserves more credit than they get?", theme: "community" },
  { text: "Has social media made you closer to people, or just more aware of them?", theme: "culture" },
  { text: "What's a piece of music, film or book that changed how you see something?", theme: "culture" },
  { text: "Is there a tradition you think is worth reviving?", theme: "culture" },
  { text: "What's the best meal you've ever had, and who were you with?", theme: "lighthearted" },
  { text: "What's a hill you're willing to die on that really doesn't matter?", theme: "lighthearted" },
  { text: "If you had a completely free Saturday, what would you actually do?", theme: "lighthearted" },
  { text: "What's a skill you'd learn instantly if you could?", theme: "lighthearted" },
];
