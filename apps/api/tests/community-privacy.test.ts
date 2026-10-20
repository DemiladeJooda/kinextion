/**
 * Reflection, not surveillance.
 *
 * Merging community into Kinextion means the guides can know about someone's
 * week. This file fixes what "about" is allowed to mean: participation, and
 * the community's own public question — never a word anyone said in a room,
 * and never another member.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMUNITY_VOICE_RULE, buildContext } from "@kinextion/ai-core";
import { chooseActiveCommunity } from "../src/modules/community/cycles.js";
import { communityContextFor } from "../src/modules/community/context.js";
import { addComment } from "../src/modules/community/room.js";
import { buildWorld, speak } from "./support/community-world.js";

/** A week with real content in it: responses, a comment, a reaction. */
async function livedInWeek() {
  const world = await buildWorld();
  await speak(world.deps, "m1", world.topic.id);
  const mine = await speak(world.deps, "m2", world.topic.id);
  await addComment(world.deps, "m1", mine.id, { body: "The bit about Tuesdays really landed." });
  return world;
}

describe("what the guides are told", () => {
  it("is participation and the week's question — never what anyone said", async () => {
    const world = await livedInWeek();
    const context = await communityContextFor(world.deps, "m2", world.topic.id);
    const serialized = JSON.stringify(context);

    expect(context?.thinkingAbout).toEqual({ communityName: "Favour House", topicText: world.topic.text });
    expect(serialized).not.toMatch(/Tuesdays really landed/);
    expect(serialized).not.toMatch(/Member m1|"m1"|agree|disagree|reaction|comment/i);
    expect(context?.lines.join(" ")).toMatch(/sitting with Favour House/i);
  });

  it("says whether they've spoken, without saying anything about anyone else", async () => {
    const world = await livedInWeek();
    const spoken = await communityContextFor(world.deps, "m1", undefined);
    expect(spoken?.lines.join(" ")).toMatch(/shared their response/);

    await chooseActiveCommunity(world.deps, "m5", "2026-W39", world.communityId);
    const silent = await communityContextFor(world.deps, "m5", undefined);
    expect(silent?.lines.join(" ")).toMatch(/haven't shared their own response yet/);
    expect(silent?.lines.join(" ")).toMatch(/Don't nag/);
    expect(JSON.stringify(silent)).not.toMatch(/m1|m2|Member/);
  });

  it("treats sitting a week out as a choice, not a lapse", async () => {
    const world = await buildWorld();
    await chooseActiveCommunity(world.deps, "m3", "2026-W39", null);
    const context = await communityContextFor(world.deps, "m3", undefined);
    expect(context?.lines.join(" ")).toMatch(/costs them nothing/);
    expect(context?.lines.join(" ")).not.toMatch(/should|behind|missed|streak/i);
  });

  it("won't open a question to someone who isn't in that community", async () => {
    const world = await livedInWeek();
    const outsider = await buildWorld({ prefix: "x", name: "Hoopers" });
    // A member of another community passing this community's topic id.
    const context = await communityContextFor(world.deps, "stranger", world.topic.id);
    expect(context).toBeUndefined();
    // A member of another community, passing a topic id that isn't theirs.
    const elsewhere = await communityContextFor(outsider.deps, "x1", "not-their-topic");
    expect(elsewhere?.lines.length).toBeGreaterThan(0);
    expect(elsewhere?.thinkingAbout).toBeUndefined();
  });

  it("tells the guide it may help someone think, and never write for them", async () => {
    const world = await livedInWeek();
    const context = await communityContextFor(world.deps, "m2", world.topic.id);
    const built = buildContext("kairo", { profile: null, community: context }, []);

    expect(built.systemPrompt).toContain(world.topic.text);
    expect(built.systemPrompt).toContain(COMMUNITY_VOICE_RULE);
    expect(COMMUNITY_VOICE_RULE).toMatch(/Never draft, script, rehearse or write their response/);
  });
});

describe("room content and durable memory", () => {
  it("never meet: nothing in the community module touches the memory store", () => {
    const dir = join(process.cwd(), "src/modules/community");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /from\s+"[^"]*lib\/memory/.test(readFileSync(join(dir, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
