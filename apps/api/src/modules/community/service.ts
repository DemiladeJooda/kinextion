/**
 * Communities: founding, admission, leaving.
 *
 * Every function takes its dependencies — storage, clock, randomness —
 * rather than importing them, so the whole lifecycle is testable against an
 * in-memory store with a clock that only moves when a test moves it.
 *
 * The shape of every value returned from here is deliberate. These are the
 * only objects routes send to clients, and several rules are enforced simply
 * by what they leave out: a voter's identity, a tally, a deadline that would
 * reveal a redraw. tests/community-routes.test.ts scans responses for those
 * keys, so adding one here fails the build.
 */

import {
  FORMING_EXPIRY_DAYS,
  FOUNDING_QUORUM,
  FOUNDING_WINDOW_DAYS,
  INVITE_TTL_DAYS,
  MAX_FORMING_PER_FOUNDER,
  MAX_OPEN_INVITES,
  PANEL_TIMEOUT_HOURS,
  REAPPLY_COOLDOWN_DAYS,
  STEWARD_FAST_TRACK_ROSTER,
  admissionRule,
  drawPanel,
  evaluateAdmission,
  slugifyCommunityName,
  type AdmissionOutcome,
  type AdmissionSeatView,
  type AdmissionVerdict,
  type CommunityDetail,
  type CommunityView,
  type CreateCommunityInput,
  type InvitePreview,
  type JoinRequestView,
  type MembershipView,
} from "@kinextion/shared";
import type { TopicGenerator } from "@kinextion/ai-core";
import type { MediaStorage } from "../../lib/media/storage.js";
import { DAY_MS, HOUR_MS, type Clock, type Rng } from "./clock.js";
import { CommunityError, notFound } from "./errors.js";
import type {
  CommunityRecord,
  CommunityStore,
  JoinRequestRecord,
  MediaAssetRecord,
  MembershipRecord,
} from "./store.js";
import { hashInviteToken, newInviteToken } from "./tokens.js";

export interface CommunityDeps {
  store: CommunityStore;
  clock: Clock;
  rng: Rng;
  /**
   * The model call behind Kairo's topic synthesis. Absent, every ballot comes
   * from the prompt bank — the week still gets a question.
   */
  generateTopics?: TopicGenerator;
  /** Object storage for responses. Absent, media routes answer 503 and nothing else breaks. */
  media?: MediaStorage | null;
  /**
   * Refuses a submission that isn't genuine participation — a silent file, a
   * re-upload — before it can unlock a room. Throws to refuse. Wired to the
   * integrity module in production.
   */
  checkIntegrity?: (userId: string, asset: MediaAssetRecord) => Promise<void>;
}

// ─── Views ───────────────────────────────────────────────────────
// Shapes are defined in packages/shared (community/views.ts) so clients and
// server agree on them; these build them from records.

export function communityView(c: CommunityRecord, memberCount: number): CommunityView {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    status: c.status,
    memberCount,
    foundersNeeded: c.status === "forming" ? Math.max(0, FOUNDING_QUORUM - memberCount) : null,
    createdAt: c.createdAt.toISOString(),
    activatedAt: c.activatedAt?.toISOString() ?? null,
  };
}

function membershipView(m: MembershipRecord): MembershipView {
  return { role: m.role, joinedAt: m.joinedAt.toISOString() };
}

function joinRequestView(r: JoinRequestRecord): JoinRequestView {
  const reapply =
    r.status === "denied" && r.decidedAt
      ? new Date(r.decidedAt.getTime() + REAPPLY_COOLDOWN_DAYS * DAY_MS)
      : null;
  return {
    status: r.status,
    requestedAt: r.createdAt.toISOString(),
    canReapplyAt: reapply?.toISOString() ?? null,
  };
}

export const isActive = (m: MembershipRecord | null): m is MembershipRecord =>
  !!m && m.leftAt === null;

// ─── Founding ────────────────────────────────────────────────────

async function uniqueSlug(deps: CommunityDeps, name: string): Promise<string> {
  const base = slugifyCommunityName(name);
  if (!(await deps.store.slugTaken(base))) return base;
  for (let i = 0; i < 8; i++) {
    const suffix = Math.floor(deps.rng() * 36 ** 4)
      .toString(36)
      .padStart(4, "0");
    const candidate = `${base.slice(0, 35)}-${suffix}`;
    if (!(await deps.store.slugTaken(candidate))) return candidate;
  }
  throw new CommunityError(409, "SLUG_UNAVAILABLE", "Try a slightly different name");
}

/**
 * Start a community. It's created `forming`, with the founder as its first
 * member, and becomes real only once FOUNDING_QUORUM people have accepted —
 * nobody is ever placed in a group they didn't agree to.
 */
export async function createCommunity(
  deps: CommunityDeps,
  userId: string,
  input: CreateCommunityInput
): Promise<CommunityDetail> {
  const now = deps.clock.now();

  if ((await deps.store.countFormingCreatedBy(userId)) >= MAX_FORMING_PER_FOUNDER) {
    throw new CommunityError(
      409,
      "TOO_MANY_FORMING",
      `You have ${MAX_FORMING_PER_FOUNDER} communities still forming. Finish one before starting another.`
    );
  }

  const slug = await uniqueSlug(deps, input.name);

  return deps.store.transaction(async (tx) => {
    const community = await tx.createCommunity({
      slug,
      name: input.name,
      description: input.description || null,
      createdById: userId,
      at: now,
    });
    const membership = await tx.upsertMembership({
      communityId: community.id,
      userId,
      role: "steward",
      at: now,
    });
    return {
      community: communityView(community, 1),
      membership: membershipView(membership),
      joinRequest: null,
    };
  });
}

/**
 * Invite a founder. Only forming communities issue invites: once a community
 * is active the only way in is admission, so an invite can never be used to
 * skip recognition.
 */
export async function createInvite(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<{ token: string; expiresAt: string }> {
  const now = deps.clock.now();
  const community = await deps.store.findCommunity(communityId);
  const membership = community ? await deps.store.findMembership(communityId, userId) : null;
  if (!community || !isActive(membership)) throw notFound("Community");

  if (community.status !== "forming") {
    throw new CommunityError(
      409,
      "NOT_FORMING",
      "This community has already formed. New members join by asking the community."
    );
  }
  if ((await deps.store.countOpenInvites(communityId, now)) >= MAX_OPEN_INVITES) {
    throw new CommunityError(
      409,
      "TOO_MANY_INVITES",
      `This community already has ${MAX_OPEN_INVITES} open invites.`
    );
  }

  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS);
  await deps.store.createInvite({ communityId, tokenHash, invitedById: userId, expiresAt, at: now });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function openInvite(deps: CommunityDeps, token: string) {
  const now = deps.clock.now();
  const invite = await deps.store.findInviteByTokenHash(hashInviteToken(token));
  if (!invite) throw notFound("Invite");

  const community = await deps.store.findCommunity(invite.communityId);
  if (!community) throw notFound("Invite");

  // Holding the token is the authorisation, so distinguishing these is safe
  // and tells the invitee what to do next.
  const foundingWindowOpen =
    community.status === "forming" ||
    (community.status === "active" &&
      community.activatedAt !== null &&
      now.getTime() < community.activatedAt.getTime() + FOUNDING_WINDOW_DAYS * DAY_MS);
  if (!foundingWindowOpen) {
    throw new CommunityError(
      410,
      "INVITE_CLOSED",
      community.status === "active"
        ? "This community has already formed — ask to join it instead."
        : "This community is no longer forming."
    );
  }
  if (invite.usedAt) throw new CommunityError(410, "INVITE_USED", "This invite has already been used.");
  if (invite.expiresAt <= now) {
    throw new CommunityError(410, "INVITE_EXPIRED", "This invite has expired. Ask for a new one.");
  }
  return { invite, community, now };
}

export async function previewInvite(deps: CommunityDeps, token: string): Promise<InvitePreview> {
  const { invite, community } = await openInvite(deps, token);
  const [memberCount, names] = await Promise.all([
    deps.store.countActiveMembers(community.id),
    deps.store.displayNames([invite.invitedById]),
  ]);
  return {
    community: communityView(community, memberCount),
    invitedBy: names.get(invite.invitedById) ?? null,
  };
}

/** Promote a forming community once it has enough founders. Idempotent. */
async function activateIfQuorum(deps: CommunityDeps, communityId: string): Promise<boolean> {
  const count = await deps.store.countActiveMembers(communityId);
  if (count < FOUNDING_QUORUM) return false;
  return deps.store.transitionCommunity(communityId, "forming", "active", deps.clock.now());
}

/**
 * Accept a founding invite — agreeing the community is real, that you belong
 * to it, and that you want to be part of it.
 */
export async function acceptInvite(
  deps: CommunityDeps,
  userId: string,
  token: string
): Promise<CommunityDetail & { activated: boolean }> {
  const { invite, community, now } = await openInvite(deps, token);

  if (isActive(await deps.store.findMembership(community.id, userId))) {
    throw new CommunityError(409, "ALREADY_MEMBER", "You're already part of this community.");
  }

  const membership = await deps.store.transaction(async (tx) => {
    if (!(await tx.consumeInvite(invite.id, userId, now))) {
      throw new CommunityError(410, "INVITE_USED", "This invite has already been used.");
    }
    return tx.upsertMembership({ communityId: community.id, userId, role: "member", at: now });
  });

  // Outside the transaction on purpose: two founders accepting at the same
  // moment can each count five in their own transaction. Whoever commits last
  // always sees both, so checking after commit can't miss the quorum.
  const activated = await activateIfQuorum(deps, community.id);
  const [fresh, memberCount] = await Promise.all([
    deps.store.findCommunity(community.id),
    deps.store.countActiveMembers(community.id),
  ]);

  return {
    community: communityView(fresh ?? community, memberCount),
    membership: membershipView(membership),
    joinRequest: null,
    activated,
  };
}

// ─── Reading ─────────────────────────────────────────────────────

export async function listMyCommunities(deps: CommunityDeps, userId: string): Promise<CommunityDetail[]> {
  const rows = await deps.store.listMyCommunities(userId);
  return rows.map((r) => ({
    community: communityView(r.community, r.memberCount),
    membership: membershipView(r.membership),
    joinRequest: null,
  }));
}

/**
 * A community as `userId` may see it. Members see their community in any
 * state; everyone else sees only active communities — a forming community is
 * invisible until it's real, and an archived one is gone.
 */
export async function getCommunity(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<CommunityDetail> {
  const community = await deps.store.findCommunity(communityId);
  if (!community) throw notFound("Community");

  const membership = await deps.store.findMembership(communityId, userId);
  const member = isActive(membership);
  if (!member && community.status !== "active") throw notFound("Community");

  const [memberCount, request] = await Promise.all([
    deps.store.countActiveMembers(communityId),
    member ? null : deps.store.findJoinRequestFor(communityId, userId),
  ]);

  return {
    community: communityView(community, memberCount),
    membership: member ? membershipView(membership) : null,
    joinRequest: request ? joinRequestView(request) : null,
  };
}

// ─── Admission ───────────────────────────────────────────────────

/** Ask a community to recognise you. */
export async function requestToJoin(
  deps: CommunityDeps,
  userId: string,
  communityId: string,
  note: string | undefined
): Promise<JoinRequestView> {
  const now = deps.clock.now();
  const community = await deps.store.findCommunity(communityId);
  if (!community || community.status !== "active") throw notFound("Community");

  if (isActive(await deps.store.findMembership(communityId, userId))) {
    throw new CommunityError(409, "ALREADY_MEMBER", "You're already part of this community.");
  }

  const previous = await deps.store.findJoinRequestFor(communityId, userId);
  if (previous?.status === "pending") {
    throw new CommunityError(409, "REQUEST_PENDING", "You've already asked to join. The community is deciding.");
  }
  if (previous?.status === "denied") {
    const { canReapplyAt } = joinRequestView(previous);
    if (canReapplyAt && new Date(canReapplyAt) > now) {
      throw new CommunityError(
        409,
        "REAPPLY_COOLDOWN",
        `You can ask this community again from ${canReapplyAt.slice(0, 10)}.`
      );
    }
  }

  const memberIds = await deps.store.listActiveMemberIds(communityId);
  if (memberIds.length === 0) {
    throw new CommunityError(409, "NO_MEMBERS", "This community has no active members to recognise you.");
  }
  const rule = admissionRule(memberIds.length);

  const panel =
    rule.panelMode === "all"
      ? memberIds
      : drawPanel(
          [...(await deps.store.openSeatCounts(memberIds))].map(([id, openSeats]) => ({
            userId: id,
            openSeats,
          })),
          rule.panelSize,
          deps.rng
        );

  const request = await deps.store.transaction(async (tx) => {
    const created = await tx.resetJoinRequest({
      communityId,
      userId,
      note: note || null,
      panelMode: rule.panelMode,
      panelSize: rule.panelSize,
      minBelongs: rule.minBelongs,
      maxObjections: rule.maxObjections,
      deadlineAt: new Date(now.getTime() + PANEL_TIMEOUT_HOURS * HOUR_MS),
      at: now,
    });
    await tx.createSeats(created.id, panel, 1);
    return created;
  });

  return joinRequestView(request);
}

export async function myJoinRequest(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<JoinRequestView> {
  const request = await deps.store.findJoinRequestFor(communityId, userId);
  if (!request) throw notFound("Join request");
  return joinRequestView(request);
}

/** The applications waiting on `userId`'s verdict, across every community. */
export async function listMyAdmissionSeats(
  deps: CommunityDeps,
  userId: string
): Promise<AdmissionSeatView[]> {
  const rows = await deps.store.listOpenSeatsFor(userId);
  const names = await deps.store.displayNames(rows.map((r) => r.joinRequest.userId));
  return rows.map(({ joinRequest, community }) => ({
    joinRequestId: joinRequest.id,
    community: { id: community.id, name: community.name, slug: community.slug },
    applicant: { displayName: names.get(joinRequest.userId) ?? null },
    note: joinRequest.note,
    respondBy: joinRequest.deadlineAt.toISOString(),
  }));
}

/**
 * Apply whatever the seats now say. Safe to call with a stale view: anything
 * it counts is a real, committed verdict, and every silent seat is treated as
 * a possible objection — so it can delay a decision, never make a wrong one.
 */
async function settleRequest(
  deps: CommunityDeps,
  tx: CommunityStore,
  request: JoinRequestRecord,
  now: Date
): Promise<AdmissionOutcome> {
  const seats = await tx.listSeats(request.id);
  const outcome = evaluateAdmission({
    rule: request,
    seats: seats.map((s) => ({ verdict: s.verdict, expired: s.expiredAt !== null })),
    round: request.round,
    deadlinePassed: now >= request.deadlineAt,
  });

  if (outcome === "admitted") {
    if (await tx.decideJoinRequest(request.id, { status: "admitted", decidedBy: "panel", at: now })) {
      await tx.upsertMembership({
        communityId: request.communityId,
        userId: request.userId,
        role: "member",
        at: now,
      });
    }
  } else if (outcome === "denied") {
    const objections = seats.filter((s) => s.verdict === "objects").length;
    await tx.decideJoinRequest(request.id, {
      status: "denied",
      decidedBy: objections > request.maxObjections ? "panel" : "timeout",
      at: now,
    });
  } else if (outcome === "redraw") {
    await redraw(deps, tx, request, seats, now);
  }
  return outcome;
}

/**
 * Give a quiet panel one more window.
 *
 * An all-member panel keeps everyone's seat and adds anyone who has joined
 * since. A sampled panel replaces its silent seats with fresh draws — members
 * who haven't sat on this request — and keeps any silent seats it has no one
 * to replace them with. Cast verdicts always carry over.
 */
async function redraw(
  deps: CommunityDeps,
  tx: CommunityStore,
  request: JoinRequestRecord,
  seats: Awaited<ReturnType<CommunityStore["listSeats"]>>,
  now: Date
): Promise<void> {
  const seated = new Set(seats.map((s) => s.userId));
  const fresh = (await tx.listActiveMemberIds(request.communityId)).filter(
    (id) => !seated.has(id) && id !== request.userId
  );

  if (request.panelMode === "all") {
    await tx.createSeats(request.id, fresh, 2);
  } else {
    const silent = seats.filter((s) => s.verdict === null && s.expiredAt === null);
    const counts = await tx.openSeatCounts(fresh);
    const drawn = drawPanel(
      fresh.map((id) => ({ userId: id, openSeats: counts.get(id) ?? 0 })),
      silent.length,
      deps.rng
    );
    await tx.expireSeats(
      request.id,
      silent.slice(0, drawn.length).map((s) => s.userId),
      now
    );
    await tx.createSeats(request.id, drawn, 2);
  }

  await tx.startRound(request.id, 2, new Date(now.getTime() + PANEL_TIMEOUT_HOURS * HOUR_MS));
}

/**
 * Cast a verdict on an application. The answer is always the same two words
 * — nothing about the tally, the panel, or the outcome comes back.
 */
export async function castAdmissionVote(
  deps: CommunityDeps,
  userId: string,
  joinRequestId: string,
  verdict: AdmissionVerdict
): Promise<{ recorded: true }> {
  const now = deps.clock.now();
  const request = await deps.store.findJoinRequest(joinRequestId);
  const seat = request
    ? (await deps.store.listSeats(joinRequestId)).find((s) => s.userId === userId)
    : undefined;

  // Without a seat, the request doesn't exist as far as this caller knows.
  if (!request || !seat) throw notFound("Admission request");
  if (request.status !== "pending") {
    throw new CommunityError(409, "ALREADY_DECIDED", "This request has already been decided.");
  }
  if (seat.verdict) throw new CommunityError(409, "ALREADY_VOTED", "You've already answered this one.");
  if (seat.expiredAt) {
    throw new CommunityError(409, "SEAT_EXPIRED", "This question passed to someone else.");
  }

  await deps.store.transaction(async (tx) => {
    if (!(await tx.castVerdict(joinRequestId, userId, verdict, now))) {
      throw new CommunityError(409, "ALREADY_VOTED", "You've already answered this one.");
    }
    // Re-read inside the transaction: a sweep may have redrawn the panel since.
    const current = await tx.findJoinRequest(joinRequestId);
    if (current?.status === "pending") await settleRequest(deps, tx, current, now);
  });

  // A concurrent vote may have been invisible inside that transaction. One
  // more look after commit means the last voter always triggers the decision.
  const latest = await deps.store.findJoinRequest(joinRequestId);
  if (latest?.status === "pending") {
    await deps.store.transaction((tx) => settleRequest(deps, tx, latest, now));
  }

  return { recorded: true };
}

async function requireFastTrackSteward(deps: CommunityDeps, userId: string, communityId: string) {
  const membership = await deps.store.findMembership(communityId, userId);
  if (!isActive(membership)) throw notFound("Community");
  if (membership.role !== "steward") {
    throw new CommunityError(403, "NOT_STEWARD", "Only a steward can do this.");
  }
  const roster = await deps.store.countActiveMembers(communityId);
  if (!admissionRule(roster).stewardFastTrack) {
    throw new CommunityError(
      403,
      "FAST_TRACK_UNAVAILABLE",
      `Stewards can only admit on proof in communities of more than ${STEWARD_FAST_TRACK_ROSTER} members. Below that, the community decides.`
    );
  }
}

/** Pending applications a steward of a large community may fast-track. */
export async function listFastTrackCandidates(deps: CommunityDeps, userId: string, communityId: string) {
  await requireFastTrackSteward(deps, userId, communityId);
  const pending = await deps.store.listPendingForCommunity(communityId);
  const names = await deps.store.displayNames(pending.map((r) => r.userId));
  return pending.map((r) => ({
    joinRequestId: r.id,
    applicant: { displayName: names.get(r.userId) ?? null },
    note: r.note,
    requestedAt: r.createdAt.toISOString(),
  }));
}

/**
 * Admit on external proof. Only in communities past STEWARD_FAST_TRACK_ROSTER,
 * where nobody can be expected to recognise every applicant. Below that the
 * API refuses outright — not just the UI.
 */
export async function fastTrackAdmission(
  deps: CommunityDeps,
  userId: string,
  joinRequestId: string,
  proof: string
): Promise<{ recorded: true }> {
  const now = deps.clock.now();
  const request = await deps.store.findJoinRequest(joinRequestId);
  if (!request) throw notFound("Admission request");
  await requireFastTrackSteward(deps, userId, request.communityId);
  if (request.status !== "pending") {
    throw new CommunityError(409, "ALREADY_DECIDED", "This request has already been decided.");
  }

  await deps.store.transaction(async (tx) => {
    const decided = await tx.decideJoinRequest(request.id, {
      status: "admitted",
      decidedBy: "steward",
      at: now,
      fastTrackProof: proof,
    });
    if (!decided) {
      throw new CommunityError(409, "ALREADY_DECIDED", "This request has already been decided.");
    }
    await tx.upsertMembership({
      communityId: request.communityId,
      userId: request.userId,
      role: "member",
      at: now,
    });
  });
  return { recorded: true };
}

// ─── Leaving ─────────────────────────────────────────────────────

/** Leave whenever you like. Nobody is trapped in a group. */
export async function leaveCommunity(
  deps: CommunityDeps,
  userId: string,
  communityId: string
): Promise<{ left: true }> {
  const now = deps.clock.now();
  const community = await deps.store.findCommunity(communityId);
  if (!community) throw notFound("Community");

  await deps.store.transaction(async (tx) => {
    if (!(await tx.endMembership(communityId, userId, now))) throw notFound("Community");
    await tx.expireSilentSeatsForMember(communityId, userId, now);
  });

  // A forming community its last founder walks away from isn't forming anything.
  if (community.status === "forming" && (await deps.store.countActiveMembers(communityId)) === 0) {
    await deps.store.transitionCommunity(communityId, "forming", "archived", now);
  }
  return { left: true };
}

// ─── Maintenance ─────────────────────────────────────────────────

export interface AdmissionMaintenanceReport {
  admissions: { checked: number; admitted: number; denied: number; redrawn: number };
  forming: { checked: number; activated: number; archived: number };
}

/**
 * The admission half of maintenance: panel deadlines, and forming communities
 * that never formed. Orchestrated with the rest in maintenance.ts.
 */
export async function runAdmissionMaintenance(
  deps: CommunityDeps,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<AdmissionMaintenanceReport> {
  const now = deps.clock.now();
  const cutoff = new Date(now.getTime() - FORMING_EXPIRY_DAYS * DAY_MS);
  const report: AdmissionMaintenanceReport = {
    admissions: { checked: 0, admitted: 0, denied: 0, redrawn: 0 },
    forming: { checked: 0, activated: 0, archived: 0 },
  };

  if (dryRun) {
    report.admissions.checked = (await deps.store.listPendingDue(now)).length;
    report.forming.checked = (await deps.store.listFormingCreatedBefore(cutoff)).length;
    return report;
  }

  for (const due of await deps.store.listPendingDue(now)) {
    report.admissions.checked++;
    const outcome = await deps.store.transaction(async (tx) => {
      const current = await tx.findJoinRequest(due.id);
      if (!current || current.status !== "pending" || current.deadlineAt > now) return "pending";
      return settleRequest(deps, tx, current, now);
    });
    if (outcome === "admitted") report.admissions.admitted++;
    else if (outcome === "denied") report.admissions.denied++;
    else if (outcome === "redraw") report.admissions.redrawn++;
  }

  for (const community of await deps.store.listFormingCreatedBefore(cutoff)) {
    report.forming.checked++;
    // Repair first: a quorum reached in a race should activate, not expire.
    if (await activateIfQuorum(deps, community.id)) report.forming.activated++;
    else if (await deps.store.transitionCommunity(community.id, "forming", "archived", now)) {
      report.forming.archived++;
    }
  }

  return report;
}
