/**
 * Apple Health / Health Connect: the app reads daily totals on the phone and
 * posts them. Only the last week is accepted, only once connected, and the
 * totals feed the same auto-logging as any other source.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-device-health";

const integrations: Record<string, any>[] = [];
const metrics: Record<string, any>[] = [];
const autoLog = vi.fn(async () => [{ habitId: "h1", habitName: "Walk", date: "2026-10-24", state: "done", detail: "Apple Health: 9,000 steps" }]);

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));
vi.mock("../src/lib/auto-log.js", () => ({ autoLogFromMetrics: (...a: unknown[]) => autoLog(...(a as [])) }));
vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_1", email: "t@example.com" };
  return {
    Prisma: { DbNull: null },
    prisma: {
      user: { findUnique: async () => user, create: async () => user },
      integration: {
        findUnique: async ({ where }: any) =>
          integrations.find((i) => i.userId === where.userId_provider.userId && i.provider === where.userId_provider.provider) ?? null,
        upsert: async ({ where, create, update }: any) => {
          const found = integrations.find((i) => i.provider === where.userId_provider.provider);
          if (found) return Object.assign(found, update);
          const row = { id: `i${integrations.length + 1}`, ...create };
          integrations.push(row);
          return row;
        },
        update: async ({ where, data }: any) => Object.assign(integrations.find((i) => i.id === where.id)!, data),
      },
      wearableMetric: {
        upsert: async ({ create }: any) => {
          metrics.push(create);
          return create;
        },
      },
    },
  };
});

const { buildApp } = await import("../src/server.js");
let app: Awaited<ReturnType<typeof buildApp>>["app"];
beforeAll(async () => {
  ({ app } = await buildApp());
  await app.ready();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  integrations.length = 0;
  metrics.length = 0;
  autoLog.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00Z"));
});

const TZ = { "x-time-zone": "America/Chicago" };
const ingest = (days: unknown[]) =>
  app.inject({ method: "POST", url: "/api/integrations/device/apple_health/ingest", headers: TZ, payload: { days } });

describe("phone health data", () => {
  it("needs connecting first", async () => {
    expect((await ingest([{ date: "2026-10-24", steps: 9000 }])).statusCode).toBe(404);
  });

  it("stores the last week's daily totals and auto-logs from them", async () => {
    await app.inject({ method: "POST", url: "/api/integrations/device/apple_health/connect" });
    const res = await ingest([
      { date: "2026-10-24", steps: 9000, workoutMinutes: 32.4 },
      { date: "2026-10-01", steps: 12000 }, // too old: ignored
    ]);
    expect(res.statusCode).toBe(200);
    expect(metrics.map((m) => [m.metricType, m.value])).toEqual([
      ["steps", 9000],
      ["workout", 32],
    ]);
    expect(autoLog).toHaveBeenCalledWith("user_1", "America/Chicago", "apple_health", expect.any(Array));
    expect(res.json().data.autoLogged[0].detail).toBe("Apple Health: 9,000 steps");
  });

  it("only knows the two phone sources", async () => {
    const res = await app.inject({ method: "POST", url: "/api/integrations/device/fitbit/connect" });
    expect(res.statusCode).toBe(404);
  });
});
