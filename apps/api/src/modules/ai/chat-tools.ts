/**
 * What the guides can do in the app, not just say.
 *
 * Asked "make me a habit for this" in chat, Altheo and Kairo used to reply
 * with a description and nothing else. These tools let them act: create or
 * change a habit, log one, save a check-in, make tomorrow's promise, note
 * something worth remembering. Every action:
 *
 *   - goes through the same rules as the app's own buttons (logHabitDay,
 *     saveCheckIn, changeToUpdate, statusSideEffects), so a guide can't do
 *     anything a tap couldn't;
 *   - is validated with Zod before it runs — the model's input is a request,
 *     not a command;
 *   - comes back to the app as a card with Undo, so nothing a guide does is
 *     silent or permanent.
 *
 * Whatever matters from a conversation ends up as real app data — a habit,
 * a log, a check-in, a fact — rather than in a stored transcript.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { prisma, type Prisma } from "@kinextion/database";
import {
  addDays,
  changeToUpdate,
  createHabitSchema,
  dateFromKey,
  describeChange,
  describeHabitPlan,
  displayFields,
  habitChangeSchema,
  habitTimeWindowSchema,
  localDateKey,
  nextMondayKey,
  wellnessCategorySchema,
} from "@kinextion/shared";
import { logHabitDay } from "../habits/log-day.js";
import { schedulePolish } from "../habits/polish.js";
import { saveCheckIn } from "../checkin/save.js";
import { statusSideEffects } from "../../lib/habit-status.js";
import { upsertFacts } from "../../lib/memory/store.js";
import { toStructuredSchema } from "./services/ai-service.js";

/** Habits a guide may create in one reply — three being built is plenty. */
const MAX_CREATES_PER_TURN = 3;

// ─── Undo ─────────────────────────────────────────────────────────────────────

export const undoSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("archive_habit"), habitId: z.string() }),
  z.object({
    kind: z.literal("restore_habit"),
    habitId: z.string(),
    previous: z.record(z.unknown()),
  }),
  z.object({
    kind: z.literal("restore_log"),
    habitId: z.string(),
    date: z.string().date(),
    previous: z.object({ completed: z.boolean(), state: z.string() }).nullable(),
  }),
  z.object({ kind: z.literal("drop_promise"), habitId: z.string(), forDate: z.string().date() }),
  z.object({ kind: z.literal("forget_fact"), factId: z.string() }),
]);

export type UndoSpec = z.infer<typeof undoSpecSchema>;

export interface ChatAction {
  kind: "habit_created" | "habit_changed" | "habit_logged" | "checkin_saved" | "promise_made" | "remembered";
  title: string;
  detail?: string;
  /** Absent when an action can't be undone from the card (a check-in, which
   *  is edited on its own screen instead). */
  undo?: UndoSpec;
}

// ─── Tool inputs ──────────────────────────────────────────────────────────────

const createInput = z.object({
  name: z.string().trim().min(1).max(100),
  category: wellnessCategorySchema,
  anchor: z.string().trim().min(1).max(200),
  tiny_version: z.string().trim().min(1).max(200),
  usual_version: z.string().trim().max(200).optional(),
  why: z.string().trim().max(200).optional(),
  frequency: z.enum(["daily", "weekly", "custom"]),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  times_per_week: z.number().int().min(1).max(7).optional(),
  part_of_day: habitTimeWindowSchema,
  start: z.enum(["today", "monday"]).optional(),
});

const changeInput = z.object({ habit_id: z.string(), change: habitChangeSchema });

const logInput = z.object({
  habit_id: z.string(),
  how: z.enum(["done", "tiny", "rest"]),
  day: z.enum(["today", "yesterday"]).default("today"),
});

const checkInInput = z.object({
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10).optional(),
  stress: z.number().int().min(1).max(10).optional(),
});

const promiseInput = z.object({ habit_ids: z.array(z.string()).min(1).max(3) });

const rememberInput = z.object({
  fact: z.string().trim().min(3).max(200),
  kind: z.enum(["constraint", "identity", "goal", "preference", "context"]),
  lasting: z.boolean(),
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

function tool(name: string, description: string, schema: Record<string, unknown>): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    input_schema: toStructuredSchema(schema) as Anthropic.Beta.BetaTool.InputSchema,
    // Inputs stream as they're written; they're validated with Zod before
    // anything runs, so a truncated input is an error, never an action.
    eager_input_streaming: true,
  };
}

const CHANGE_SCHEMA = {
  type: "object",
  description: "Exactly one change.",
  properties: {
    type: { type: "string", enum: ["shrink", "move", "schedule", "pause", "none"] },
    response: { type: "string", description: "For shrink: the new tiny version." },
    cue: { type: "string", description: "For move: the new anchor, 'After I …'." },
    timeWindow: { type: "string", enum: ["morning", "midday", "evening", "anytime"] },
    frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
    targetDays: { type: "array", items: { type: "integer" }, description: "For custom: weekdays, 0 = Sunday." },
    perWeekTarget: { type: "integer", description: "For weekly: times a week." },
  },
  required: ["type"],
};

export const CHAT_TOOLS: Anthropic.Beta.BetaTool[] = [
  tool(
    "create_habit",
    "Add a habit to their Today list. Use when they ask you to set one up, or agree to one you offered. Always give it an anchor and a tiny version.",
    {
      type: "object",
      properties: {
        name: { type: "string", description: "What they do, under 6 words." },
        category: { type: "string", enum: ["physical", "mental", "emotional", "spiritual"] },
        anchor: { type: "string", description: "An existing moment in their day: 'After I …' or 'When I …'." },
        tiny_version: { type: "string", description: "The bad-day version that still counts, e.g. '5 push-ups on your knees'." },
        usual_version: { type: "string", description: "The normal version, e.g. '10 push-ups'." },
        why: { type: "string", description: "Why it matters to them, in their words, if they said." },
        frequency: { type: "string", enum: ["daily", "weekly", "custom"], description: "weekly = a number of times a week; custom = certain weekdays." },
        days: { type: "array", items: { type: "integer" }, description: "For custom: weekdays, 0 = Sunday." },
        times_per_week: { type: "integer", description: "For weekly." },
        part_of_day: { type: "string", enum: ["morning", "midday", "evening", "anytime"] },
        start: { type: "string", enum: ["today", "monday"], description: "Default today." },
      },
      required: ["name", "category", "anchor", "tiny_version", "frequency", "part_of_day"],
    }
  ),
  tool(
    "change_habit",
    "Change one of their existing habits: make the tiny version smaller, move it to a different moment or part of the day, change the days, or pause it. Use when they ask, or agree to a change you offered.",
    {
      type: "object",
      properties: { habit_id: { type: "string" }, change: CHANGE_SCHEMA },
      required: ["habit_id", "change"],
    }
  ),
  tool(
    "log_habit",
    "Mark a habit for today (or yesterday, before noon). Use when they tell you they did it ('done'), did the tiny version ('tiny'), or are taking a planned rest day ('rest').",
    {
      type: "object",
      properties: {
        habit_id: { type: "string" },
        how: { type: "string", enum: ["done", "tiny", "rest"] },
        day: { type: "string", enum: ["today", "yesterday"] },
      },
      required: ["habit_id", "how"],
    }
  ),
  tool(
    "save_check_in",
    "Save how they're feeling today, 1–10, when they tell you plainly (e.g. 'honestly about a 4 today'). Don't guess a number they didn't give.",
    {
      type: "object",
      properties: {
        mood: { type: "integer", description: "1 = awful, 10 = great." },
        energy: { type: "integer", description: "1–10, only if they said." },
        stress: { type: "integer", description: "1–10, only if they said." },
      },
      required: ["mood"],
    }
  ),
  tool(
    "promise_tomorrow",
    "Record what they're committing to do tomorrow, when they say so. Their morning reminder will quote it back.",
    {
      type: "object",
      properties: { habit_ids: { type: "array", items: { type: "string" } } },
      required: ["habit_ids"],
    }
  ),
  tool(
    "remember",
    "Note one thing worth keeping beyond this conversation: an injury, a schedule, a goal, a preference. One line, in third person. Not for passing moods or anything the app already tracks.",
    {
      type: "object",
      properties: {
        fact: { type: "string" },
        kind: { type: "string", enum: ["constraint", "identity", "goal", "preference", "context"] },
        lasting: { type: "boolean", description: "True if it should be kept indefinitely (an injury, a value)." },
      },
      required: ["fact", "kind", "lasting"],
    }
  ),
];

/** Added to the guides' system prompt whenever tools are offered. */
export const CHAT_ACTIONS_PROMPT = [
  "## Acting in the app",
  "You can act on what they say, not only reply: create or change a habit, log one, save a check-in, record tomorrow's promise, remember something. Habit ids are in 'Their Habits'.",
  "- When they ask you to do something, do it — don't describe it and leave them to do it themselves.",
  "- For anything they didn't ask for, offer first and act once they agree.",
  "- Keep habits small: an anchor to an existing moment and a tiny version that still counts on a bad day.",
  `- Create at most ${MAX_CREATES_PER_TURN} habits at a time. If they're already building three, say so kindly and offer to shrink one instead.`,
  "- After acting, say in one short sentence what you did. The app shows a card with Undo, so don't ask them to confirm again.",
  "- If an action fails, the result says why; tell them plainly and offer what you can do instead.",
].join("\n");

// ─── Running a tool ───────────────────────────────────────────────────────────

export interface ToolContext {
  userId: string;
  timeZone: string;
  log: FastifyBaseLogger;
  /** Habits created so far this turn. */
  created: number;
}

export interface ToolOutcome {
  /** What the model is told. */
  result: string;
  isError?: boolean;
  action?: ChatAction;
}

function fail(result: string): ToolOutcome {
  return { result, isError: true };
}

async function ownedHabit(userId: string, habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  return habit && habit.userId === userId && habit.isActive ? habit : null;
}

export async function runChatTool(name: string, raw: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const today = localDateKey(new Date(), ctx.timeZone);

  switch (name) {
    case "create_habit": {
      const p = createInput.safeParse(raw);
      if (!p.success) return fail(`Invalid habit: ${p.error.issues.map((i) => i.message).join(", ")}`);
      if (ctx.created >= MAX_CREATES_PER_TURN) return fail("That's enough new habits for one go.");
      const i = p.data;
      const input = createHabitSchema.safeParse({
        name: i.name,
        category: i.category,
        cue: i.anchor,
        response: i.tiny_version,
        fullVersion: i.usual_version,
        craving: i.why,
        frequency: i.frequency,
        targetDays: i.frequency === "custom" ? i.days : undefined,
        perWeekTarget: i.frequency === "weekly" ? (i.times_per_week ?? 1) : undefined,
        timeWindow: i.part_of_day,
      });
      if (!input.success) return fail(`Invalid habit: ${input.error.issues.map((x) => x.message).join(", ")}`);
      if (input.data.frequency === "custom" && !input.data.targetDays?.length) {
        return fail("A certain-days habit needs at least one day.");
      }
      const monday = nextMondayKey(today);
      const habit = await prisma.habit.create({
        data: {
          userId: ctx.userId,
          ...input.data,
          startsOn: i.start === "monday" && monday !== today ? dateFromKey(monday) : null,
        },
      });
      ctx.created++;
      schedulePolish(ctx.log, habit.id, ctx.userId);
      const plan = describeHabitPlan({ name: habit.name, cue: habit.cue, response: habit.response }).plan;
      return {
        result: `Created "${habit.name}" (id ${habit.id}). It's on their Today list${i.start === "monday" ? " from Monday" : ""}.`,
        action: {
          kind: "habit_created",
          title: `Added: ${habit.name}`,
          detail: plan,
          undo: { kind: "archive_habit", habitId: habit.id },
        },
      };
    }

    case "change_habit": {
      const p = changeInput.safeParse(raw);
      if (!p.success) return fail(`Invalid change: ${p.error.issues.map((i) => i.message).join(", ")}`);
      const habit = await ownedHabit(ctx.userId, p.data.habit_id);
      if (!habit) return fail("No such habit. Use an id from 'Their Habits'.");
      const update = changeToUpdate(p.data.change);
      if (!update) return { result: "Nothing to change." };

      const previous = Object.fromEntries(
        Object.keys(update).map((k) => [k, (habit as Record<string, unknown>)[k] ?? null])
      );
      const extra = await statusSideEffects(habit, update.status, today);
      await prisma.habit.updateMany({
        where: { id: habit.id, userId: ctx.userId },
        data: { ...update, ...extra } as Prisma.HabitUpdateManyMutationInput,
      });
      schedulePolish(ctx.log, habit.id, ctx.userId);
      return {
        result: `Changed "${habit.name}": ${describeChange(p.data.change)}.`,
        action: {
          kind: "habit_changed",
          title: `${habit.name}: ${describeChange(p.data.change)}`,
          undo: { kind: "restore_habit", habitId: habit.id, previous },
        },
      };
    }

    case "log_habit": {
      const p = logInput.safeParse(raw);
      if (!p.success) return fail(`Invalid log: ${p.error.issues.map((i) => i.message).join(", ")}`);
      const date = p.data.day === "yesterday" ? addDays(today, -1) : today;
      const before = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId: p.data.habit_id, date: dateFromKey(date) } },
      });
      const state = p.data.how === "tiny" ? "minimum" : p.data.how;
      const result = await logHabitDay({
        userId: ctx.userId,
        timeZone: ctx.timeZone,
        habitId: p.data.habit_id,
        date,
        state,
        completed: state !== "rest",
        source: "chat",
      });
      if (!result.ok) return fail(result.error);
      const label = state === "minimum" ? "tiny version" : state === "rest" ? "rest day" : "done";
      return {
        result: `Logged "${result.habitName}" as ${label} for ${p.data.day}.`,
        action: {
          kind: "habit_logged",
          title: `${result.habitName}: ${label}${p.data.day === "yesterday" ? " (yesterday)" : ""}`,
          undo: {
            kind: "restore_log",
            habitId: p.data.habit_id,
            date,
            previous: before ? { completed: before.completed, state: before.state } : null,
          },
        },
      };
    }

    case "save_check_in": {
      const p = checkInInput.safeParse(raw);
      if (!p.success) return fail(`Invalid check-in: ${p.error.issues.map((i) => i.message).join(", ")}`);
      await saveCheckIn(ctx.userId, ctx.timeZone, p.data);
      const parts = [`mood ${p.data.mood}/10`];
      if (p.data.energy) parts.push(`energy ${p.data.energy}/10`);
      if (p.data.stress) parts.push(`stress ${p.data.stress}/10`);
      return {
        result: `Saved today's check-in: ${parts.join(", ")}.`,
        action: { kind: "checkin_saved", title: "Check-in saved", detail: `${parts.join(" · ")}. Edit it in Check-in.` },
      };
    }

    case "promise_tomorrow": {
      const p = promiseInput.safeParse(raw);
      if (!p.success) return fail(`Invalid promise: ${p.error.issues.map((i) => i.message).join(", ")}`);
      const tomorrow = addDays(today, 1);
      const names: string[] = [];
      let undo: UndoSpec | undefined;
      for (const id of p.data.habit_ids) {
        const habit = await ownedHabit(ctx.userId, id);
        if (!habit) continue;
        const shown = displayFields(habit);
        const text = describeHabitPlan({ name: habit.name, cue: shown.cue, response: shown.response }).plan;
        await prisma.precommitment.upsert({
          where: { habitId_forDate: { habitId: habit.id, forDate: dateFromKey(tomorrow) } },
          create: { userId: ctx.userId, habitId: habit.id, forDate: dateFromKey(tomorrow), text },
          update: { text },
        });
        names.push(habit.name);
        undo ??= { kind: "drop_promise", habitId: habit.id, forDate: tomorrow };
      }
      if (!names.length) return fail("No such habits. Use ids from 'Their Habits'.");
      return {
        result: `Recorded tomorrow's promise: ${names.join(", ")}.`,
        action: {
          kind: "promise_made",
          title: `Promised for tomorrow: ${names.join(", ")}`,
          detail: "Your morning reminder will say it back to you.",
          // One promise per card can be undone; several are rare and each
          // can be changed tomorrow evening.
          undo: names.length === 1 ? undo : undefined,
        },
      };
    }

    case "remember": {
      const p = rememberInput.safeParse(raw);
      if (!p.success) return fail(`Invalid note: ${p.error.issues.map((i) => i.message).join(", ")}`);
      const slug = p.data.fact.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40).replace(/^_|_$/g, "");
      const key = `${p.data.kind}:${slug}`;
      await upsertFacts(ctx.userId, [
        { tier: p.data.lasting ? "core" : "pattern", category: p.data.kind, key, content: p.data.fact, confidence: 0.9 },
      ]);
      const fact = await prisma.memoryFact.findUnique({ where: { userId_key: { userId: ctx.userId, key } } });
      return {
        result: "Noted.",
        action: {
          kind: "remembered",
          title: "Remembered",
          detail: p.data.fact,
          undo: fact ? { kind: "forget_fact", factId: fact.id } : undefined,
        },
      };
    }

    default:
      return fail(`Unknown tool ${name}.`);
  }
}

// ─── Undo ─────────────────────────────────────────────────────────────────────

const RESTORABLE = new Set([
  "response",
  "cue",
  "timeWindow",
  "frequency",
  "targetDays",
  "perWeekTarget",
  "status",
]);

/** Reverse an action from its card. Everything is scoped to the user. */
export async function undoChatAction(
  userId: string,
  timeZone: string,
  undo: UndoSpec,
  log: FastifyBaseLogger
): Promise<boolean> {
  switch (undo.kind) {
    case "archive_habit": {
      const r = await prisma.habit.updateMany({ where: { id: undo.habitId, userId }, data: { isActive: false } });
      return r.count > 0;
    }
    case "restore_habit": {
      const habit = await prisma.habit.findUnique({ where: { id: undo.habitId } });
      if (!habit || habit.userId !== userId) return false;
      const previous = Object.fromEntries(Object.entries(undo.previous).filter(([k]) => RESTORABLE.has(k)));
      const extra = await statusSideEffects(
        habit,
        typeof previous.status === "string" ? previous.status : undefined,
        localDateKey(new Date(), timeZone)
      );
      const r = await prisma.habit.updateMany({
        where: { id: undo.habitId, userId },
        data: { ...previous, ...extra } as Prisma.HabitUpdateManyMutationInput,
      });
      if (r.count) schedulePolish(log, undo.habitId, userId);
      return r.count > 0;
    }
    case "restore_log": {
      const habit = await prisma.habit.findUnique({ where: { id: undo.habitId } });
      if (!habit || habit.userId !== userId) return false;
      const date = dateFromKey(undo.date);
      if (undo.previous) {
        await prisma.habitLog.update({
          where: { habitId_date: { habitId: undo.habitId, date } },
          data: { completed: undo.previous.completed, state: undo.previous.state },
        });
      } else {
        await prisma.habitLog.deleteMany({ where: { habitId: undo.habitId, userId, date } });
      }
      return true;
    }
    case "drop_promise": {
      const r = await prisma.precommitment.deleteMany({
        where: { habitId: undo.habitId, userId, forDate: dateFromKey(undo.forDate) },
      });
      return r.count > 0;
    }
    case "forget_fact": {
      const r = await prisma.memoryFact.deleteMany({ where: { id: undo.factId, userId } });
      return r.count > 0;
    }
  }
}
