/**
 * Saving today's check-in, shared by the check-in route and the guides.
 *
 * One check-in per day: a second save edits the first. Only the fields
 * given are written — a field left out is left alone, a field sent as null
 * is cleared — so a mood tapped in the morning, a journal written tonight,
 * and "I'm feeling pretty good" said to Kairo all land on the same day's
 * entry without wiping each other out.
 */

import { prisma, type Prisma } from "@kinextion/database";
import type { CheckInInput } from "@kinextion/shared";
import { startOfToday } from "../../lib/score.js";

export async function saveCheckIn(userId: string, timeZone: string, body: CheckInInput) {
  const existing = await prisma.moodEntry.findFirst({
    where: { userId, createdAt: { gte: startOfToday(timeZone) } },
    orderBy: { createdAt: "desc" },
  });

  const data: Record<string, unknown> = { mood: body.mood };
  if ("energy" in body) data.energy = body.energy ?? null;
  if ("stress" in body) data.stress = body.stress ?? null;
  if ("journal" in body) data.journal = body.journal ?? null;
  if ("gratitude" in body) data.gratitude = body.gratitude ?? null;
  if ("tags" in body) data.tags = (body.tags ?? []) as Prisma.InputJsonValue;

  const entry = existing
    ? await prisma.moodEntry.update({
        where: { id: existing.id },
        data: data as Prisma.MoodEntryUpdateInput,
      })
    : await prisma.moodEntry.create({
        data: { userId, ...data } as unknown as Prisma.MoodEntryUncheckedCreateInput,
      });

  return { entry, existing: Boolean(existing) };
}
