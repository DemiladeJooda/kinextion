/**
 * Inside the room: seeded order, private reactions, live comments, reports.
 */

import { describe, expect, it } from "vitest";
import { getRoom, addComment, deleteComment, listComments, reactToResponse, reportContent, setCommentLike } from "../src/modules/community/room.js";
import { buildWorld, expectRefusal, speak, W39 } from "./support/community-world.js";

/** Keys that would be a reaction total. None may exist in any room payload while it's open. */
const TOTAL_KEYS = /"(agree|mixed|disagree|agreeCount|mixedCount|disagreeCount|reactions|reactionCount|tally|totals|agreePct|mixedPct|disagreePct)"\s*:/;

async function roomWithSpeakers(count = 6) {
  const world = await buildWorld();
  const responses = [];
  for (const m of world.members.slice(0, count)) responses.push(await speak(world.deps, m, world.topic.id));
  return { ...world, responses };
}

describe("listening order", () => {
  it("is stable for one listener and different across listeners", async () => {
    const world = await roomWithSpeakers(8);
    const order = async (m: string) => (await getRoom(world.deps, m, world.topic.id)).responses.map((r) => r.speaker.displayName);

    expect(await order("m1")).toEqual(await order("m1"));
    const others = await Promise.all(["m2", "m3", "m4", "m5"].map(order));
    // Seven voices each; at least one of four listeners hears them in a different order to m2.
    expect(others.slice(1).some((o) => JSON.stringify(o) !== JSON.stringify(others[0]))).toBe(true);
  });

  it("leaves your own response out of the list and gives it back separately", async () => {
    const world = await roomWithSpeakers(4);
    const room = await getRoom(world.deps, "m2", world.topic.id);
    expect(room.mine.id).toBe(world.responses[1].id);
    expect(room.responses.map((r) => r.id)).not.toContain(world.responses[1].id);
    expect(room.circle.voices).toBe(4);
  });
});

describe("reactions", () => {
  it("record privately and show only your own", async () => {
    const world = await roomWithSpeakers(4);
    const target = world.responses[0].id;
    await reactToResponse(world.deps, "m2", target, "agree");
    await reactToResponse(world.deps, "m3", target, "disagree");
    await reactToResponse(world.deps, "m4", target, "disagree");

    const m2 = await getRoom(world.deps, "m2", world.topic.id);
    expect(m2.responses.find((r) => r.id === target)!.myReaction).toBe("agree");
    const m1 = await getRoom(world.deps, "m1", world.topic.id);
    expect(m1.responses.every((r) => r.myReaction === null)).toBe(true);
  });

  it("never appear as a total anywhere in the room while it's open", async () => {
    const world = await roomWithSpeakers(6);
    for (const [i, m] of world.members.slice(0, 6).entries()) {
      for (const r of world.responses) {
        if (r.id !== world.responses[i].id) await reactToResponse(world.deps, m, r.id, i % 2 ? "agree" : "mixed");
      }
    }
    for (const m of world.members.slice(0, 6)) {
      const room = JSON.stringify(await getRoom(world.deps, m, world.topic.id));
      expect(room).not.toMatch(TOTAL_KEYS);
      for (const r of world.responses) {
        expect(JSON.stringify(await listComments(world.deps, m, r.id))).not.toMatch(TOTAL_KEYS);
      }
    }
  });

  it("can change until the room closes, and not after", async () => {
    const world = await roomWithSpeakers(3);
    const target = world.responses[0].id;
    await reactToResponse(world.deps, "m2", target, "agree");
    await reactToResponse(world.deps, "m2", target, "mixed");
    expect((await getRoom(world.deps, "m2", world.topic.id)).responses.find((r) => r.id === target)!.myReaction).toBe("mixed");

    world.clock.set(W39.closesAt);
    await expectRefusal(reactToResponse(world.deps, "m2", target, "disagree"), 409, "ROOM_CLOSED");
  });

  it("can't be given to your own response", async () => {
    const world = await roomWithSpeakers(2);
    await expectRefusal(reactToResponse(world.deps, "m1", world.responses[0].id, "agree"), 409, "OWN_RESPONSE");
  });
});

describe("comments", () => {
  it("are live, with one level of replies", async () => {
    const world = await roomWithSpeakers(3);
    const target = world.responses[0].id;
    const top = await addComment(world.deps, "m2", target, { body: "This landed for me." });
    await addComment(world.deps, "m3", target, { body: "Same.", parentId: top.id });

    const thread = await listComments(world.deps, "m1", target);
    expect(thread.map((c) => [c.body, c.parentId])).toEqual([
      ["This landed for me.", null],
      ["Same.", top.id],
    ]);
    const reply = thread[1];
    await expectRefusal(addComment(world.deps, "m1", target, { body: "Nested", parentId: reply.id }), 400, "REPLY_DEPTH");

    const room = await getRoom(world.deps, "m2", world.topic.id);
    expect(room.responses.find((r) => r.id === target)!.commentCount).toBe(2);
  });

  it("can be liked and unliked, and deleted by their author only", async () => {
    const world = await roomWithSpeakers(3);
    const target = world.responses[0].id;
    const c = await addComment(world.deps, "m2", target, { body: "Thank you for saying this." });

    await setCommentLike(world.deps, "m3", c.id, true);
    await setCommentLike(world.deps, "m3", c.id, true);
    expect((await listComments(world.deps, "m3", target))[0]).toMatchObject({ likeCount: 1, likedByMe: true });
    await setCommentLike(world.deps, "m3", c.id, false);
    expect((await listComments(world.deps, "m3", target))[0]).toMatchObject({ likeCount: 0, likedByMe: false });

    await expectRefusal(deleteComment(world.deps, "m3", c.id), 404, "NOT_FOUND");
    await deleteComment(world.deps, "m2", c.id);
    expect((await listComments(world.deps, "m1", target))[0]).toMatchObject({ body: null, deleted: true, author: { displayName: null } });
  });

  it("close with the room", async () => {
    const world = await roomWithSpeakers(2);
    world.clock.set(W39.closesAt);
    await expectRefusal(addComment(world.deps, "m2", world.responses[0].id, { body: "late" }), 409, "ROOM_CLOSED");
  });
});

describe("reports", () => {
  it("are recorded for review and change nothing on their own", async () => {
    const world = await roomWithSpeakers(3);
    const target = world.responses[0].id;
    await reportContent(world.deps, "m2", { responseId: target }, { reason: "not_genuine", note: "Blank video" });

    expect(world.store.state.reports).toEqual([
      expect.objectContaining({ reporterId: "m2", responseId: target, reason: "not_genuine", note: "Blank video" }),
    ]);
    expect((await getRoom(world.deps, "m3", world.topic.id)).responses.map((r) => r.id)).toContain(target);
  });

  it("need the same access as listening", async () => {
    const world = await roomWithSpeakers(2);
    await expectRefusal(
      reportContent(world.deps, "m5", { responseId: world.responses[0].id }, { reason: "other" }),
      403,
      "UNLOCK_REQUIRED"
    );
  });
});
