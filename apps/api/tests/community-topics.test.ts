/**
 * Suggest → synthesize → vote → decide, walked through real Dallas-time
 * boundaries with a manual clock and a stubbed model.
 */

import { describe, expect, it, vi } from "vitest";
import { FOUNDING_QUORUM, MAX_SUGGESTIONS_PER_CYCLE, TOPIC_OPTION_COUNT, cycleBoundaries, seededRng } from "@kinextion/shared";
import { DAY_MS, HOUR_MS, ManualClock } from "../src/modules/community/clock.js";
import { getMyWeek } from "../src/modules/community/cycles.js";
import { CommunityError } from "../src/modules/community/errors.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import { acceptInvite, createCommunity, createInvite, type CommunityDeps } from "../src/modules/community/service.js";
import {
  getBallot,
  mySuggestions,
  proposeClosure,
  submitSuggestion,
  voteOnBallot,
} from "../src/modules/community/topics.js";
import { MemoryCommunityStore } from "./support/memory-community-store.js";

const W39 = cycleBoundaries("2026-W39");
const W40 = cycleBoundaries("2026-W40");
const MEMBERS = Array.from({ length: 8 }, (_, i) => `m${i + 1}`);

const STUB_OPTIONS = [
  { text: "Should Christians use dating apps?", theme: "relationships", rationale: "Several of you have been thinking about how people meet." },
  { text: "Is there too much pressure to marry young?", theme: "family", rationale: "Expectations from home came up." },
  { text: "Has social media made dating harder?", theme: "relationships", rationale: "Comparison came up more than once." },
  { text: "Can ambition and contentment live together?", theme: "growth", rationale: "Work came up in different ways." },
  { text: "Is being single on purpose undervalued?", theme: "identity", rationale: "Some of you raised choosing your own pace." },
];

async function setup({ generate = true } = {}) {
  const store = new MemoryCommunityStore();
  const clock = new ManualClock("2026-09-14T17:00:00Z");
  const generateTopics = vi.fn().mockResolvedValue({ options: STUB_OPTIONS });
  const deps = {
    store,
    clock,
    rng: seededRng(21),
    ...(generate ? { generateTopics } : {}),
  } satisfies CommunityDeps;

  const { community } = await createCommunity(deps, MEMBERS[0], { name: "Favour House" });
  const tokens = [];
  for (const _ of MEMBERS.slice(1)) tokens.push((await createInvite(deps, MEMBERS[0], community.id)).token);
  for (const [i, m] of MEMBERS.slice(1).entries()) await acceptInvite(deps, m, tokens[i]);
  await runMaintenance(deps);

  const cycle = store.state.cycles.find((c) => c.weekKey === "2026-W39")!;
  return { store, clock, deps, generateTopics, communityId: community.id, cycle };
}

async function expectRefusal(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err, `expected ${status} ${code}`).toBeInstanceOf(CommunityError);
  expect((err as CommunityError).statusCode).toBe(status);
  expect((err as CommunityError).code).toBe(code);
}

describe("suggestions", () => {
  it("are only taken while gathering is open", async () => {
    const { deps, clock, cycle } = await setup();
    await expectRefusal(submitSuggestion(deps, "m1", cycle.id, "Dating apps and faith"), 409, "NOT_GATHERING");

    clock.set(W39.gatheringOpensAt);
    await expect(submitSuggestion(deps, "m1", cycle.id, "Dating apps and faith")).resolves.toMatchObject({
      remaining: MAX_SUGGESTIONS_PER_CYCLE - 1,
    });

    clock.set(W39.votingOpensAt);
    await expectRefusal(submitSuggestion(deps, "m1", cycle.id, "Too late for this"), 409, "NOT_GATHERING");
  });

  it("are capped per person per week", async () => {
    const { deps, clock, cycle } = await setup();
    clock.set(W39.gatheringOpensAt);
    for (let i = 0; i < MAX_SUGGESTIONS_PER_CYCLE; i++) {
      await submitSuggestion(deps, "m2", cycle.id, `Thought number ${i}`);
    }
    await expectRefusal(submitSuggestion(deps, "m2", cycle.id, "One more thought"), 409, "SUGGESTION_LIMIT");
    expect((await mySuggestions(deps, "m2", cycle.id)).remaining).toBe(0);
  });

  it("are private to members, and to their author", async () => {
    const { deps, clock, cycle } = await setup();
    clock.set(W39.gatheringOpensAt);
    await submitSuggestion(deps, "m1", cycle.id, "Something only I said");
    await expectRefusal(submitSuggestion(deps, "outsider", cycle.id, "Let me in"), 404, "NOT_FOUND");
    expect((await mySuggestions(deps, "m2", cycle.id)).suggestions).toEqual([]);
  });
});

describe("synthesis", () => {
  async function gather(env: Awaited<ReturnType<typeof setup>>, count = 6) {
    env.clock.set(W39.gatheringOpensAt);
    for (let i = 0; i < count; i++) {
      await submitSuggestion(env.deps, MEMBERS[i % MEMBERS.length], env.cycle.id, `Private thought ${i} about dating and faith`);
    }
  }

  it("builds a four-option ballot when voting opens", async () => {
    const env = await setup();
    await gather(env);
    env.clock.set(W39.votingOpensAt);
    const report = await runMaintenance(env.deps);

    expect(report.topics.ballotsCreated).toBe(1);
    const ballot = env.store.state.ballots.find((b) => b.cycleId === env.cycle.id)!;
    expect(ballot).toMatchObject({ kind: "topic", status: "open", opensAt: W39.votingOpensAt, closesAt: W39.opensAt });
    expect(env.store.state.ballotOptions.filter((o) => o.ballotId === ballot.id)).toHaveLength(TOPIC_OPTION_COUNT);
  });

  it("gives the model the suggestions' words and nothing about who wrote them", async () => {
    const env = await setup();
    await gather(env);
    env.clock.set(W39.votingOpensAt);
    await runMaintenance(env.deps);

    expect(env.generateTopics).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(env.generateTopics.mock.calls[0][0]);
    expect(sent).toContain("Private thought");
    for (const id of MEMBERS) expect(sent).not.toContain(`"${id}"`);
    expect(sent).not.toMatch(/\bm[1-8]\b/);
  });

  it("happens once, however many times maintenance runs", async () => {
    const env = await setup();
    await gather(env);
    env.clock.set(W39.votingOpensAt);
    await runMaintenance(env.deps);
    await runMaintenance(env.deps);
    expect(env.store.state.ballots.filter((b) => b.cycleId === env.cycle.id)).toHaveLength(1);
    expect(env.generateTopics).toHaveBeenCalledTimes(1);
  });

  it("still produces a question in a quiet week, from the prompt bank", async () => {
    const env = await setup();
    await gather(env, 1);
    env.clock.set(W39.votingOpensAt);
    await runMaintenance(env.deps);
    expect(env.generateTopics).not.toHaveBeenCalled();
    expect(env.store.state.ballotOptions).toHaveLength(TOPIC_OPTION_COUNT);
  });

  it("still produces a question when no model is configured", async () => {
    const env = await setup({ generate: false });
    await gather(env);
    env.clock.set(W39.votingOpensAt);
    await runMaintenance(env.deps);
    expect(env.store.state.ballotOptions).toHaveLength(TOPIC_OPTION_COUNT);
  });

  it("opens the room with a question even if the job was down for the whole vote", async () => {
    const env = await setup();
    await gather(env);
    env.clock.set(new Date(W39.opensAt.getTime() + HOUR_MS));
    const report = await runMaintenance(env.deps);
    expect(report.topics).toEqual({ ballotsCreated: 1, ballotsDecided: 1 });
    expect(env.store.state.topics).toHaveLength(1);
  });
});

describe("voting and the week's topic", () => {
  async function toVoting() {
    const env = await setup();
    env.clock.set(W39.gatheringOpensAt);
    for (const [i, m] of MEMBERS.entries()) await submitSuggestion(env.deps, m, env.cycle.id, `Thought ${i} on dating`);
    env.clock.set(W39.votingOpensAt);
    await runMaintenance(env.deps);
    const ballot = env.store.state.ballots.find((b) => b.cycleId === env.cycle.id)!;
    const options = env.store.state.ballotOptions.filter((o) => o.ballotId === ballot.id);
    return { ...env, ballot, options };
  }

  it("shows members the options and their own vote — never a count", async () => {
    const env = await toVoting();
    await voteOnBallot(env.deps, "m1", env.ballot.id, env.options[2].id);
    await voteOnBallot(env.deps, "m2", env.ballot.id, env.options[2].id);

    const view = await getBallot(env.deps, "m1", env.ballot.id);
    expect(view.myVote).toBe(env.options[2].id);
    expect(view.options).toHaveLength(TOPIC_OPTION_COUNT);
    expect(JSON.stringify(view)).not.toMatch(/count|votes|tally|total/i);
    expect((await getBallot(env.deps, "m3", env.ballot.id)).myVote).toBeNull();
  });

  it("lets a vote move until the ballot closes", async () => {
    const env = await toVoting();
    await voteOnBallot(env.deps, "m1", env.ballot.id, env.options[0].id);
    await voteOnBallot(env.deps, "m1", env.ballot.id, env.options[3].id);
    expect((await getBallot(env.deps, "m1", env.ballot.id)).myVote).toBe(env.options[3].id);

    env.clock.set(W39.opensAt);
    await expectRefusal(voteOnBallot(env.deps, "m1", env.ballot.id, env.options[0].id), 409, "BALLOT_CLOSED");
  });

  it("refuses options from elsewhere and callers from outside", async () => {
    const env = await toVoting();
    await expectRefusal(voteOnBallot(env.deps, "m1", env.ballot.id, "not-an-option"), 400, "INVALID");
    await expectRefusal(voteOnBallot(env.deps, "outsider", env.ballot.id, env.options[0].id), 404, "NOT_FOUND");
  });

  it("opens the room on the most-voted question, and only shows it once the room is open", async () => {
    const env = await toVoting();
    for (const m of ["m1", "m2", "m3"]) await voteOnBallot(env.deps, m, env.ballot.id, env.options[1].id);
    await voteOnBallot(env.deps, "m4", env.ballot.id, env.options[0].id);

    const during = await getMyWeek(env.deps, "m5");
    expect(during.next.cycles[0]).toMatchObject({ stage: "voting", topic: null, ballotId: env.ballot.id });

    env.clock.set(W39.opensAt);
    await runMaintenance(env.deps);
    const week = await getMyWeek(env.deps, "m5");
    expect(week.current.cycles[0]).toMatchObject({ stage: "open", topic: { text: env.options[1].text } });
    expect(env.store.state.topics[0].theme).toBe(env.options[1].theme);
  });

  it("tells each member whether they've suggested and voted", async () => {
    const env = await toVoting();
    await voteOnBallot(env.deps, "m1", env.ballot.id, env.options[0].id);
    const week = await getMyWeek(env.deps, "m1");
    expect(week.next.cycles[0].you).toEqual({ suggestions: 1, voted: true, response: "none" });
  });

  it("carries this week's topic into next week's synthesis so it isn't repeated", async () => {
    const env = await toVoting();
    for (const m of MEMBERS) await voteOnBallot(env.deps, m, env.ballot.id, env.options[0].id);
    env.clock.set(W39.opensAt);
    await runMaintenance(env.deps);

    const w40 = env.store.state.cycles.find((c) => c.weekKey === "2026-W40")!;
    env.clock.set(W40.gatheringOpensAt);
    for (const [i, m] of MEMBERS.entries()) await submitSuggestion(env.deps, m, w40.id, `Next week thought ${i}`);
    env.clock.set(W40.votingOpensAt);
    await runMaintenance(env.deps);

    const second = env.generateTopics.mock.calls[1][0];
    expect(second.user).toContain(env.options[0].text);
    const w40Options = env.store.state.ballotOptions.filter(
      (o) => o.ballotId === env.store.state.ballots.find((b) => b.cycleId === w40.id)!.id
    );
    expect(w40Options.map((o) => o.text)).not.toContain(env.options[0].text);
  });
});

describe("closing a community", () => {
  async function closureBallot() {
    const env = await setup();
    const view = await proposeClosure(env.deps, "m1", env.communityId);
    return { ...env, view, close: view.options[0].id, keep: view.options[1].id };
  }

  it("closes on a two-thirds vote with half the community taking part", async () => {
    const env = await closureBallot();
    for (const m of ["m1", "m2", "m3", "m4"]) await voteOnBallot(env.deps, m, env.view.id, env.close);
    await voteOnBallot(env.deps, "m5", env.view.id, env.keep);

    env.clock.advance(8 * DAY_MS);
    await runMaintenance(env.deps);
    expect(env.store.state.communities[0].status).toBe("archived");
  });

  it("keeps a community most members didn't vote to close", async () => {
    const env = await closureBallot();
    for (const m of ["m1", "m2", "m3"]) await voteOnBallot(env.deps, m, env.view.id, env.close);

    env.clock.advance(8 * DAY_MS);
    await runMaintenance(env.deps);
    expect(env.store.state.communities[0].status).toBe("active");
    expect((await getBallot(env.deps, "m1", env.view.id)).decidedOptionId).toBe(env.keep);
  });

  it("allows one closure vote at a time, and not again for a month after one fails", async () => {
    const env = await closureBallot();
    await expectRefusal(proposeClosure(env.deps, "m2", env.communityId), 409, "CLOSURE_OPEN");

    env.clock.advance(8 * DAY_MS);
    await runMaintenance(env.deps);
    await expectRefusal(proposeClosure(env.deps, "m2", env.communityId), 409, "CLOSURE_COOLDOWN");

    env.clock.advance(31 * DAY_MS);
    await expect(proposeClosure(env.deps, "m2", env.communityId)).resolves.toMatchObject({ kind: "closure" });
  });

  it("can't be proposed by someone outside the community", async () => {
    const env = await setup();
    await expectRefusal(proposeClosure(env.deps, "outsider", env.communityId), 404, "NOT_FOUND");
  });

  it("stops the community's weeks once it has closed", async () => {
    const env = await closureBallot();
    for (const m of MEMBERS) await voteOnBallot(env.deps, m, env.view.id, env.close);
    env.clock.advance(8 * DAY_MS);
    await runMaintenance(env.deps);
    const before = env.store.state.cycles.length;

    env.clock.advance(21 * DAY_MS);
    await runMaintenance(env.deps);
    expect(env.store.state.cycles).toHaveLength(before);
    // The closure deadline and W39's vote fell in the same pass: no ballot for a closed community.
    expect(env.store.state.ballots.filter((b) => b.kind === "topic")).toHaveLength(0);
    void FOUNDING_QUORUM;
  });
});
