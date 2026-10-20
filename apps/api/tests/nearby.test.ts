/**
 * Nearby groups — the real-world discovery directory.
 *
 * Worth pinning: the city/category filters, and that distance is sorted and
 * computed only when the client sends coordinates (it's optional, not required).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-nearby-tests";

import { vi } from "vitest";

const user = { id: "user_1", clerkId: "clerk_1", email: "test@example.com" };

// Dallas and one Austin row, so the city filter has something to prove.
const GROUPS = [
  {
    id: "g1",
    name: "214 Run Club",
    category: "running",
    description: "Free Saturday runs.",
    address: "4825 Cole Ave, Dallas, TX",
    city: "Dallas",
    lat: 32.826576,
    lng: -96.7870713,
    website: null,
    phone: null,
    schedule: "Saturdays",
    isFree: true,
    sourceUrl: "https://example.com",
    verifiedAt: new Date("2026-10-06"),
  },
  {
    id: "g2",
    name: "CorePower Yoga – Victory Park",
    category: "yoga",
    description: "Heated yoga.",
    address: "1700 Cedar Springs Rd, Dallas, TX",
    city: "Dallas",
    lat: 32.788817,
    lng: -96.805545,
    website: null,
    phone: null,
    schedule: "Varies",
    isFree: false,
    sourceUrl: "https://example.com",
    verifiedAt: new Date("2026-10-06"),
  },
  {
    id: "g3",
    name: "Some Austin Studio",
    category: "yoga",
    description: "Not Dallas.",
    address: "1 Congress Ave, Austin, TX",
    city: "Austin",
    lat: 30.2672,
    lng: -97.7431,
    website: null,
    phone: null,
    schedule: "Varies",
    isFree: false,
    sourceUrl: "https://example.com",
    verifiedAt: new Date("2026-10-06"),
  },
];

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: "clerk_1" }),
  clerkClient: { users: { getUser: async () => ({ primaryEmailAddress: { emailAddress: "test@example.com" } }) } },
}));

vi.mock("@kinextion/database", () => ({
  Prisma: { DbNull: null },
  prisma: {
    user: { findUnique: async () => user, create: async () => user },
    nearbyGroup: {
      findMany: async ({ where }: { where: { city: string; category?: string } }) =>
        GROUPS.filter(
          (g) => g.city === where.city && (!where.category || g.category === where.category)
        ),
    },
  },
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

const getGroups = (query: string) => app.inject({ method: "GET", url: `/api/nearby/groups${query}` });

describe("GET /api/nearby/groups", () => {
  it("defaults to Dallas and excludes other cities", async () => {
    const res = await getGroups("");
    expect(res.statusCode).toBe(200);
    const names = res.json().data.map((g: { name: string }) => g.name);
    expect(names).toContain("214 Run Club");
    expect(names).not.toContain("Some Austin Studio");
  });

  it("filters by category", async () => {
    const res = await getGroups("?category=yoga");
    const names = res.json().data.map((g: { name: string }) => g.name);
    expect(names).toEqual(["CorePower Yoga – Victory Park"]);
  });

  it("leaves distance null without coordinates", async () => {
    const res = await getGroups("");
    for (const g of res.json().data) {
      expect(g.distanceKm).toBeNull();
    }
  });

  it("computes and sorts by distance once coordinates are given", async () => {
    // Closer to the run club (4825 Cole Ave) than to CorePower.
    const res = await getGroups("?lat=32.8265&lng=-96.787");
    const data = res.json().data;
    expect(data[0].name).toBe("214 Run Club");
    expect(typeof data[0].distanceKm).toBe("number");
    expect(data[0].distanceKm).toBeLessThan(data[1].distanceKm);
  });
});
