/**
 * One person's story, told across all six phone screens on the home page.
 *
 * The page picks one per visit so the screens read as a single thread: what
 * they said first becomes their why, their why shapes the habit, the habit is
 * what gets adjusted on a hard day, and so on to the pod they end up in.
 *
 * All of it is sample content. The page says so under the phone.
 */

export interface JourneyScenario {
  readonly id: string;
  /** 1. Getting to know each other (Kairo). */
  readonly opener: string;
  readonly kairoReply: string;
  /** 2. The ladder from what they said down to what drives them. */
  readonly why: readonly [string, string, string, string];
  /** 3. Shaping the habit (Althea). */
  readonly ask: string;
  readonly counter: string;
  readonly habit: { readonly title: string; readonly anchor: string; readonly badDay: string };
  /** 4. The relationship, on a hard day. */
  readonly hardDay: string;
  readonly adjust: string;
  readonly swapped: string;
  /** 5. Growth at week nine. */
  readonly identity: string;
  readonly summary: string;
  readonly unit: string;
  readonly weeks: readonly number[];
  readonly forgiven: string;
  /** 6. The community pod. */
  readonly pod: string;
  readonly question: string;
}

export const SCENARIOS: readonly JourneyScenario[] = [
  {
    id: "gym",
    opener: "I want to get back in the gym. I keep stopping.",
    kairoReply: "Thanks for telling me. Let's find out what keeps stopping you.",
    why: [
      "Get back in the gym",
      "Feel strong in my body again",
      "Have energy for my kids after work",
      "Be the parent who joins in, not the one watching",
    ],
    ask: "Five mornings a week. Let's go.",
    counter: "Five is the trap. You've stopped at five before. Three you'll keep, then we grow it.",
    habit: { title: "Gym, 3 mornings a week", anchor: "After school drop-off · 30 min", badDay: "10 minutes still counts" },
    hardDay: "Only slept five hours. I can't do the gym today.",
    adjust: "Then we don't do the gym. Ten-minute walk after lunch. It counts, and nothing resets.",
    swapped: "Swapped today to a 10-minute walk",
    identity: "You're someone who trains.",
    summary: "27 sessions. Grew from 3 mornings to 4.",
    unit: "Mornings each week",
    weeks: [2, 3, 2, 3, 3, 3, 4, 3, 4],
    forgiven: "Missed week 3 twice. Nothing reset.",
    pod: "Parents who train",
    question: "What do your kids see you do now that they didn't before?",
  },
  {
    id: "sleep",
    opener: "I want to actually sleep. I'm on my phone till 1am.",
    kairoReply: "That's honest. Let's find out what the phone is doing for you.",
    why: [
      "Sleep properly",
      "Stop waking up already tired",
      "Have patience left by the evening",
      "Be present with the people I love, not just in the room",
    ],
    ask: "Lights out at 9:30, every night.",
    counter: "From 1am, that's a cliff. Phone on the kitchen charger by 10:30, four nights. Then we move it earlier.",
    habit: { title: "Phone down by 10:30, 4 nights", anchor: "After brushing your teeth · charger in the kitchen", badDay: "10 minutes earlier than last night counts" },
    hardDay: "Deadline week. I was up till 1 again.",
    adjust: "Then tonight isn't about 10:30. Phone down by midnight, and we protect the weekend. Nothing resets.",
    swapped: "Moved tonight to midnight",
    identity: "You're someone who protects their sleep.",
    summary: "31 nights. Grew from 4 nights a week to 5.",
    unit: "Nights each week",
    weeks: [2, 3, 4, 3, 4, 4, 5, 4, 5],
    forgiven: "Deadline week cost three nights. Nothing reset.",
    pod: "Reforming night owls",
    question: "What's keeping you up that isn't your phone?",
  },
  {
    id: "calm",
    opener: "I want to be calmer. I snap at everyone after work.",
    kairoReply: "I'm glad you said it out loud. Let's see what you're carrying home.",
    why: [
      "Be less stressed",
      "Stop bringing work through the front door",
      "Enjoy dinner with my partner again",
      "Be someone my family is glad to see walk in",
    ],
    ask: "An hour of meditation every morning.",
    counter: "An hour is a wish. Ten minutes walking before you open the front door, four workdays. Then we build.",
    habit: { title: "Walk the block before going in", anchor: "After you park · 4 workdays · 10 min", badDay: "three slow breaths in the car counts" },
    hardDay: "Brutal day. I went straight inside.",
    adjust: "That's allowed. Tomorrow, two minutes outside before the door. Small, and nothing resets.",
    swapped: "Tomorrow: 2 minutes before the door",
    identity: "You're someone who arrives calm.",
    summary: "29 walks. Grew from 4 workdays to 5.",
    unit: "Workdays each week",
    weeks: [2, 4, 3, 4, 4, 3, 5, 4, 5],
    forgiven: "Skipped most of week 6. Nothing reset.",
    pod: "Leaving work at work",
    question: "What do you carry home that isn't yours to carry?",
  },
  {
    id: "cook",
    opener: "I want to cook for myself. I order in most nights.",
    kairoReply: "Good place to start. Let's find out what cooking would give you.",
    why: [
      "Cook at home more",
      "Stop feeling heavy after every takeaway",
      "Have energy and money left at the end of the month",
      "Look after myself the way I look after everyone else",
    ],
    ask: "Cooking every single night.",
    counter: "Every night ends by Thursday. Two dinners, Sunday and Wednesday. Then we add a third.",
    habit: { title: "Cook dinner, 2 nights a week", anchor: "Sunday and Wednesday · after work", badDay: "eggs on toast counts" },
    hardDay: "Home at nine. No way I'm cooking.",
    adjust: "Then don't cook. Eggs on toast, ten minutes. It counts, and nothing resets.",
    swapped: "Swapped tonight to eggs on toast",
    identity: "You're someone who cooks.",
    summary: "22 dinners. Grew from 2 nights to 3.",
    unit: "Dinners each week",
    weeks: [1, 2, 2, 1, 2, 3, 2, 3, 3],
    forgiven: "Week 4 was one dinner. Nothing reset.",
    pod: "Weeknight cooks",
    question: "What meal makes you feel looked after?",
  },
];

const KEY = "kx_journey";

/** A different story from the one this browser saw last time. */
export function pickScenario(): number {
  let last = -1;
  try {
    last = Number(localStorage.getItem(KEY) ?? -1);
  } catch {
    /* private mode: any story will do */
  }
  let next = Math.floor(Math.random() * SCENARIOS.length);
  if (next === last) next = (next + 1) % SCENARIOS.length;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    /* nothing to remember it in */
  }
  return next;
}
