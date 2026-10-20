/**
 * Discover: what a stranger can see.
 *
 * Only what people chose to make public, only after their week closed, only
 * for thirty days — and never a total, a reaction or a comment.
 */

import { describe, expect, it } from "vitest";
import { PUBLIC_TTL_DAYS } from "@kinextion/shared";
import { DAY_MS, HOUR_MS } from "../src/modules/community/clock.js";
import { getDiscover, getDiscoverResponse } from "../src/modules/community/discover.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import { addComment, reactToResponse } from "../src/modules/community/room.js";
import { buildWorld, expectRefusal, speak, W39 } from "./support/community-world.js";

async function publishedWorld() {
  const world = await buildWorld();
  const publicOnes = [
    await speak(world.deps, "m1", world.topic.id, { visibility: "public_after_close" }),
    await speak(world.deps, "m2", world.topic.id, { visibility: "public_after_close" }),
    await speak(world.deps, "m3", world.topic.id, { visibility: "public_after_close" }),
  ];
  const privateOne = await speak(world.deps, "m4", world.topic.id, { visibility: "community" });
  await reactToResponse(world.deps, "m2", publicOnes[0].id, "agree");
  await addComment(world.deps, "m2", publicOnes[0].id, { body: "This stayed with me." });

  world.clock.set(new Date(W39.closesAt.getTime() + HOUR_MS));
  await runMaintenance(world.deps);
  return { ...world, publicOnes, privateOne };
}

describe("discover", () => {
  it("shows nothing at all while a room is still open", async () => {
    const world = await buildWorld();
    await speak(world.deps, "m1", world.topic.id, { visibility: "public_after_close" });
    expect(await getDiscover(world.deps, "seed")).toEqual({ rows: [] });
  });

  it("groups a week's public voices into one conversation, thought first", async () => {
    const world = await publishedWorld();
    const view = await getDiscover(world.deps, "seed");

    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({
      topic: { text: world.topic.text },
      community: { name: "Favour House" },
      weekKey: "2026-W39",
    });
    expect(view.rows[0].responses).toHaveLength(3);
    expect(view.rows[0].responses.map((r) => r.id)).not.toContain(world.privateOne.id);
  });

  it("carries no reactions, comments or totals into public view", async () => {
    const world = await publishedWorld();
    const serialized = JSON.stringify(await getDiscover(world.deps, "seed"));
    expect(serialized).not.toMatch(/agree|mixed|disagree|comment|reaction|stayed with me/i);
  });

  it("rotates who is heard first, without changing under one listener", async () => {
    const world = await publishedWorld();
    const order = async (seed: string) => (await getDiscover(world.deps, seed)).rows[0].responses.map((r) => r.id);
    expect(await order("visitor-a")).toEqual(await order("visitor-a"));
    const seeds = await Promise.all(["a", "b", "c", "d", "e"].map(order));
    expect(seeds.some((o) => JSON.stringify(o) !== JSON.stringify(seeds[0]))).toBe(true);
  });

  it("plays one response and offers the rest of that conversation next", async () => {
    const world = await publishedWorld();
    const first = world.publicOnes[0];
    const view = await getDiscoverResponse(world.deps, first.id, "visitor");

    expect(view.item.id).toBe(first.id);
    expect(view.playback.url).toContain("https://storage.test/get/");
    expect(view.topic.text).toBe(world.topic.text);
    expect(view.next.map((r) => r.id).sort()).toEqual(world.publicOnes.slice(1).map((r) => r.id).sort());
  });

  it("won't play a community-only response, or one that never existed", async () => {
    const world = await publishedWorld();
    await expectRefusal(getDiscoverResponse(world.deps, world.privateOne.id, "visitor"), 404, "NOT_FOUND");
    await expectRefusal(getDiscoverResponse(world.deps, "nope", "visitor"), 404, "NOT_FOUND");
  });

  it("forgets a conversation thirty days after it closed", async () => {
    const world = await publishedWorld();
    world.clock.set(new Date(W39.closesAt.getTime() + (PUBLIC_TTL_DAYS - 1) * DAY_MS));
    expect((await getDiscover(world.deps, "seed")).rows).toHaveLength(1);

    world.clock.advance(2 * DAY_MS);
    expect((await getDiscover(world.deps, "seed")).rows).toHaveLength(0);
    await expectRefusal(getDiscoverResponse(world.deps, world.publicOnes[0].id, "visitor"), 404, "NOT_FOUND");

    await runMaintenance(world.deps);
    expect(world.store.state.responses).toHaveLength(0);
    expect(world.store.state.results).toHaveLength(1);
  });

  it("drops a community that has closed", async () => {
    const world = await publishedWorld();
    await world.store.transitionCommunity(world.communityId, "active", "archived", world.clock.now());
    expect((await getDiscover(world.deps, "seed")).rows).toHaveLength(0);
  });
});
