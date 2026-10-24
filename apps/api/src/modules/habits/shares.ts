/**
 * Building a habit alongside your community.
 *
 * Progress that others can see is followed through more often (Harkin et
 * al. 2016), and Zoe Chance's view is that lasting influence is a group
 * effort. So a member can share a habit with a community they belong to,
 * and the others see the habit and which days this week it happened.
 *
 * Deliberately not a leaderboard: no streak counts, no totals, no ranking.
 * Just who's building what, and a week of dots. Sharing is opt-in per
 * habit per community, and leaving a community hides your shares there.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@kinextion/database";
import { addDays, dateFromKey, dateKeyOf, describeHabitPlan, displayFields, weekStartKey } from "@kinextion/shared";

export type WeekDot = "done" | "minimum" | "rest" | "none" | "future";

const isMember = async (userId: string, communityId: string) =>
  Boolean(await prisma.communityMembership.findFirst({ where: { userId, communityId, leftAt: null } }));

export function registerShareRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/:id/shares", async (request, reply) => {
    const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
    if (!habit || habit.userId !== request.userId) return reply.status(404).send({ success: false, error: "Habit not found" });
    const shares = await prisma.habitShare.findMany({ where: { habitId: habit.id }, select: { communityId: true } });
    return { success: true, data: shares.map((s) => s.communityId) };
  });

  app.post<{ Params: { id: string } }>("/:id/share", async (request, reply) => {
    const parsed = z.object({ communityId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Pick a community." });
    const habit = await prisma.habit.findUnique({ where: { id: request.params.id } });
    if (!habit || habit.userId !== request.userId) return reply.status(404).send({ success: false, error: "Habit not found" });
    if (!(await isMember(request.userId, parsed.data.communityId))) {
      return reply.status(403).send({ success: false, error: "You're not in that community." });
    }
    await prisma.habitShare.upsert({
      where: { habitId_communityId: { habitId: habit.id, communityId: parsed.data.communityId } },
      create: { habitId: habit.id, userId: request.userId, communityId: parsed.data.communityId },
      update: {},
    });
    request.log.info({ event: "habit_shared" }, "habit event");
    return { success: true, data: { shared: true } };
  });

  app.delete<{ Params: { id: string; communityId: string } }>("/:id/share/:communityId", async (request) => {
    await prisma.habitShare.deleteMany({
      where: { habitId: request.params.id, communityId: request.params.communityId, userId: request.userId },
    });
    return { success: true, data: { shared: false } };
  });

  /** What members of a community are building together this week. Members only. */
  app.get<{ Params: { communityId: string } }>("/shared/:communityId", async (request, reply) => {
    const { communityId } = request.params;
    if (!(await isMember(request.userId, communityId))) {
      return reply.status(403).send({ success: false, error: "You're not in that community." });
    }
    const today = request.localToday();
    const weekStart = weekStartKey(today);
    const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const shares = await prisma.habitShare.findMany({
      where: { communityId, habit: { isActive: true } },
      include: { habit: true, user: { include: { profile: { select: { displayName: true } } } } },
    });
    const members = await prisma.communityMembership.findMany({
      where: { communityId, leftAt: null },
      select: { userId: true },
    });
    const current = new Set(members.map((m) => m.userId));
    const visible = shares.filter((s) => current.has(s.userId));

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId: { in: visible.map((s) => s.habitId) },
        date: { gte: dateFromKey(week[0]), lte: dateFromKey(week[6]) },
      },
      select: { habitId: true, date: true, completed: true, state: true },
    });
    const byHabit = new Map<string, Map<string, WeekDot>>();
    for (const l of logs) {
      const dot: WeekDot = l.state === "rest" ? "rest" : !l.completed ? "none" : l.state === "minimum" ? "minimum" : "done";
      const m = byHabit.get(l.habitId) ?? new Map<string, WeekDot>();
      m.set(dateKeyOf(l.date), dot);
      byHabit.set(l.habitId, m);
    }

    const rows = visible.map((s) => {
      const shown = displayFields(s.habit);
      return {
        habitId: s.habitId,
        mine: s.userId === request.userId,
        member: s.user.profile?.displayName ?? "A member",
        habit: s.habit.name,
        plan: describeHabitPlan({ name: s.habit.name, cue: shown.cue, response: shown.response }).plan,
        paused: s.habit.status === "paused",
        week: week.map((d) => (d > today ? "future" : (byHabit.get(s.habitId)?.get(d) ?? "none"))) as WeekDot[],
      };
    });
    // Your own first, then everyone else by name. Never by how well it's going.
    rows.sort((a, b) => Number(b.mine) - Number(a.mine) || a.member.localeCompare(b.member) || a.habit.localeCompare(b.habit));
    return { success: true, data: { weekStart, rows } };
  });
}
