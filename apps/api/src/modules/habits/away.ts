/**
 * Away: travel, illness, a new baby, a move.
 *
 * Routines shift when life does, and the cue a habit hung on ("after I pour
 * my coffee") may simply not exist in a hotel room (Verplanken & Wood 2006).
 * Going away pauses the chosen habits in one step, so nothing counts as
 * missed. Coming back restarts exactly those, turns the away days into
 * neutral rest days (the same rule as a single habit's pause), and returns
 * them so the app can ask whether each cue still fits the new routine.
 *
 * Used by the routes here and by the guides ("I'm in Lagos all next week").
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";
import {
  dateFromKey,
  dateKeyOf,
  describeHabitPlan,
  displayFields,
  startAwaySchema,
  type DateKey,
  type StartAwayInput,
} from "@kinextion/shared";
import { statusSideEffects } from "../../lib/habit-status.js";

interface PausedHabit {
  id: string;
  status: string;
}

export interface AwayView {
  id: string;
  reason: string;
  startsOn: string;
  endsOn: string | null;
  habits: { id: string; name: string }[];
}

export interface Restarted {
  id: string;
  name: string;
  cue: string | null;
  plan: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const currentAway = (userId: string) =>
  prisma.awayPeriod.findFirst({ where: { userId, endedAt: null }, orderBy: { createdAt: "desc" } });

async function view(away: NonNullable<Awaited<ReturnType<typeof currentAway>>>): Promise<AwayView> {
  const ids = (away.habits as unknown as PausedHabit[]).map((h) => h.id);
  const habits = await prisma.habit.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return {
    id: away.id,
    reason: away.reason,
    startsOn: dateKeyOf(away.startsOn),
    endsOn: away.endsOn ? dateKeyOf(away.endsOn) : null,
    habits,
  };
}

export async function getAway(userId: string): Promise<AwayView | null> {
  const away = await currentAway(userId);
  return away ? view(away) : null;
}

export async function startAway(userId: string, today: DateKey, input: StartAwayInput): Promise<Result<AwayView>> {
  if (await currentAway(userId)) return { ok: false, status: 409, error: "You're already set as away." };
  const { reason, until, habitIds } = input;
  if (until && until < today) return { ok: false, status: 400, error: "That date has already passed." };

  // Habits they paused themselves stay theirs; away only touches the rest.
  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true, status: { not: "paused" }, ...(habitIds ? { id: { in: habitIds } } : {}) },
  });
  const paused: PausedHabit[] = [];
  for (const h of habits) {
    // Record what it was before pausing; coming back restores this.
    paused.push({ id: h.id, status: h.status });
    const extra = await statusSideEffects(h, "paused", today);
    await prisma.habit.update({ where: { id: h.id }, data: { status: "paused", ...extra } });
  }

  const away = await prisma.awayPeriod.create({
    data: {
      userId,
      startsOn: dateFromKey(today),
      endsOn: until ? dateFromKey(until) : null,
      reason,
      habits: paused as unknown as object[],
    },
  });
  return { ok: true, data: await view(away) };
}

export async function endAway(userId: string, today: DateKey): Promise<Result<{ restarted: Restarted[] }>> {
  const away = await currentAway(userId);
  if (!away) return { ok: false, status: 404, error: "You're not set as away." };

  const restarted: Restarted[] = [];
  for (const r of away.habits as unknown as PausedHabit[]) {
    const h = await prisma.habit.findUnique({ where: { id: r.id } });
    // Restarted by hand while away, archived, or someone else's: leave it.
    if (!h || h.userId !== userId || !h.isActive || h.status !== "paused") continue;
    const back = r.status === "established" ? "established" : "building";
    const extra = await statusSideEffects(h, back, today);
    const updated = await prisma.habit.update({ where: { id: h.id }, data: { status: back, ...extra } });
    const shown = displayFields(updated);
    restarted.push({
      id: updated.id,
      name: updated.name,
      cue: shown.cue ?? null,
      plan: describeHabitPlan({ name: updated.name, cue: shown.cue, response: shown.response }).plan,
    });
  }

  await prisma.awayPeriod.update({ where: { id: away.id }, data: { endedAt: new Date() } });
  return { ok: true, data: { restarted } };
}

export function registerAwayRoutes(app: FastifyInstance) {
  app.get("/away", async (request) => ({ success: true, data: await getAway(request.userId) }));

  app.post("/away", async (request, reply) => {
    const parsed = startAwaySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues.map((i) => i.message).join(", ") });
    }
    const result = await startAway(request.userId, request.localToday(), parsed.data);
    if (!result.ok) return reply.status(result.status).send({ success: false, error: result.error });
    request.log.info(
      { event: "away_started", reason: parsed.data.reason, habits: result.data.habits.length, hasEnd: Boolean(parsed.data.until) },
      "habit event"
    );
    return reply.status(201).send({ success: true, data: result.data });
  });

  /** Back: restart what away paused, and hand back each habit's plan to re-check. */
  app.post("/away/end", async (request, reply) => {
    const result = await endAway(request.userId, request.localToday());
    if (!result.ok) return reply.status(result.status).send({ success: false, error: result.error });
    request.log.info({ event: "away_ended", restarted: result.data.restarted.length }, "habit event");
    return { success: true, data: result.data };
  });
}
