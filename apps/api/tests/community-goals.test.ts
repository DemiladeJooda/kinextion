/**
 * Community goals — a shared target with a fixed reward, progress counted
 * from weeks actually closed (never self-reported).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-goals-tests";

// Only CommunityGoal needs a Prisma double here — membership/results go
// through the in-memory CommunityStore passed as `communityDeps` below.
const goalRows: Array<{
  id: string;
  communityId: string;
  title: string;
  targetWeeks: number;
  rewardLabel: string;
  achievedAt: Date | null;
  createdAt: Date;
}> = [];
let seq = 0;

vi.mock("@kinextion/database", () => ({
  Prisma: { DbNull: null },
  prisma: {
    communityGoal: {
      create: async ({
        data,
      }: {
        data: { communityId: string; title: string; targetWeeks: number; rewardLabel: string; createdAt: Date };
      }) => {
        const row = { id: `goal${++seq}`, achievedAt: null, ...data };
        goalRows.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { communityId: string } }) => {
        const matches = goalRows.filter((g) => g.communityId === where.communityId);
        return matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { achievedAt: Date } }) => {
        const row = goalRows.find((g) => g.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  },
}));

const { buildWorld, advanceToNextWeek, speak, expectRefusal } = await import(
  "./support/community-world.js"
);
const { getCommunityGoal, setCommunityGoal } = await import("../src/modules/community/goals.js");

describe("community goals", () => {
  // MemoryCommunityStore resets its id counter per instance, so a fresh
  // buildWorld() in the next test can mint the same communityId — this mock
  // has to reset the same way, or goals from one test leak into the next.
  beforeEach(() => {
    goalRows.length = 0;
    seq = 0;
  });

  it("has no goal until a steward sets one", async () => {
    const world = await buildWorld();
    const goal = await getCommunityGoal(world.deps, world.members[0], world.communityId);
    expect(goal).toBeNull();
  });

  it("only a steward can set a goal", async () => {
    const world = await buildWorld();
    await expectRefusal(
      setCommunityGoal(world.deps, world.members[1], world.communityId, {
        title: "Four weeks together",
        targetWeeks: 4,
        rewardLabel: "Free class",
      }),
      403,
      "NOT_STEWARD"
    );
  });

  it("starts at zero progress and tracks weeks closed since it was set", async () => {
    const world = await buildWorld();
    await setCommunityGoal(world.deps, world.members[0], world.communityId, {
      title: "Four weeks together",
      targetWeeks: 4,
      rewardLabel: "Free class",
    });

    const fresh = await getCommunityGoal(world.deps, world.members[0], world.communityId);
    expect(fresh?.progressWeeks).toBe(0);
    expect(fresh?.achievedAt).toBeNull();

    // A week only produces a CycleResult once someone has actually spoken.
    await speak(world.deps, world.members[1], world.topic.id);
    await advanceToNextWeek(world); // closes W39

    const afterOneWeek = await getCommunityGoal(world.deps, world.members[0], world.communityId);
    expect(afterOneWeek?.progressWeeks).toBe(1);
    expect(afterOneWeek?.achievedAt).toBeNull();
  });

  it("marks the goal achieved once progress reaches the target", async () => {
    const world = await buildWorld();
    await setCommunityGoal(world.deps, world.members[0], world.communityId, {
      title: "One week together",
      targetWeeks: 1,
      rewardLabel: "Free class",
    });

    await speak(world.deps, world.members[1], world.topic.id);
    await advanceToNextWeek(world); // closes W39 — target hit

    const goal = await getCommunityGoal(world.deps, world.members[0], world.communityId);
    expect(goal?.progressWeeks).toBe(1);
    expect(goal?.achievedAt).not.toBeNull();
  });
});
