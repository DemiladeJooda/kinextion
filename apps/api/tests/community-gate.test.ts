/**
 * Speak before you listen — the rule the product is built on.
 *
 * Every way into a room is tried here, as every kind of caller, and each must
 * refuse until the caller has spoken. The locked checks assert on the
 * serialized refusal as a string, so nothing about the room can leak inside a
 * nested field of an error either.
 */

import { describe, expect, it } from "vitest";
import { CIRCLE_MAX } from "@kinextion/shared";
import { chooseActiveCommunity, getMyWeek } from "../src/modules/community/cycles.js";
import { CommunityError } from "../src/modules/community/errors.js";
import { getTopic, submitResponse, withdrawResponse } from "../src/modules/community/responses.js";
import { addComment, getRoom, listComments, playResponse, reactToResponse } from "../src/modules/community/room.js";
import { buildWorld, expectRefusal, foundWith, speak, upload, W39 } from "./support/community-world.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";

/** Every read into a room, as one caller. */
function roomReads(world: Awaited<ReturnType<typeof buildWorld>>, userId: string, responseId: string) {
  const { deps, topic } = world;
  return {
    room: () => getRoom(deps, userId, topic.id),
    playback: () => playResponse(deps, userId, responseId),
    comments: () => listComments(deps, userId, responseId),
    react: () => reactToResponse(deps, userId, responseId, "agree"),
    comment: () => addComment(deps, userId, responseId, { body: "hi" }),
  };
}

async function refusalOf(fn: () => Promise<unknown>): Promise<CommunityError> {
  const err = await fn().then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(CommunityError);
  return err as CommunityError;
}

describe("the gate", () => {
  it("keeps every way into the room shut until you've spoken — and says nothing about what's inside", async () => {
    const world = await buildWorld();
    const first = await speak(world.deps, "m1", world.topic.id);
    await speak(world.deps, "m2", world.topic.id);

    for (const [name, read] of Object.entries(roomReads(world, "m3", first.id))) {
      const err = await refusalOf(read);
      expect([err.statusCode, err.code], name).toEqual([403, "UNLOCK_REQUIRED"]);
      const serialized = JSON.stringify({ message: err.message, code: err.code, status: err.statusCode });
      expect(serialized, name).not.toMatch(/m1|m2|Member|response_|circle_|voices|\d+ (people|voices)/);
    }
  });

  it("opens the room the moment you speak", async () => {
    const world = await buildWorld();
    const first = await speak(world.deps, "m1", world.topic.id);
    await speak(world.deps, "m2", world.topic.id);

    const room = await getRoom(world.deps, "m2", world.topic.id);
    expect(room.responses.map((r) => r.id)).toEqual([first.id]);
    await expect(playResponse(world.deps, "m2", first.id)).resolves.toHaveProperty("url");
  });

  it("locks the room again when you withdraw", async () => {
    const world = await buildWorld();
    const other = await speak(world.deps, "m1", world.topic.id);
    const mine = await speak(world.deps, "m2", world.topic.id);
    await withdrawResponse(world.deps, "m2", mine.id);

    for (const [name, read] of Object.entries(roomReads(world, "m2", other.id))) {
      const err = await refusalOf(read);
      expect([err.statusCode, err.code], name).toEqual([403, "UNLOCK_REQUIRED"]);
    }
  });

  it("never lets a withdrawn response be replaced", async () => {
    const world = await buildWorld();
    const mine = await speak(world.deps, "m2", world.topic.id);
    await withdrawResponse(world.deps, "m2", mine.id);
    await expectRefusal(speak(world.deps, "m2", world.topic.id), 409, "ALREADY_RESPONDED");
  });

  it("allows exactly one response per person per topic", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m2", world.topic.id);
    await expectRefusal(speak(world.deps, "m2", world.topic.id), 409, "ALREADY_RESPONDED");
  });

  it("holds the one-response rule in storage even if the service check is bypassed", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m2", world.topic.id);
    const second = await upload(world.deps, "m2");
    // Simulate a future bug that skips the existence check.
    const original = world.store.findResponseFor.bind(world.store);
    world.store.findResponseFor = async () => null;
    await expectRefusal(
      submitResponse(world.deps, "m2", world.topic.id, { mediaId: second, visibility: "community" }),
      409,
      "ALREADY_RESPONDED"
    );
    world.store.findResponseFor = original;
  });

  it("keeps a room shut to a member sitting with a different community this week", async () => {
    const world = await buildWorld();
    // m3 is also in a second community, and sat with that one for W39.
    const other = await foundWith(world.deps, ["m3", "x2", "x3", "x4", "x5", "x6"], "Hoopers");
    await world.store.setActiveChoice({ userId: "m3", weekKey: "2026-W39", communityId: other, at: world.clock.now() });

    const first = await speak(world.deps, "m1", world.topic.id);
    const err = await refusalOf(() => getRoom(world.deps, "m3", world.topic.id));
    expect([err.statusCode, err.code]).toEqual([403, "NOT_ACTIVE_COMMUNITY"]);
    await expectRefusal(speak(world.deps, "m3", world.topic.id), 409, "NOT_ACTIVE_COMMUNITY");
    await expectRefusal(playResponse(world.deps, "m3", first.id), 403, "NOT_ACTIVE_COMMUNITY");
  });

  it("answers a non-member with 404, never 403", async () => {
    const world = await buildWorld();
    const first = await speak(world.deps, "m1", world.topic.id);
    for (const [name, read] of Object.entries(roomReads(world, "stranger", first.id))) {
      const err = await refusalOf(read);
      expect([err.statusCode, err.code], name).toEqual([404, "NOT_FOUND"]);
    }
    await expectRefusal(getTopic(world.deps, "stranger", world.topic.id), 404, "NOT_FOUND");
  });

  it("refuses to take a response before the room opens or after it closes", async () => {
    const world = await buildWorld();
    const early = await upload(world.deps, "m4");
    world.clock.set(W39.closesAt);
    await expectRefusal(
      submitResponse(world.deps, "m4", world.topic.id, { mediaId: early, visibility: "community" }),
      409,
      "ROOM_NOT_OPEN"
    );
  });

  it("shows a locked room its topic and deadline, and nothing about who has spoken", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id);
    const view = await getTopic(world.deps, "m5", world.topic.id);
    expect(view).toMatchObject({ text: world.topic.text, you: { room: "locked", response: null, chosen: false } });
    expect(JSON.stringify(view)).not.toMatch(/m1|Member|responses|voices/);
  });

  it("chooses your community for the week when you speak, and locks that choice", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m6", world.topic.id);
    const week = await getMyWeek(world.deps, "m6");
    expect(week.current.choice).toEqual({ communityId: world.communityId, locked: true });
    expect(week.current.cycles[0].you.response).toBe("submitted");
    await expectRefusal(chooseActiveCommunity(world.deps, "m6", "2026-W39", null), 409, "CHOICE_LOCKED");
  });
});

describe("recordings", () => {
  it("must belong to the speaker, be finished, and be used once", async () => {
    const world = await buildWorld();
    const theirs = await upload(world.deps, "m1");
    await expectRefusal(
      submitResponse(world.deps, "m2", world.topic.id, { mediaId: theirs, visibility: "community" }),
      404,
      "NOT_FOUND"
    );

    await speak(world.deps, "m1", world.topic.id);
    const reused = world.store.state.responses[0].mediaId!;
    await expectRefusal(
      submitResponse(world.deps, "m3", world.topic.id, { mediaId: reused, visibility: "community" }),
      404,
      "NOT_FOUND"
    );
  });

  it("enforces the two-minute floor on the server, whatever the client claimed", async () => {
    const world = await buildWorld();
    const mediaId = await upload(world.deps, "m1");
    world.store.state.media.find((m) => m.id === mediaId)!.durationSec = 90;
    await expectRefusal(
      submitResponse(world.deps, "m1", world.topic.id, { mediaId, visibility: "community" }),
      422,
      "TOO_SHORT"
    );
  });

  it("deletes a withdrawn response's recording at the next pass", async () => {
    const world = await buildWorld();
    const mine = await speak(world.deps, "m1", world.topic.id);
    const key = world.store.state.media.find((m) => m.id === world.store.state.responses[0].mediaId)!.storageKey;
    await withdrawResponse(world.deps, "m1", mine.id);
    await runMaintenance(world.deps);
    expect(world.media.deleted).toContain(key);
  });
});

describe("circles", () => {
  it("keeps a community with more speakers than a circle holds in several circles, none over the cap", async () => {
    const world = await buildWorld({ members: 30 });
    for (const m of world.members) {
      await chooseActiveCommunity(world.deps, m, "2026-W39", world.communityId);
    }
    for (const m of world.members) await speak(world.deps, m, world.topic.id);

    const circles = await world.store.listCircles(world.cycle.id);
    expect(circles).toHaveLength(3);
    for (const c of circles) expect(c.memberIds.length).toBeLessThanOrEqual(CIRCLE_MAX);
  });

  it("keeps a member of one circle out of another circle's responses", async () => {
    const world = await buildWorld({ members: 26 });
    for (const m of world.members) await chooseActiveCommunity(world.deps, m, "2026-W39", world.communityId);
    for (const m of world.members) await speak(world.deps, m, world.topic.id);

    const circles = await world.store.listCircles(world.cycle.id);
    const [a, b] = circles;
    const listener = a.memberIds[0];
    const elsewhere = world.store.state.responses.find((r) => r.userId === b.memberIds[0])!;

    const room = await getRoom(world.deps, listener, world.topic.id);
    expect(room.circle.voices).toBe(a.memberIds.length);
    expect(room.responses.map((r) => r.id)).not.toContain(elsewhere.id);
    await expectRefusal(playResponse(world.deps, listener, elsewhere.id), 404, "NOT_FOUND");
    await expectRefusal(listComments(world.deps, listener, elsewhere.id), 404, "NOT_FOUND");
    await expectRefusal(reactToResponse(world.deps, listener, elsewhere.id, "agree"), 404, "NOT_FOUND");
  });
});
