/**
 * Founding and admission, end to end, against an in-memory store and a clock
 * that only moves when told to. No database, no network, no real time — a
 * 72-hour panel window and a 30-day cooldown pass in microseconds.
 */

import { describe, expect, it } from "vitest";
import {
  FORMING_EXPIRY_DAYS,
  FOUNDING_QUORUM,
  MAX_FORMING_PER_FOUNDER,
  PANEL_TIMEOUT_HOURS,
  REAPPLY_COOLDOWN_DAYS,
  seededRng,
} from "@kinextion/shared";
import { DAY_MS, HOUR_MS, ManualClock } from "../src/modules/community/clock.js";
import { CommunityError } from "../src/modules/community/errors.js";
import {
  acceptInvite,
  castAdmissionVote,
  createCommunity,
  createInvite,
  fastTrackAdmission,
  getCommunity,
  leaveCommunity,
  listMyAdmissionSeats,
  myJoinRequest,
  requestToJoin,
  type CommunityDeps,
} from "../src/modules/community/service.js";
import { runMaintenance } from "../src/modules/community/maintenance.js";
import { MemoryCommunityStore } from "./support/memory-community-store.js";

// ─── Fixtures ────────────────────────────────────────────────────

function setup(seed = 1) {
  const store = new MemoryCommunityStore();
  const clock = new ManualClock("2026-09-14T17:00:00Z");
  // Inferred rather than annotated, so fixtures can reach the memory store's state.
  const deps = { store, clock, rng: seededRng(seed) } satisfies CommunityDeps;
  return { store, clock, deps };
}

const user = (n: number) => `u${n}`;

/**
 * Found a community the way a founder would: u1 sends every invite while it's
 * forming, then u2…uN accept.
 */
async function found(deps: CommunityDeps, size = FOUNDING_QUORUM, name = "Test Community") {
  const { community } = await createCommunity(deps, user(1), { name });
  const tokens = [];
  for (let n = 2; n <= size; n++) tokens.push((await createInvite(deps, user(1), community.id)).token);
  for (let n = 2; n <= size; n++) await acceptInvite(deps, user(n), tokens[n - 2]);
  return community.id;
}

/**
 * A large active community. Founded properly with a quorum, then grown
 * directly in storage — admitting hundreds of people one vote at a time would
 * test nothing the smaller cases don't.
 */
async function foundLarge(deps: CommunityDeps & { store: MemoryCommunityStore }, size: number) {
  const id = await found(deps);
  for (let n = FOUNDING_QUORUM + 1; n <= size; n++) {
    await deps.store.upsertMembership({ communityId: id, userId: user(n), role: "member", at: deps.clock.now() });
  }
  return id;
}

async function expectRefusal(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err, `expected ${status} ${code}`).toBeInstanceOf(CommunityError);
  expect((err as CommunityError).statusCode).toBe(status);
  expect((err as CommunityError).code).toBe(code);
}

async function seatHolders(store: MemoryCommunityStore, applicantId: string) {
  const request = store.state.joinRequests.find((r) => r.userId === applicantId)!;
  return {
    request,
    live: store.state.seats.filter((s) => s.joinRequestId === request.id && !s.expiredAt).map((s) => s.userId),
    all: store.state.seats.filter((s) => s.joinRequestId === request.id),
  };
}

// ─── Founding ────────────────────────────────────────────────────

describe("founding a community", () => {
  it("starts forming, with the founder as its steward", async () => {
    const { deps } = setup();
    const detail = await createCommunity(deps, user(1), { name: "Favour House", description: "Sunday people" });
    expect(detail.community).toMatchObject({
      status: "forming",
      memberCount: 1,
      foundersNeeded: FOUNDING_QUORUM - 1,
      slug: "favour-house",
    });
    expect(detail.membership?.role).toBe("steward");
  });

  it("becomes real at exactly the founding quorum, not one founder before", async () => {
    const { deps } = setup();
    const id = await found(deps, FOUNDING_QUORUM - 1);
    expect((await getCommunity(deps, user(1), id)).community.status).toBe("forming");

    const { token } = await createInvite(deps, user(1), id);
    const result = await acceptInvite(deps, user(FOUNDING_QUORUM), token);
    expect(result.activated).toBe(true);
    expect(result.community).toMatchObject({ status: "active", memberCount: FOUNDING_QUORUM, foundersNeeded: null });
  });

  it("makes invites single-use", async () => {
    const { deps } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Hoopers" });
    const { token } = await createInvite(deps, user(1), community.id);
    await acceptInvite(deps, user(2), token);
    await expectRefusal(acceptInvite(deps, user(3), token), 410, "INVITE_USED");
  });

  it("expires invites", async () => {
    const { deps, clock } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Hoopers" });
    const { token } = await createInvite(deps, user(1), community.id);
    clock.advance(15 * DAY_MS);
    await expectRefusal(acceptInvite(deps, user(2), token), 410, "INVITE_EXPIRED");
  });

  it("doesn't spend an invite on someone who's already a member", async () => {
    const { deps, store } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Hoopers" });
    const { token } = await createInvite(deps, user(1), community.id);
    await expectRefusal(acceptInvite(deps, user(1), token), 409, "ALREADY_MEMBER");
    expect(store.state.invites[0].usedAt).toBeNull();
  });

  it("rolls the invite back if joining fails part-way", async () => {
    const { deps, store } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Hoopers" });
    const { token } = await createInvite(deps, user(1), community.id);

    const original = store.upsertMembership.bind(store);
    store.upsertMembership = async () => {
      throw new Error("database went away");
    };
    await expect(acceptInvite(deps, user(2), token)).rejects.toThrow("database went away");
    store.upsertMembership = original;

    // Still usable: the consumed-invite write didn't survive the failure.
    expect(store.state.invites[0].usedAt).toBeNull();
    await expect(acceptInvite(deps, user(2), token)).resolves.toMatchObject({ community: { memberCount: 2 } });
  });

  it("is invisible to non-members until it's real", async () => {
    const { deps } = setup();
    const id = await found(deps, FOUNDING_QUORUM - 1);
    await expectRefusal(getCommunity(deps, user(99), id), 404, "NOT_FOUND");

    const { token } = await createInvite(deps, user(1), id);
    await acceptInvite(deps, user(FOUNDING_QUORUM), token);
    const seen = await getCommunity(deps, user(99), id);
    expect(seen.community.status).toBe("active");
    expect(seen.membership).toBeNull();
  });

  it("stops issuing invites once active — the only way in is admission", async () => {
    const { deps } = setup();
    const id = await found(deps);
    await expectRefusal(createInvite(deps, user(1), id), 409, "NOT_FORMING");
  });

  it("honours invites sent while forming for the founding window after activation", async () => {
    const { deps, clock } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Old Friends" });
    const tokens = [];
    for (let n = 0; n < 8; n++) tokens.push((await createInvite(deps, user(1), community.id)).token);
    for (let n = 0; n < FOUNDING_QUORUM - 1; n++) await acceptInvite(deps, user(n + 2), tokens[n]);
    expect((await getCommunity(deps, user(1), community.id)).community.status).toBe("active");

    clock.advance(6 * DAY_MS);
    const late = await acceptInvite(deps, "slow-friend", tokens[6]);
    expect(late.activated).toBe(false);
    expect(late.membership?.role).toBe("member");

    clock.advance(2 * DAY_MS);
    await expectRefusal(acceptInvite(deps, "slower-friend", tokens[7]), 410, "INVITE_CLOSED");
  });

  it("won't let a non-member issue invites, and doesn't confirm the community exists", async () => {
    const { deps } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Hoopers" });
    await expectRefusal(createInvite(deps, user(2), community.id), 404, "NOT_FOUND");
  });

  it("limits how many communities one person can have forming", async () => {
    const { deps } = setup();
    for (let i = 0; i < MAX_FORMING_PER_FOUNDER; i++) {
      await createCommunity(deps, user(1), { name: `Group ${i}` });
    }
    await expectRefusal(createCommunity(deps, user(1), { name: "One more" }), 409, "TOO_MANY_FORMING");
  });

  it("gives a colliding name a distinct slug", async () => {
    const { deps } = setup();
    const a = await createCommunity(deps, user(1), { name: "Hoopers" });
    const b = await createCommunity(deps, user(2), { name: "Hoopers" });
    expect(a.community.slug).toBe("hoopers");
    expect(b.community.slug).toMatch(/^hoopers-[a-z0-9]{4}$/);
  });

  it("archives a community that never formed", async () => {
    const { deps, clock } = setup();
    const id = await found(deps, 3);
    clock.advance((FORMING_EXPIRY_DAYS + 1) * DAY_MS);
    const report = await runMaintenance(deps);
    expect(report.forming).toMatchObject({ checked: 1, archived: 1 });
    await expectRefusal(getCommunity(deps, user(99), id), 404, "NOT_FOUND");
  });

  it("archives a forming community when its last founder leaves", async () => {
    const { deps, store } = setup();
    const { community } = await createCommunity(deps, user(1), { name: "Solo" });
    await leaveCommunity(deps, user(1), community.id);
    expect(store.state.communities[0].status).toBe("archived");
  });
});

// ─── Small communities: everyone is asked ────────────────────────

describe("admission in a 12-member community", () => {
  async function twelve() {
    const env = setup();
    const id = await found(env.deps, 12);
    await requestToJoin(env.deps, "applicant", id, "I play Tuesdays");
    return { ...env, id };
  }

  it("asks every member, and tells the applicant only that it's pending", async () => {
    const { deps, store, id } = await twelve();
    const { live } = await seatHolders(store, "applicant");
    expect(live.sort()).toEqual(Array.from({ length: 12 }, (_, i) => user(i + 1)).sort());

    const view = await myJoinRequest(deps, "applicant", id);
    expect(Object.keys(view).sort()).toEqual(["canReapplyAt", "requestedAt", "status"]);
    expect(view.status).toBe("pending");
  });

  it("puts the application in front of each member", async () => {
    const { deps, store } = await twelve();
    store.setDisplayName("applicant", "Jordan");
    const seats = await listMyAdmissionSeats(deps, user(4));
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ applicant: { displayName: "Jordan" }, note: "I play Tuesdays" });
  });

  it("denies on a single objection, immediately", async () => {
    const { deps, store, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    for (const n of [1, 2, 3, 4]) await castAdmissionVote(deps, user(n), request.id, "belongs");
    await castAdmissionVote(deps, user(5), request.id, "objects");

    const view = await myJoinRequest(deps, "applicant", id);
    expect(view.status).toBe("denied");
    expect(view.canReapplyAt).toBe(new Date(deps.clock.now().getTime() + REAPPLY_COOLDOWN_DAYS * DAY_MS).toISOString());
  });

  it("waits for the last member while they could still object, then admits", async () => {
    const { deps, store, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    for (let n = 1; n <= 11; n++) await castAdmissionVote(deps, user(n), request.id, "belongs");
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("pending");

    await castAdmissionVote(deps, user(12), request.id, "belongs");
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("admitted");
    expect((await getCommunity(deps, "applicant", id)).membership?.role).toBe("member");
  });

  it("admits at the deadline on enough recognition — silence isn't an objection", async () => {
    const { deps, store, clock, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    for (const n of [1, 2, 3]) await castAdmissionVote(deps, user(n), request.id, "belongs");

    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    const report = await runMaintenance(deps);
    expect(report.admissions).toMatchObject({ checked: 1, admitted: 1 });
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("admitted");
  });

  it("fails closed: a quiet panel gets one more window, then the request is denied", async () => {
    const { deps, store, clock, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    await castAdmissionVote(deps, user(1), request.id, "belongs");
    await castAdmissionVote(deps, user(2), request.id, "belongs");

    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    expect((await runMaintenance(deps)).admissions.redrawn).toBe(1);
    expect(store.state.joinRequests[0].round).toBe(2);
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("pending");

    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    expect((await runMaintenance(deps)).admissions.denied).toBe(1);
    expect(store.state.joinRequests[0].decidedBy).toBe("timeout");
  });

  it("lets a quiet member still answer in the second window", async () => {
    const { deps, store, clock, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    for (const n of [1, 2]) await castAdmissionVote(deps, user(n), request.id, "belongs");
    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    await runMaintenance(deps);

    await castAdmissionVote(deps, user(3), request.id, "belongs");
    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    await runMaintenance(deps);
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("admitted");
  });

  it("refuses a second request while one is pending", async () => {
    const { deps, id } = await twelve();
    await expectRefusal(requestToJoin(deps, "applicant", id, undefined), 409, "REQUEST_PENDING");
  });

  it("enforces the reapply cooldown, then starts completely fresh", async () => {
    const { deps, store, clock, id } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    await castAdmissionVote(deps, user(1), request.id, "objects");

    clock.advance(10 * DAY_MS);
    await expectRefusal(requestToJoin(deps, "applicant", id, undefined), 409, "REAPPLY_COOLDOWN");

    clock.advance(REAPPLY_COOLDOWN_DAYS * DAY_MS);
    const view = await requestToJoin(deps, "applicant", id, undefined);
    expect(view.status).toBe("pending");
    // The old objection is gone with the old round.
    const { all } = await seatHolders(store, "applicant");
    expect(all.every((s) => s.verdict === null && s.round === 1)).toBe(true);
  });

  it("gives a caller without a seat nothing to learn", async () => {
    const { deps, store } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    await expectRefusal(castAdmissionVote(deps, "outsider", request.id, "objects"), 404, "NOT_FOUND");
    await expectRefusal(castAdmissionVote(deps, "applicant", request.id, "belongs"), 404, "NOT_FOUND");
    await expectRefusal(castAdmissionVote(deps, user(1), "no-such-request", "belongs"), 404, "NOT_FOUND");
  });

  it("records a verdict once and never lets it change", async () => {
    const { deps, store } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    await castAdmissionVote(deps, user(1), request.id, "belongs");
    await expectRefusal(castAdmissionVote(deps, user(1), request.id, "objects"), 409, "ALREADY_VOTED");
    expect(store.state.seats.find((s) => s.userId === user(1))?.verdict).toBe("belongs");
  });

  it("refuses votes once decided", async () => {
    const { deps, store } = await twelve();
    const { request } = await seatHolders(store, "applicant");
    await castAdmissionVote(deps, user(1), request.id, "objects");
    await expectRefusal(castAdmissionVote(deps, user(2), request.id, "belongs"), 409, "ALREADY_DECIDED");
  });
});

// ─── Larger communities: panels drawn by lot ─────────────────────

describe("admission in a 60-member community", () => {
  async function sixty(seed = 1) {
    const env = setup(seed);
    const id = await foundLarge(env.deps, 60);
    await requestToJoin(env.deps, "applicant", id, undefined);
    return { ...env, id };
  }

  it("draws a panel of 9 active members, never the applicant", async () => {
    const { store } = await sixty();
    const { live } = await seatHolders(store, "applicant");
    expect(live).toHaveLength(9);
    expect(new Set(live).size).toBe(9);
    expect(live).not.toContain("applicant");
  });

  it("isn't blocked by the single objection that would block a small community", async () => {
    const { deps, store, id } = await sixty();
    const { request, live } = await seatHolders(store, "applicant");
    await castAdmissionVote(deps, live[0], request.id, "objects");
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("pending");

    for (const member of live.slice(1, 7)) await castAdmissionVote(deps, member, request.id, "belongs");
    // Six belongs: one short.
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("pending");

    // The seventh settles it — one objection plus the one silent seat can't reach three.
    await castAdmissionVote(deps, live[7], request.id, "belongs");
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("admitted");

    // So the last panellist is told it's decided, and learns nothing else.
    await expectRefusal(castAdmissionVote(deps, live[8], request.id, "objects"), 409, "ALREADY_DECIDED");
  });

  it("replaces silent seats with fresh members, keeping every verdict already cast", async () => {
    const { deps, store, clock } = await sixty();
    const { request, live: round1 } = await seatHolders(store, "applicant");
    const [a, b, c, ...silent] = round1;
    for (const m of [a, b, c]) await castAdmissionVote(deps, m, request.id, "belongs");

    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    await runMaintenance(deps);

    const { all, live } = await seatHolders(store, "applicant");
    const fresh = all.filter((s) => s.round === 2).map((s) => s.userId);
    expect(fresh).toHaveLength(silent.length);
    expect(fresh.some((id) => round1.includes(id))).toBe(false);
    expect(live).toEqual(expect.arrayContaining([a, b, c, ...fresh]));
    expect(all.filter((s) => s.verdict === "belongs").map((s) => s.userId).sort()).toEqual([a, b, c].sort());

    // The replaced members' questions have passed to someone else.
    await expectRefusal(castAdmissionVote(deps, silent[0], request.id, "belongs"), 409, "SEAT_EXPIRED");
    // And the fresh ones can finish the job.
    for (const m of fresh.slice(0, 4)) await castAdmissionVote(deps, m, request.id, "belongs");
    expect(store.state.joinRequests[0].status).toBe("admitted");
  });

  it("spreads concurrent applications across different panellists", async () => {
    const { deps, store } = setup();
    const id = await foundLarge(deps, 16);
    await requestToJoin(deps, "first", id, undefined);
    await requestToJoin(deps, "second", id, undefined);
    const one = (await seatHolders(store, "first")).live;
    const two = (await seatHolders(store, "second")).live;
    // 16 members, two panels of 7: the second draw has 9 unloaded members to choose from.
    expect(one.filter((m) => two.includes(m))).toHaveLength(0);
  });
});

// ─── Leaving, and stewards ───────────────────────────────────────

describe("leaving", () => {
  it("expires the leaver's unanswered seats", async () => {
    const { deps, store } = setup();
    const id = await found(deps, 12);
    await requestToJoin(deps, "applicant", id, undefined);
    const { request } = await seatHolders(store, "applicant");

    await leaveCommunity(deps, user(7), id);
    await expectRefusal(castAdmissionVote(deps, user(7), request.id, "objects"), 409, "SEAT_EXPIRED");
  });

  it("means coming back goes through admission again", async () => {
    const { deps } = setup();
    const id = await found(deps, 8);
    await leaveCommunity(deps, user(8), id);
    expect((await getCommunity(deps, user(8), id)).membership).toBeNull();
    await expect(requestToJoin(deps, user(8), id, undefined)).resolves.toMatchObject({ status: "pending" });
  });

  it("can't leave a community you aren't in", async () => {
    const { deps } = setup();
    const id = await found(deps);
    await expectRefusal(leaveCommunity(deps, "outsider", id), 404, "NOT_FOUND");
  });
});

describe("steward fast-track", () => {
  async function withApplicant(size: number) {
    const env = setup();
    const id = size <= 15 ? await found(env.deps, size) : await foundLarge(env.deps, size);
    await requestToJoin(env.deps, "applicant", id, undefined);
    const { request } = await seatHolders(env.store, "applicant");
    return { ...env, id, requestId: request.id };
  }

  it.each([12, 150])("is refused by the API in a %i-member community", async (size) => {
    const { deps, requestId } = await withApplicant(size);
    await expectRefusal(
      fastTrackAdmission(deps, user(1), requestId, "Verified alumni email address"),
      403,
      "FAST_TRACK_UNAVAILABLE"
    );
  });

  it("admits on proof past 150 members", async () => {
    const { deps, store, id, requestId } = await withApplicant(151);
    await fastTrackAdmission(deps, user(1), requestId, "Verified alumni email address");
    expect((await myJoinRequest(deps, "applicant", id)).status).toBe("admitted");
    expect(store.state.joinRequests[0]).toMatchObject({
      decidedBy: "steward",
      fastTrackProof: "Verified alumni email address",
    });
  });

  it("is refused to a member who isn't a steward", async () => {
    const { deps, requestId } = await withApplicant(151);
    await expectRefusal(
      fastTrackAdmission(deps, user(2), requestId, "Verified alumni email address"),
      403,
      "NOT_STEWARD"
    );
  });
});

// ─── The job ─────────────────────────────────────────────────────

describe("maintenance", () => {
  it("is a no-op when run twice at the same instant", async () => {
    const { deps, clock } = setup();
    const id = await found(deps, 12);
    await requestToJoin(deps, "applicant", id, undefined);
    clock.advanceHours(PANEL_TIMEOUT_HOURS);

    expect((await runMaintenance(deps)).admissions.redrawn).toBe(1);
    const again = await runMaintenance(deps);
    expect(again.admissions).toEqual({ checked: 0, admitted: 0, denied: 0, redrawn: 0 });
  });

  it("writes nothing on a dry run", async () => {
    const { deps, store, clock } = setup();
    const id = await found(deps, 12);
    await requestToJoin(deps, "applicant", id, undefined);
    clock.advance(PANEL_TIMEOUT_HOURS * HOUR_MS);

    const before = structuredClone(store.state);
    const report = await runMaintenance(deps, { dryRun: true });
    expect(report).toMatchObject({ dryRun: true, admissions: { checked: 1, redrawn: 0 } });
    expect(store.state).toEqual(before);
  });
});
