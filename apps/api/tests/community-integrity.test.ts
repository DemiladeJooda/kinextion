/**
 * Integrity and the chest.
 *
 * Uploading something that isn't a real answer must not open a room, and must
 * never remove an account on its own.
 */

import { describe, expect, it } from "vitest";
import { MIN_CHEST_PROPOSALS, RESTRICTION_DAYS, STRIKE_TTL_DAYS } from "@kinextion/shared";
import { callChestVote, getChest, proposeProject } from "../src/modules/community/chest.js";
import { DAY_MS } from "../src/modules/community/clock.js";
import { checkSubmissionIntegrity, getMyStanding } from "../src/modules/community/integrity.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import { submitResponse } from "../src/modules/community/responses.js";
import { getRoom } from "../src/modules/community/room.js";
import { voteOnBallot } from "../src/modules/community/topics.js";
import { advanceToNextWeek, buildWorld, expectRefusal, speak, upload } from "./support/community-world.js";

/** A world whose submissions run the real integrity checks. */
async function integrityWorld() {
  const world = await buildWorld();
  world.deps.checkIntegrity = (userId, asset) => checkSubmissionIntegrity(world.deps, userId, asset);
  return world;
}

describe("a recording that isn't a real answer", () => {
  it("is refused when it's silent, leaves the room locked, and files a strike", async () => {
    const world = await integrityWorld();
    await speak(world.deps, "m1", world.topic.id);
    const silent = await upload(world.deps, "m2", { signalRatio: 0.02 });

    await expectRefusal(
      submitResponse(world.deps, "m2", world.topic.id, { mediaId: silent, visibility: "community" }),
      422,
      "SILENT_RECORDING"
    );
    await expectRefusal(getRoom(world.deps, "m2", world.topic.id), 403, "UNLOCK_REQUIRED");
    expect(world.store.state.strikes.map((s) => s.reason)).toEqual(["silent_recording"]);

    // The slot isn't spent: a real answer still works.
    await expect(speak(world.deps, "m2", world.topic.id)).resolves.toMatchObject({ status: "submitted" });
  });

  it("is refused when last week's file is uploaded again this week", async () => {
    const world = await integrityWorld();
    const hash = "b".repeat(64);
    await speak(world.deps, "m1", world.topic.id, { contentHash: hash });

    const { topic } = await advanceToNextWeek(world);
    const again = await upload(world.deps, "m1", { contentHash: hash });
    await expectRefusal(
      submitResponse(world.deps, "m1", topic.id, { mediaId: again, visibility: "community" }),
      422,
      "REUSED_RECORDING"
    );
    expect(world.store.state.strikes.map((s) => s.reason)).toEqual(["reused_recording"]);

    // Someone else's identical file is their own business.
    const theirs = await upload(world.deps, "m2", { contentHash: hash });
    await expect(
      submitResponse(world.deps, "m2", topic.id, { mediaId: theirs, visibility: "community" })
    ).resolves.toMatchObject({ status: "submitted" });
  });

  it("doesn't punish re-uploading a file that was never actually shared", async () => {
    const world = await integrityWorld();
    const hash = "c".repeat(64);
    await upload(world.deps, "m2", { contentHash: hash }); // abandoned
    const second = await upload(world.deps, "m2", { contentHash: hash });
    await expect(
      submitResponse(world.deps, "m2", world.topic.id, { mediaId: second, visibility: "community" })
    ).resolves.toMatchObject({ status: "submitted" });
    expect(world.store.state.strikes).toEqual([]);
  });
});

describe("strikes", () => {
  it("restrict temporarily after three, and never remove an account", async () => {
    const world = await integrityWorld();
    for (let i = 0; i < 3; i++) {
      const silent = await upload(world.deps, "m3", { signalRatio: 0 });
      await expectRefusal(
        submitResponse(world.deps, "m3", world.topic.id, { mediaId: silent, visibility: "community" }),
        422,
        "SILENT_RECORDING"
      );
    }

    const standing = await getMyStanding(world.deps, "m3");
    expect(standing.recentStrikes).toBe(3);
    expect(standing.restrictedUntil).not.toBeNull();

    // Restricted — even a genuine recording waits.
    await expectRefusal(speak(world.deps, "m3", world.topic.id), 403, "RESTRICTED");
    // Still a member of everything they were a member of.
    expect(world.store.state.memberships.filter((m) => m.userId === "m3" && !m.leftAt)).toHaveLength(1);

    world.clock.advance((RESTRICTION_DAYS + 1) * DAY_MS);
    expect((await getMyStanding(world.deps, "m3")).restrictedUntil).toBeNull();
  });

  it("stop counting after their window", async () => {
    const world = await integrityWorld();
    for (let i = 0; i < 2; i++) {
      const silent = await upload(world.deps, "m4", { signalRatio: 0 });
      await expectRefusal(
        submitResponse(world.deps, "m4", world.topic.id, { mediaId: silent, visibility: "community" }),
        422,
        "SILENT_RECORDING"
      );
    }
    world.clock.advance((STRIKE_TTL_DAYS + 1) * DAY_MS);
    expect(await getMyStanding(world.deps, "m4")).toEqual({ recentStrikes: 0, restrictedUntil: null });
  });

  it("leave everyone else alone", async () => {
    const world = await integrityWorld();
    const silent = await upload(world.deps, "m5", { signalRatio: 0 });
    await expectRefusal(
      submitResponse(world.deps, "m5", world.topic.id, { mediaId: silent, visibility: "community" }),
      422,
      "SILENT_RECORDING"
    );
    expect(await getMyStanding(world.deps, "m6")).toEqual({ recentStrikes: 0, restrictedUntil: null });
  });
});

describe("the chest", () => {
  it("shows a balance and the projects members have proposed, without naming who proposed them", async () => {
    const world = await buildWorld();
    await world.store.createChestEntry({
      communityId: world.communityId,
      cents: 25_000,
      kind: "revenue_share",
      memo: "September listening",
      at: world.clock.now(),
    });
    await proposeProject(world.deps, "m2", world.communityId, { title: "New sound system", description: "The back row can't hear." });

    const chest = await getChest(world.deps, "m3", world.communityId);
    expect(chest).toMatchObject({ balanceCents: 25_000, currency: "USD" });
    expect(chest.proposals[0]).toMatchObject({ title: "New sound system", status: "proposed", isMine: false });
    expect(JSON.stringify(chest)).not.toMatch(/"m2"|userId/);
    expect((await getChest(world.deps, "m2", world.communityId)).proposals[0].isMine).toBe(true);
  });

  it("puts proposals to the community and records the winner as a decision, not a payment", async () => {
    const world = await buildWorld();
    await proposeProject(world.deps, "m2", world.communityId, { title: "Reunion trip" });
    await proposeProject(world.deps, "m3", world.communityId, { title: "Court repairs" });

    const ballot = await callChestVote(world.deps, "m1", world.communityId);
    expect(ballot.options.map((o) => o.text)).toEqual(["Reunion trip", "Court repairs"]);

    for (const m of ["m1", "m2", "m3"]) await voteOnBallot(world.deps, m, ballot.id, ballot.options[1].id);
    world.clock.advance(8 * DAY_MS);
    await runMaintenance(world.deps);

    const chest = await getChest(world.deps, "m1", world.communityId);
    expect(chest.proposals.find((p) => p.title === "Court repairs")!.status).toBe("chosen");
    expect(chest.proposals.find((p) => p.title === "Reunion trip")!.status).toBe("not_chosen");
    // The ledger records the decision; the balance doesn't move.
    expect(chest.entries[0]).toMatchObject({ kind: "allocation", cents: 0 });
    expect(chest.balanceCents).toBe(0);
  });

  it("needs enough proposals, a steward, and no vote already open", async () => {
    const world = await buildWorld();
    await expectRefusal(callChestVote(world.deps, "m1", world.communityId), 409, "NOT_ENOUGH_PROPOSALS");

    await proposeProject(world.deps, "m2", world.communityId, { title: "Reunion trip" });
    await proposeProject(world.deps, "m3", world.communityId, { title: "Court repairs" });
    await expectRefusal(callChestVote(world.deps, "m2", world.communityId), 403, "NOT_STEWARD");

    await callChestVote(world.deps, "m1", world.communityId);
    await expectRefusal(callChestVote(world.deps, "m1", world.communityId), 409, "CHEST_VOTE_OPEN");
    expect(MIN_CHEST_PROPOSALS).toBe(2);
  });

  it("limits how many open proposals one member can have", async () => {
    const world = await buildWorld();
    await proposeProject(world.deps, "m2", world.communityId, { title: "One" });
    await proposeProject(world.deps, "m2", world.communityId, { title: "Two" });
    await expectRefusal(proposeProject(world.deps, "m2", world.communityId, { title: "Three" }), 409, "PROPOSAL_LIMIT");
  });

  it("is closed to non-members", async () => {
    const world = await buildWorld();
    await expectRefusal(getChest(world.deps, "stranger", world.communityId), 404, "NOT_FOUND");
  });
});
