import { Prisma } from "@kinextion/database";

/**
 * Habit input as Prisma wants it. Json columns can't take a plain null —
 * "turn auto-logging off" has to be written as Prisma.DbNull.
 */
export function habitData<T extends { autoLog?: unknown }>(
  data: T
): Omit<T, "autoLog"> & { autoLog?: Prisma.InputJsonValue | typeof Prisma.DbNull } {
  const { autoLog, ...rest } = data;
  if (autoLog === undefined) return rest;
  return { ...rest, autoLog: autoLog === null ? Prisma.DbNull : (autoLog as Prisma.InputJsonValue) };
}
