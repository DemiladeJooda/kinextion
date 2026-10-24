/**
 * Download my data: everything that's theirs, never a secret.
 */

import { describe, expect, it, vi } from "vitest";

const calls: Record<string, any> = {};
const table = (name: string, rows: unknown = []) => ({
  findMany: async (args: any) => {
    calls[name] = args;
    return rows;
  },
  findUnique: async (args: any) => {
    calls[name] = args;
    return null;
  },
});

vi.mock("@kinextion/database", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_t, name: string) =>
        name === "communityMembership"
          ? table(name, [{ community: { name: "Morning crew" }, role: "member", joinedAt: new Date(), leftAt: null }])
          : table(name),
    }
  ),
}));

const { buildExport } = await import("../src/modules/users/export.js");

describe("the data export", () => {
  it("never selects connection tokens", async () => {
    await buildExport("u1");
    const fields = Object.keys(calls.integration.select);
    expect(fields).not.toContain("accessToken");
    expect(fields).not.toContain("refreshToken");
    expect(fields).toContain("provider");
  });

  it("is scoped to the user everywhere, and only their own community posts", async () => {
    const data = await buildExport("u1");
    for (const [name, args] of Object.entries(calls)) {
      if (name === "user") expect(args.where).toEqual({ id: "u1" });
      else expect(args.where).toEqual({ userId: "u1" });
    }
    expect(data.communities.memberships[0].community).toBe("Morning crew");
  });
});
