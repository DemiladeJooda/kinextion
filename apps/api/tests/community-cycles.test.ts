/**
 * The cycle engine: weeks that create themselves, and one active community
 * per person per week. A fake clock walks real Dallas-time boundaries.
 */

import { describe, expect, it } from "vitest";
import { FOUNDING_QUORUM, cycleBoundaries, seededRng } from "@kinextion/shared";
import { DAY_MS, HOUR_MS, ManualClock } from "../src/modules/community/clock.js";
import { chooseActiveCommunity, ensureCycles, getMyWeek } from "../src/modules/community/cycles.js";
import { CommunityError } from "../src/modules/community/errors.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import {
  acceptInvite,
  createCommunity,
  createInvite,
  type CommunityDeps,
} from "../src/modules/community/service.js";
import { MemoryCommunityStore } from "./support/memory-community-store.js";

/** Monday 14 September 2026, midday Dallas — inside 2026-W38's open room. */
const MONDAY_W38 = "2026-09-14T17:00:00Z";

function setup(start = MONDAY_W38) {
  const store = new MemoryCommunityStore();
  const clock = new ManualClock(start);
  const deps = { store, clock, rng: seededRng(5) } satisfies CommunityDeps;
  return { store, clock, deps };
}

async function found(deps: CommunityDeps, prefix = "m", name = "Cycle Community") {
  const founder = `${prefix}1`;
  const { community } = await createCommunity(deps, founder, { name });
  const tokens = [];
  for (let n = 2; n <= FOUNDING_QUORUM; n++) tokens.push((await createInvite(deps, founder, community.id)).token);
  for (let n = 2; n <= FOUNDING_QUORUM; n++) await acceptInvite(deps, `${prefix}${n}`, tokens[n - 2]);
  return community.id;
}

async function expectRefusal(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err, `expected ${status} ${code}`).toBeInstanceOf(CommunityError);
  expect((err as CommunityError).statusCode).toBe(status);
  expect((err as CommunityError).code).toBe(code);
}

describe("ensureCycles", () => {
  it("creates every cycle whose gathering can still happen, and no others", async () => {
    const { deps, store } = setup();
    await found(deps);
    await ensureCycles(deps);
    // Monday of W38: W38's vote opened last Friday, so only W39 and W40 are created.
    expect(store.state.cycles.map((c) => c.weekKey).sort()).toEqual(["2026-W39", "2026-W40"]);
  });

  it("stores the real Dallas boundaries", async () => {
    const { deps, store } = setup();
    await found(deps);
    await ensureCycles(deps);
    const w39 = store.state.cycles.find((c) => c.weekKey === "2026-W39")!;
    const expected = cycleBoundaries("2026-W39");
    expect(w39.opensAt).toEqual(expected.opensAt);
    expect(w39.closesAt).toEqual(expected.closesAt);
  });

  it("is idempotent and never rewrites an existing cycle", async () => {
    const { deps, store } = setup();
    await found(deps);
    expect(await ensureCycles(deps)).toBe(2);
    const before = structuredClone(store.state.cycles);
    expect(await ensureCycles(deps)).toBe(0);
    expect(store.state.cycles).toEqual(before);
  });

  it("gives a community formed on a Saturday the week after next, not a room with no question", async () => {
    // Saturday 19 September (still W38): W39's vote opened Friday the 18th,
    // so the first room it can have a question for is W40.
    const { deps, store } = setup("2026-09-19T17:00:00Z");
    await found(deps);
    await ensureCycles(deps);
    expect(store.state.cycles.map((c) => c.weekKey).sort()).toEqual(["2026-W40"]);
  });

  it("only creates cycles for active communities", async () => {
    const { deps, store } = setup();
    await createCommunity(deps, "solo", { name: "Still Forming" });
    await ensureCycles(deps);
    expect(store.state.cycles).toHaveLength(0);
  });

  it("runs as part of maintenance", async () => {
    const { deps } = setup();
    await found(deps);
    expect((await runMaintenance(deps)).cycles.created).toBe(2);
    expect((await runMaintenance(deps)).cycles.created).toBe(0);
  });

  it("keeps a community in continuous weeks as time passes", async () => {
    const { deps, store, clock } = setup();
    await found(deps);
    for (let day = 0; day < 28; day++) {
      await runMaintenance(deps);
      clock.advance(DAY_MS);
    }
    // 28 days from Monday of W38 ends inside W41; two weeks of lookahead reaches W43.
    const weeks = store.state.cycles.map((c) => c.weekKey).sort();
    expect(weeks).toEqual(["2026-W39", "2026-W40", "2026-W41", "2026-W42", "2026-W43"]);
    // And at every point there was an upcoming room to choose.
    for (const w of weeks.slice(0, -1)) {
      expect(store.state.cycles.some((c) => c.weekKey === w)).toBe(true);
    }
  });
});

describe("your week", () => {
  it("shows this week and next, with stages derived from the clock", async () => {
    // Wednesday 16 September: W39's gathering has just opened.
    const { deps } = setup("2026-09-16T12:00:00Z");
    await found(deps);
    await runMaintenance(deps);
    const week = await getMyWeek(deps, "m1");

    expect(week.timeZone).toBe("America/Chicago");
    expect(week.current.weekKey).toBe("2026-W38");
    expect(week.next.weekKey).toBe("2026-W39");
    expect(week.next.cycles).toHaveLength(1);
    expect(week.next.cycles[0]).toMatchObject({ stage: "gathering", community: { name: "Cycle Community" } });
  });

  it("walks one cycle through every stage as the clock moves", async () => {
    const { deps, clock } = setup();
    await found(deps);
    const stages: string[] = [];
    const b = cycleBoundaries("2026-W39");
    for (const at of [
      new Date(b.gatheringOpensAt.getTime() - HOUR_MS),
      b.gatheringOpensAt,
      b.votingOpensAt,
      b.opensAt,
      b.closesAt,
    ]) {
      clock.set(at);
      const week = await getMyWeek(deps, "m1");
      const cycle = [...week.current.cycles, ...week.next.cycles].find((c) => c.weekKey === "2026-W39");
      stages.push(cycle!.stage);
    }
    expect(stages).toEqual(["scheduled", "gathering", "voting", "open", "closed"]);
  });

  it("shows nothing for someone in no communities", async () => {
    const { deps } = setup();
    const week = await getMyWeek(deps, "nobody");
    expect(week.current).toEqual({ weekKey: "2026-W38", choice: null, cycles: [] });
  });
});

describe("choosing where to sit", () => {
  it("sets and changes the choice until you've spoken", async () => {
    const { deps } = setup("2026-09-16T12:00:00Z");
    const a = await found(deps, "m", "First");
    const b = await found(deps, "m", "Second");

    expect(await chooseActiveCommunity(deps, "m1", "2026-W39", a)).toEqual({ communityId: a, locked: false });
    expect(await chooseActiveCommunity(deps, "m1", "2026-W39", b)).toEqual({ communityId: b, locked: false });
    const week = await getMyWeek(deps, "m1");
    expect(week.next.choice).toEqual({ communityId: b, locked: false });
  });

  it("lets you sit a week out, and records nothing against you for it", async () => {
    const { deps, store } = setup("2026-09-16T12:00:00Z");
    await found(deps);
    const before = store.state.memberships.map((m) => ({ ...m }));

    expect(await chooseActiveCommunity(deps, "m1", "2026-W39", null)).toEqual({ communityId: null, locked: false });
    // The only thing written is the choice itself — no strike, no streak, no membership change.
    expect(store.state.memberships).toEqual(before);
    expect(store.state.strikes).toEqual([]);
    expect(store.state.activeChoices).toEqual([
      expect.objectContaining({ userId: "m1", weekKey: "2026-W39", communityId: null, lockedAt: null }),
    ]);
  });

  it("refuses to move once the choice is locked", async () => {
    const { deps, store } = setup("2026-09-16T12:00:00Z");
    const a = await found(deps, "m", "First");
    const b = await found(deps, "m", "Second");
    await chooseActiveCommunity(deps, "m1", "2026-W39", a);
    await store.lockActiveChoice("m1", "2026-W39", a, deps.clock.now());

    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W39", b), 409, "CHOICE_LOCKED");
    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W39", null), 409, "CHOICE_LOCKED");
  });

  it("only accepts this week or next", async () => {
    const { deps } = setup();
    const id = await found(deps);
    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W41", id), 400, "WEEK_OUT_OF_RANGE");
    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W37", id), 400, "WEEK_OUT_OF_RANGE");
    await expectRefusal(chooseActiveCommunity(deps, "m1", "not-a-week", id), 400, "INVALID");
  });

  it("refuses a week whose rooms have closed", async () => {
    // Sunday 20 September, 22:00 Dallas — W38 closed at 21:00.
    const { deps } = setup("2026-09-21T03:00:00Z");
    const id = await found(deps);
    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W38", id), 409, "WEEK_CLOSED");
  });

  it("refuses a community you aren't in, without confirming it exists", async () => {
    const { deps } = setup("2026-09-16T12:00:00Z");
    const id = await found(deps);
    await expectRefusal(chooseActiveCommunity(deps, "stranger", "2026-W39", id), 404, "NOT_FOUND");
  });

  it("explains when a community has no room that week", async () => {
    // Monday of W38: the community is new, so W38's topic was chosen before it existed.
    const { deps } = setup();
    const id = await found(deps);
    await expectRefusal(chooseActiveCommunity(deps, "m1", "2026-W38", id), 409, "NO_ROOM_THIS_WEEK");
  });
});
