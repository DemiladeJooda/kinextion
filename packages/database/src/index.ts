// `Prisma` is a value as well as a namespace — `Prisma.DbNull` and the other
// JSON-null sentinels are needed at runtime, so it can't be a type-only export.
export { PrismaClient, Prisma } from "@prisma/client";
export type * from "@prisma/client";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
