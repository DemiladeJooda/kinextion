import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-admin-tests";
process.env.ADMIN_USER_IDS = "clerk_admin, clerk_other_admin";

let clerkId = "clerk_admin";
vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: clerkId }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [{ emailAddress: "t@example.com" }] }) } },
}));
vi.mock("@kinextion/database", () => {
  const user = { id: "user_1", clerkId: "clerk_admin", email: "t@example.com" };
  return { Prisma: { DbNull: null }, prisma: { user: { findUnique: async () => user, create: async () => user } } };
});
vi.mock("../src/lib/habit-metrics.js", () => ({
  loadHabitMetrics: async (days: number) => ({ window: { days }, users: 3 }),
}));

const { buildApp } = await import("../src/server.js");
let app: Awaited<ReturnType<typeof buildApp>>["app"];
beforeAll(async () => {
  ({ app } = await buildApp());
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("GET /api/admin/metrics", () => {
  it("answers listed admins, with the window clamped", async () => {
    clerkId = "clerk_admin";
    const res = await app.inject({ method: "GET", url: "/api/admin/metrics?days=2" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ window: { days: 7 }, users: 3 });
  });

  it("is a plain 404 for everyone else", async () => {
    clerkId = "clerk_someone";
    const res = await app.inject({ method: "GET", url: "/api/admin/metrics" });
    expect(res.statusCode).toBe(404);
  });
});
