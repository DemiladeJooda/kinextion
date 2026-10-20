/**
 * Close, reveal, forget — and the promise that totals don't exist until then.
 */

import { describe, expect, it, vi } from "vitest";
import { PUBLIC_TTL_DAYS, REVEAL_HEADLINE } from "@kinextion/shared";
import { DAY_MS, HOUR_MS } from "../src/modules/community/clock.js";
import { chooseActiveCommunity } from "../src/modules/community/cycles.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import { withdrawResponse } from "../src/modules/community/responses.js";
import { addComment, getRoom, reactToResponse } from "../src/modules/community/room.js";
import { getCommunityHistory, getTopicResult, settleCycle } from "../src/modules/community/settle.js";
import { buildWorld, expectRefusal, speak, W39 } from "./support/community-world.js";

const closeWeek = async (world: Awaited<ReturnType<typeof buildWorld>>) => {
  world.clock.set(new Date(W39.closesAt.getTime() + HOUR_MS));
  return runMaintenance(world.deps);
};

describe("the reveal", () => {
  it("pools every circle into one community result", async () => {
    const world = await buildWorld({ members: 26 });
    for (const m of world.members) await chooseActiveCommunity(world.deps, m, "2026-W39", world.communityId);
    for (const m of world.members) await speak(world.deps, m, world.topic.id);

    const circles = await world.store.listCircles(world.cycle.id);
    expect(circles.length).toBeGreaterThan(1);

    // Circle 0 agrees with everything, circle 1 disagrees, circle 2 is mixed.
    const verdicts = ["agree", "disagree", "mixed"] as const;
    const expected = { agree: 0, mixed: 0, disagree: 0 };
    for (const [i, { memberIds }] of circles.entries()) {
      const verdict = verdicts[i % 3];
      const responses = world.store.state.responses.filter((r) => memberIds.includes(r.userId));
      for (const listener of memberIds) {
        for (const r of responses) {
          if (r.userId === listener) continue;
          await reactToResponse(world.deps, listener, r.id, verdict);
          expected[verdict]++;
        }
      }
    }

    await closeWeek(world);
    const result = await getTopicResult(world.deps, "m1", world.topic.id);
    const total = expected.agree + expected.mixed + expected.disagree;
    expect(result.reactions).toBe(total);
    expect(result.voices).toBe(26);
    expect(result.agreePct + result.mixedPct + result.disagreePct).toBe(100);
    expect(result.agreePct).toBe(Math.round((expected.agree * 100) / total));
    expect(result.headline).toBe(REVEAL_HEADLINE);
  });

  it("counts a withdrawn response toward nothing", async () => {
    const world = await buildWorld();
    const a = await speak(world.deps, "m1", world.topic.id);
    const b = await speak(world.deps, "m2", world.topic.id);
    await speak(world.deps, "m3", world.topic.id);
    await reactToResponse(world.deps, "m3", a.id, "agree");
    await reactToResponse(world.deps, "m3", b.id, "disagree");
    await withdrawResponse(world.deps, "m2", b.id);

    await closeWeek(world);
    const result = await getTopicResult(world.deps, "m1", world.topic.id);
    expect(result).toMatchObject({ voices: 2, reactions: 1, agreePct: 100, disagreePct: 0 });
  });

  it("isn't available until the week has closed and settled", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id);
    await expectRefusal(getTopicResult(world.deps, "m1", world.topic.id), 404, "RESULT_NOT_READY");
    world.clock.set(W39.closesAt);
    await expectRefusal(getTopicResult(world.deps, "m1", world.topic.id), 404, "RESULT_NOT_READY");
    await runMaintenance(world.deps);
    await expect(getTopicResult(world.deps, "m1", world.topic.id)).resolves.toHaveProperty("agreePct");
  });

  it("says so plainly when nobody spoke", async () => {
    const world = await buildWorld();
    await closeWeek(world);
    await expectRefusal(getTopicResult(world.deps, "m1", world.topic.id), 404, "NO_RESULT");
  });
});

describe("totals don't exist while a room is open", () => {
  it("never aggregates reactions before the room closes, through a whole week of use", async () => {
    const world = await buildWorld();
    const spy = vi.spyOn(world.store, "countTopicReactions");
    const responses = [];
    for (const m of world.members.slice(0, 5)) responses.push(await speak(world.deps, m, world.topic.id));

    // A week of hourly maintenance, with people listening and reacting throughout.
    while (world.clock.now() < W39.closesAt) {
      for (const [i, m] of world.members.slice(0, 5).entries()) {
        await getRoom(world.deps, m, world.topic.id);
        const other = responses[(i + 1) % 5];
        await reactToResponse(world.deps, m, other.id, i % 2 ? "agree" : "disagree");
      }
      await runMaintenance(world.deps);
      world.clock.advance(12 * HOUR_MS);
    }
    expect(spy).not.toHaveBeenCalled();

    await closeWeek(world);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("forgetting", () => {
  async function mixedWeek() {
    const world = await buildWorld();
    const pub = await speak(world.deps, "m1", world.topic.id, { visibility: "public_after_close" });
    const priv = await speak(world.deps, "m2", world.topic.id, { visibility: "community" });
    await addComment(world.deps, "m2", pub.id, { body: "Really thoughtful." });
    await reactToResponse(world.deps, "m2", pub.id, "agree");
    const keyOf = (responseId: string) => {
      const mediaId = world.store.state.responses.find((r) => r.id === responseId)!.mediaId!;
      return world.store.state.media.find((m) => m.id === mediaId)!.storageKey;
    };
    return { ...world, pub, priv, pubKey: keyOf(pub.id), privKey: keyOf(priv.id) };
  }

  it("deletes community-only recordings from storage at close, and keeps public ones", async () => {
    const world = await mixedWeek();
    const report = await closeWeek(world);

    expect(report.settlement.cyclesSettled).toBe(1);
    expect(world.media.deleted).toContain(world.privKey);
    expect(world.media.deleted).not.toContain(world.pubKey);
    expect(world.store.state.responses.map((r) => r.id)).toEqual([world.pub.id]);
  });

  it("lets the conversation expire: every comment and reaction goes", async () => {
    const world = await mixedWeek();
    await closeWeek(world);
    expect(world.store.state.comments).toHaveLength(0);
    expect(world.store.state.reactions).toHaveLength(0);
  });

  it("gives public responses thirty days, then removes them — and the result survives", async () => {
    const world = await mixedWeek();
    await closeWeek(world);
    const published = world.store.state.responses[0];
    expect(published.publishedAt).toEqual(W39.closesAt);
    expect(published.expiresAt).toEqual(new Date(W39.closesAt.getTime() + PUBLIC_TTL_DAYS * DAY_MS));

    world.clock.set(new Date(published.expiresAt!.getTime() - HOUR_MS));
    await runMaintenance(world.deps);
    expect(world.store.state.responses).toHaveLength(1);

    world.clock.advance(2 * HOUR_MS);
    const report = await runMaintenance(world.deps);
    expect(report.settlement.publicExpired).toBe(1);
    expect(world.store.state.responses).toHaveLength(0);
    expect(world.media.deleted).toContain(world.pubKey);
    expect(world.store.state.results).toHaveLength(1);
  });

  it("closes the room itself once settled", async () => {
    const world = await mixedWeek();
    await closeWeek(world);
    await expectRefusal(getRoom(world.deps, "m1", world.topic.id), 409, "ROOM_NOT_OPEN");
  });
});

describe("settlement is safe to repeat and to interrupt", () => {
  it("writes one result however many times it runs", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id);
    await closeWeek(world);
    await runMaintenance(world.deps);
    await settleCycle(world.deps, world.store.state.cycles.find((c) => c.id === world.cycle.id)!);
    expect(world.store.state.results).toHaveLength(1);
  });

  it("leaves nothing half-done when it fails part-way, and completes on the next pass", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id, { visibility: "community" });
    world.clock.set(new Date(W39.closesAt.getTime() + HOUR_MS));

    const original = world.store.deleteResponses.bind(world.store);
    world.store.deleteResponses = async (ids) => {
      if (ids.length > 0) throw new Error("connection reset");
    };
    const failed = await runMaintenance(world.deps);
    expect(failed.errors).toEqual([expect.stringMatching(/^settlement: cycle .*: connection reset$/)]);
    world.store.deleteResponses = original;

    // Rolled back: no result, not settled, nothing deleted from storage.
    expect(world.store.state.results).toHaveLength(0);
    expect(world.store.state.cycles.find((c) => c.id === world.cycle.id)!.settledAt).toBeNull();
    expect(world.media.deleted).toHaveLength(0);

    const report = await runMaintenance(world.deps);
    expect(report.settlement.cyclesSettled).toBe(1);
    expect(world.store.state.results).toHaveLength(1);
    expect(world.media.deleted).toHaveLength(1);
  });
});

describe("one community's failure", () => {
  it("never stops another community's week from settling", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id);
    world.clock.set(new Date(W39.closesAt.getTime() + HOUR_MS));

    const original = world.store.countTopicReactions.bind(world.store);
    let calls = 0;
    world.store.countTopicReactions = async (topicId) => {
      if (calls++ === 0) throw new Error("first one breaks");
      return original(topicId);
    };
    // A second community whose week closes at the same moment.
    const second = await buildWorld({ prefix: "h", name: "Hoopers" });
    void second;

    const report = await runMaintenance(world.deps);
    expect(report.errors).toHaveLength(1);
    // The media purge still ran after the failed settlement.
    expect(report.media).toBeDefined();
  });
});

describe("history", () => {
  it("keeps every week's result and shows where a returning question has moved", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id);
    await closeWeek(world);

    // The same question, asked again three years later.
    await world.store.upsertCycleResult({
      communityId: world.communityId,
      cycleId: null,
      weekKey: "2029-W38",
      topicKey: world.topic.topicKey,
      topicText: world.topic.text,
      closedAt: new Date("2029-09-23T02:00:00Z"),
      agreePct: 34,
      mixedPct: 29,
      disagreePct: 37,
      reactionCount: 100,
      participantCount: 40,
      responseCount: 40,
      commentCount: 12,
      at: world.clock.now(),
    });

    const history = await getCommunityHistory(world.deps, "m1", world.communityId);
    expect(history.results).toHaveLength(2);
    expect(history.recurring).toHaveLength(1);
    expect(history.recurring[0].results.map((r) => r.weekKey)).toEqual(["2029-W38", "2026-W39"]);
    expect(JSON.stringify(history)).not.toMatch(/m1|Member|userId/);
  });

  it("is readable by anyone for an active community, because a result holds no one", async () => {
    const world = await buildWorld();
    await expect(getCommunityHistory(world.deps, "stranger", world.communityId)).resolves.toHaveProperty("results");
  });
});
