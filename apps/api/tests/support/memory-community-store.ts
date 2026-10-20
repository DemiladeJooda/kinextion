/**
 * An in-memory CommunityStore for tests.
 *
 * Implements the same contract as PrismaCommunityStore, including the parts
 * that matter for invariants: racing writes report whether they won, and a
 * transaction that throws leaves no trace. Records are copied on the way in
 * and out, so a test can't accidentally mutate stored state by reference.
 */

import { DuplicateResponseError } from "../../src/modules/community/store.js";
import type {
  ChestEntryRecord,
  ChestProposalRecord,
  ChestProposalStatus,
  PublicResponseRow,
  CycleResultRecord,
  CommentRecord,
  ReactionVerdict,
  CircleRecord,
  ResponseVisibility,
  RoomResponseRecord,
  MediaAssetRecord,
  MediaKind,
  ActiveChoiceRecord,
  BallotKind,
  BallotOptionRecord,
  BallotRecord,
  BallotStatus,
  RecentTopicRow,
  TopicRecord,
  CycleRecord,
  CommunityRecord,
  CommunityStatus,
  CommunityStore,
  DecidedBy,
  InviteRecord,
  JoinRequestRecord,
  MembershipRecord,
  MembershipRole,
  MyCommunityRow,
  NewJoinRequest,
  OpenSeatRow,
  SeatRecord,
  Verdict,
} from "../../src/modules/community/store.js";

interface State {
  communities: CommunityRecord[];
  memberships: MembershipRecord[];
  invites: InviteRecord[];
  joinRequests: JoinRequestRecord[];
  seats: SeatRecord[];
  names: Map<string, string | null>;
  cycles: CycleRecord[];
  activeChoices: ActiveChoiceRecord[];
  suggestions: { id: string; cycleId: string; userId: string; text: string; at: Date }[];
  ballots: BallotRecord[];
  ballotOptions: BallotOptionRecord[];
  ballotVotes: { ballotId: string; optionId: string; userId: string; at: Date }[];
  topics: TopicRecord[];
  media: MediaAssetRecord[];
  responses: RoomResponseRecord[];
  circles: CircleRecord[];
  circleSeats: { circleId: string; cycleId: string; userId: string }[];
  reactions: { responseId: string; userId: string; verdict: ReactionVerdict; at: Date }[];
  comments: CommentRecord[];
  commentLikes: { commentId: string; userId: string }[];
  reports: {
    reporterId: string;
    responseId: string | null;
    commentId: string | null;
    reason: string;
    note: string | null;
    at: Date;
  }[];
  results: CycleResultRecord[];
  strikes: {
    userId: string;
    reason: string;
    severity: "low" | "medium" | "high";
    responseId: string | null;
    expiresAt: Date;
    at: Date;
  }[];
  chestEntries: ChestEntryRecord[];
  chestProposals: ChestProposalRecord[];
  nextId: number;
}

const copy = <T extends object>(r: T): T => ({ ...r });

export class MemoryCommunityStore implements CommunityStore {
  state: State = {
    communities: [],
    memberships: [],
    invites: [],
    joinRequests: [],
    seats: [],
    names: new Map(),
    cycles: [],
    activeChoices: [],
    suggestions: [],
    ballots: [],
    ballotOptions: [],
    ballotVotes: [],
    topics: [],
    media: [],
    responses: [],
    circles: [],
    circleSeats: [],
    reactions: [],
    comments: [],
    commentLikes: [],
    reports: [],
    results: [],
    strikes: [],
    chestEntries: [],
    chestProposals: [],
    nextId: 1,
  };
  private inTransaction = false;

  private id(prefix: string): string {
    return `${prefix}_${this.state.nextId++}`;
  }

  setDisplayName(userId: string, name: string | null): void {
    this.state.names.set(userId, name);
  }

  async transaction<T>(fn: (tx: CommunityStore) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    const snapshot = structuredClone(this.state);
    this.inTransaction = true;
    try {
      return await fn(this);
    } catch (err) {
      this.state = snapshot;
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  // ── Communities ────────────────────────────────────────────────

  async createCommunity(input: {
    slug: string;
    name: string;
    description: string | null;
    createdById: string;
    at: Date;
  }): Promise<CommunityRecord> {
    if (this.state.communities.some((c) => c.slug === input.slug)) {
      throw new Error("Unique constraint failed on slug");
    }
    const record: CommunityRecord = {
      id: this.id("community"),
      slug: input.slug,
      name: input.name,
      description: input.description,
      status: "forming",
      createdById: input.createdById,
      createdAt: input.at,
      activatedAt: null,
      archivedAt: null,
    };
    this.state.communities.push(record);
    return copy(record);
  }

  async findCommunity(id: string) {
    const c = this.state.communities.find((x) => x.id === id);
    return c ? copy(c) : null;
  }

  async slugTaken(slug: string) {
    return this.state.communities.some((c) => c.slug === slug);
  }

  async transitionCommunity(id: string, from: CommunityStatus, to: CommunityStatus, at: Date) {
    const c = this.state.communities.find((x) => x.id === id && x.status === from);
    if (!c) return false;
    c.status = to;
    if (to === "active") c.activatedAt = at;
    if (to === "archived") c.archivedAt = at;
    return true;
  }

  async listFormingCreatedBefore(cutoff: Date) {
    return this.state.communities
      .filter((c) => c.status === "forming" && c.createdAt < cutoff)
      .map(copy);
  }

  async countFormingCreatedBy(userId: string) {
    return this.state.communities.filter((c) => c.createdById === userId && c.status === "forming")
      .length;
  }

  // ── Membership ─────────────────────────────────────────────────

  async upsertMembership(input: { communityId: string; userId: string; role: MembershipRole; at: Date }) {
    let m = this.state.memberships.find(
      (x) => x.communityId === input.communityId && x.userId === input.userId
    );
    if (m) {
      m.leftAt = null;
      m.joinedAt = input.at;
      m.role = input.role;
    } else {
      m = {
        id: this.id("membership"),
        communityId: input.communityId,
        userId: input.userId,
        role: input.role,
        joinedAt: input.at,
        leftAt: null,
      };
      this.state.memberships.push(m);
    }
    return copy(m);
  }

  async findMembership(communityId: string, userId: string) {
    const m = this.state.memberships.find((x) => x.communityId === communityId && x.userId === userId);
    return m ? copy(m) : null;
  }

  async endMembership(communityId: string, userId: string, at: Date) {
    const m = this.state.memberships.find(
      (x) => x.communityId === communityId && x.userId === userId && x.leftAt === null
    );
    if (!m) return false;
    m.leftAt = at;
    return true;
  }

  async countActiveMembers(communityId: string) {
    return this.state.memberships.filter((m) => m.communityId === communityId && m.leftAt === null).length;
  }

  async listActiveMemberIds(communityId: string) {
    return this.state.memberships
      .filter((m) => m.communityId === communityId && m.leftAt === null)
      .map((m) => m.userId);
  }

  async listMyCommunities(userId: string): Promise<MyCommunityRow[]> {
    const rows: MyCommunityRow[] = [];
    for (const m of this.state.memberships) {
      if (m.userId !== userId || m.leftAt !== null) continue;
      const c = this.state.communities.find((x) => x.id === m.communityId);
      if (!c || c.status === "archived") continue;
      rows.push({
        community: copy(c),
        membership: copy(m),
        memberCount: await this.countActiveMembers(c.id),
      });
    }
    return rows;
  }

  // ── Founding invites ───────────────────────────────────────────

  async createInvite(input: {
    communityId: string;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
    at: Date;
  }) {
    const record: InviteRecord = {
      id: this.id("invite"),
      communityId: input.communityId,
      tokenHash: input.tokenHash,
      invitedById: input.invitedById,
      expiresAt: input.expiresAt,
      usedAt: null,
      usedById: null,
      createdAt: input.at,
    };
    this.state.invites.push(record);
    return copy(record);
  }

  async findInviteByTokenHash(tokenHash: string) {
    const i = this.state.invites.find((x) => x.tokenHash === tokenHash);
    return i ? copy(i) : null;
  }

  async countOpenInvites(communityId: string, now: Date) {
    return this.state.invites.filter(
      (i) => i.communityId === communityId && i.usedAt === null && i.expiresAt > now
    ).length;
  }

  async consumeInvite(id: string, userId: string, at: Date) {
    const i = this.state.invites.find((x) => x.id === id && x.usedAt === null);
    if (!i) return false;
    i.usedAt = at;
    i.usedById = userId;
    return true;
  }

  // ── Join requests ──────────────────────────────────────────────

  async findJoinRequest(id: string) {
    const r = this.state.joinRequests.find((x) => x.id === id);
    return r ? copy(r) : null;
  }

  async findJoinRequestFor(communityId: string, userId: string) {
    const r = this.state.joinRequests.find((x) => x.communityId === communityId && x.userId === userId);
    return r ? copy(r) : null;
  }

  async resetJoinRequest(input: NewJoinRequest) {
    const fresh = {
      note: input.note,
      status: "pending" as const,
      panelMode: input.panelMode,
      panelSize: input.panelSize,
      minBelongs: input.minBelongs,
      maxObjections: input.maxObjections,
      round: 1,
      deadlineAt: input.deadlineAt,
      decidedAt: null,
      decidedBy: null,
      fastTrackProof: null,
      createdAt: input.at,
    };
    let r = this.state.joinRequests.find(
      (x) => x.communityId === input.communityId && x.userId === input.userId
    );
    if (r) {
      const id = r.id;
      this.state.seats = this.state.seats.filter((s) => s.joinRequestId !== id);
      Object.assign(r, fresh);
    } else {
      r = { id: this.id("request"), communityId: input.communityId, userId: input.userId, ...fresh };
      this.state.joinRequests.push(r);
    }
    return copy(r);
  }

  async decideJoinRequest(
    id: string,
    input: { status: "admitted" | "denied"; decidedBy: DecidedBy; at: Date; fastTrackProof?: string }
  ) {
    const r = this.state.joinRequests.find((x) => x.id === id && x.status === "pending");
    if (!r) return false;
    r.status = input.status;
    r.decidedBy = input.decidedBy;
    r.decidedAt = input.at;
    if (input.fastTrackProof) r.fastTrackProof = input.fastTrackProof;
    return true;
  }

  async startRound(id: string, round: number, deadlineAt: Date) {
    const r = this.state.joinRequests.find((x) => x.id === id);
    if (r) {
      r.round = round;
      r.deadlineAt = deadlineAt;
    }
  }

  async listPendingDue(now: Date) {
    return this.state.joinRequests
      .filter((r) => r.status === "pending" && r.deadlineAt <= now)
      .map(copy);
  }

  async listPendingForCommunity(communityId: string) {
    return this.state.joinRequests
      .filter((r) => r.communityId === communityId && r.status === "pending")
      .map(copy);
  }

  // ── Seats ──────────────────────────────────────────────────────

  async createSeats(joinRequestId: string, userIds: string[], round: number) {
    for (const userId of userIds) {
      if (this.state.seats.some((s) => s.joinRequestId === joinRequestId && s.userId === userId)) continue;
      this.state.seats.push({
        id: this.id("seat"),
        joinRequestId,
        userId,
        round,
        verdict: null,
        votedAt: null,
        expiredAt: null,
      });
    }
  }

  async listSeats(joinRequestId: string) {
    return this.state.seats.filter((s) => s.joinRequestId === joinRequestId).map(copy);
  }

  async castVerdict(joinRequestId: string, userId: string, verdict: Verdict, at: Date) {
    const s = this.state.seats.find(
      (x) =>
        x.joinRequestId === joinRequestId && x.userId === userId && x.verdict === null && x.expiredAt === null
    );
    if (!s) return false;
    s.verdict = verdict;
    s.votedAt = at;
    return true;
  }

  async expireSeats(joinRequestId: string, userIds: string[], at: Date) {
    for (const s of this.state.seats) {
      if (s.joinRequestId === joinRequestId && userIds.includes(s.userId) && s.verdict === null && s.expiredAt === null) {
        s.expiredAt = at;
      }
    }
  }

  async expireSilentSeatsForMember(communityId: string, userId: string, at: Date) {
    const pending = new Set(
      this.state.joinRequests
        .filter((r) => r.communityId === communityId && r.status === "pending")
        .map((r) => r.id)
    );
    for (const s of this.state.seats) {
      if (s.userId === userId && pending.has(s.joinRequestId) && s.verdict === null && s.expiredAt === null) {
        s.expiredAt = at;
      }
    }
  }

  private isOpenSeat(s: SeatRecord): boolean {
    if (s.verdict !== null || s.expiredAt !== null) return false;
    return this.state.joinRequests.some((r) => r.id === s.joinRequestId && r.status === "pending");
  }

  async openSeatCounts(userIds: string[]) {
    const counts = new Map<string, number>(userIds.map((id) => [id, 0]));
    for (const s of this.state.seats) {
      if (counts.has(s.userId) && this.isOpenSeat(s)) counts.set(s.userId, counts.get(s.userId)! + 1);
    }
    return counts;
  }

  async listOpenSeatsFor(userId: string): Promise<OpenSeatRow[]> {
    return this.state.seats
      .filter((s) => s.userId === userId && this.isOpenSeat(s))
      .map((s) => {
        const r = this.state.joinRequests.find((x) => x.id === s.joinRequestId)!;
        const c = this.state.communities.find((x) => x.id === r.communityId)!;
        return { joinRequest: copy(r), community: { id: c.id, name: c.name, slug: c.slug } };
      });
  }

  // ── People ─────────────────────────────────────────────────────

  async displayNames(userIds: string[]) {
    return new Map(userIds.map((id) => [id, this.state.names.get(id) ?? null]));
  }

  // ── Cycles ─────────────────────────────────────────────────────

  async listActiveCommunityIds() {
    return this.state.communities.filter((c) => c.status === "active").map((c) => c.id);
  }

  async ensureCycle(input: {
    communityId: string;
    weekKey: string;
    gatheringOpensAt: Date;
    votingOpensAt: Date;
    opensAt: Date;
    closesAt: Date;
    at: Date;
  }) {
    const existing = this.state.cycles.find(
      (c) => c.communityId === input.communityId && c.weekKey === input.weekKey
    );
    if (existing) return copy(existing);
    const { at, ...fields } = input;
    const record: CycleRecord = {
      id: this.id("cycle"),
      ...fields,
      synthesizedAt: null,
      settledAt: null,
      createdAt: at,
    };
    this.state.cycles.push(record);
    return copy(record);
  }

  async findCycle(id: string) {
    const c = this.state.cycles.find((x) => x.id === id);
    return c ? copy(c) : null;
  }

  async findCycleFor(communityId: string, weekKey: string) {
    const c = this.state.cycles.find((x) => x.communityId === communityId && x.weekKey === weekKey);
    return c ? copy(c) : null;
  }

  async listCyclesFor(communityIds: string[], weekKey: string) {
    return this.state.cycles
      .filter((c) => communityIds.includes(c.communityId) && c.weekKey === weekKey)
      .map(copy);
  }

  // ── Active choice ──────────────────────────────────────────────

  async findActiveChoice(userId: string, weekKey: string) {
    const c = this.state.activeChoices.find((x) => x.userId === userId && x.weekKey === weekKey);
    return c ? copy(c) : null;
  }

  async setActiveChoice(input: { userId: string; weekKey: string; communityId: string | null; at: Date }) {
    let c = this.state.activeChoices.find((x) => x.userId === input.userId && x.weekKey === input.weekKey);
    if (c?.lockedAt) return null;
    if (c) {
      c.communityId = input.communityId;
      c.chosenAt = input.at;
    } else {
      c = {
        id: this.id("choice"),
        userId: input.userId,
        weekKey: input.weekKey,
        communityId: input.communityId,
        chosenAt: input.at,
        lockedAt: null,
      };
      this.state.activeChoices.push(c);
    }
    return copy(c);
  }

  async lockActiveChoice(userId: string, weekKey: string, communityId: string, at: Date) {
    const c = this.state.activeChoices.find(
      (x) => x.userId === userId && x.weekKey === weekKey && x.communityId === communityId && !x.lockedAt
    );
    if (!c) return false;
    c.lockedAt = at;
    return true;
  }

  async countActiveChoices(communityId: string, weekKey: string) {
    return this.state.activeChoices.filter((c) => c.communityId === communityId && c.weekKey === weekKey)
      .length;
  }

  // ── Suggestions ────────────────────────────────────────────────

  async createSuggestion(input: { cycleId: string; userId: string; text: string; at: Date }) {
    this.state.suggestions.push({ id: this.id("suggestion"), ...input });
  }

  async listMySuggestions(cycleId: string, userId: string) {
    return this.state.suggestions
      .filter((s) => s.cycleId === cycleId && s.userId === userId)
      .map((s) => ({ text: s.text, createdAt: s.at }));
  }

  async listSuggestionTexts(cycleId: string) {
    return this.state.suggestions.filter((s) => s.cycleId === cycleId).map((s) => s.text);
  }

  async listCyclesAwaitingSynthesis(now: Date) {
    const active = new Set(await this.listActiveCommunityIds());
    return this.state.cycles
      .filter((c) => c.votingOpensAt <= now && !c.synthesizedAt && !c.settledAt && active.has(c.communityId))
      .map(copy);
  }

  async markSynthesized(cycleId: string, at: Date) {
    const c = this.state.cycles.find((x) => x.id === cycleId && !x.synthesizedAt);
    if (!c) return false;
    c.synthesizedAt = at;
    return true;
  }

  // ── Ballots ────────────────────────────────────────────────────

  async createBallot(input: {
    communityId: string;
    cycleId: string | null;
    kind: BallotKind;
    opensAt: Date;
    closesAt: Date;
    options: { text: string; rationale: string | null; theme: string | null }[];
    at: Date;
  }) {
    const ballot: BallotRecord = {
      id: this.id("ballot"),
      communityId: input.communityId,
      cycleId: input.cycleId,
      kind: input.kind,
      status: "open",
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      decidedOptionId: null,
      createdAt: input.at,
    };
    this.state.ballots.push(ballot);
    input.options.forEach((o, ordinal) =>
      this.state.ballotOptions.push({ id: this.id("option"), ballotId: ballot.id, ordinal, ...o })
    );
    return copy(ballot);
  }

  async findBallot(id: string) {
    const b = this.state.ballots.find((x) => x.id === id);
    return b ? copy(b) : null;
  }

  async listBallotOptions(ballotId: string) {
    return this.state.ballotOptions
      .filter((o) => o.ballotId === ballotId)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(copy);
  }

  async findCycleBallot(cycleId: string, kind: BallotKind) {
    const b = [...this.state.ballots].reverse().find((x) => x.cycleId === cycleId && x.kind === kind);
    return b ? copy(b) : null;
  }

  async listCommunityBallots(communityId: string, statuses: BallotStatus[]) {
    return this.state.ballots
      .filter((b) => b.communityId === communityId && statuses.includes(b.status) && b.kind !== "topic")
      .reverse()
      .map(copy);
  }

  async latestBallot(communityId: string, kind: BallotKind) {
    const b = [...this.state.ballots].reverse().find((x) => x.communityId === communityId && x.kind === kind);
    return b ? copy(b) : null;
  }

  async castBallotVote(input: { ballotId: string; optionId: string; userId: string; at: Date }) {
    const v = this.state.ballotVotes.find((x) => x.ballotId === input.ballotId && x.userId === input.userId);
    if (v) v.optionId = input.optionId;
    else this.state.ballotVotes.push({ ...input });
  }

  async findBallotVote(ballotId: string, userId: string) {
    return this.state.ballotVotes.find((x) => x.ballotId === ballotId && x.userId === userId)?.optionId ?? null;
  }

  async listBallotVoteOptionIds(ballotId: string) {
    return this.state.ballotVotes.filter((v) => v.ballotId === ballotId).map((v) => v.optionId);
  }

  async listBallotsDue(now: Date) {
    return this.state.ballots.filter((b) => b.status === "open" && b.closesAt <= now).map(copy);
  }

  async decideBallot(id: string, decidedOptionId: string | null) {
    const b = this.state.ballots.find((x) => x.id === id && x.status === "open");
    if (!b) return false;
    b.status = "decided";
    b.decidedOptionId = decidedOptionId;
    return true;
  }

  // ── Topics ─────────────────────────────────────────────────────

  async createTopic(input: { cycleId: string; text: string; topicKey: string; theme: string | null; at: Date }) {
    const existing = this.state.topics.find((t) => t.cycleId === input.cycleId);
    if (existing) return copy(existing);
    const record: TopicRecord = {
      id: this.id("topic"),
      cycleId: input.cycleId,
      text: input.text,
      topicKey: input.topicKey,
      theme: input.theme,
      createdAt: input.at,
    };
    this.state.topics.push(record);
    return copy(record);
  }

  async findTopic(id: string) {
    const t = this.state.topics.find((x) => x.id === id);
    return t ? copy(t) : null;
  }

  async findTopicForCycle(cycleId: string) {
    const t = this.state.topics.find((x) => x.cycleId === cycleId);
    return t ? copy(t) : null;
  }

  async listRecentTopics(communityId: string, beforeWeekKey: string, limit: number): Promise<RecentTopicRow[]> {
    return this.state.topics
      .map((t) => ({ t, cycle: this.state.cycles.find((c) => c.id === t.cycleId)! }))
      .filter(({ cycle }) => cycle.communityId === communityId && cycle.weekKey < beforeWeekKey)
      .sort((a, b) => (a.cycle.weekKey < b.cycle.weekKey ? 1 : -1))
      .slice(0, limit)
      .map(({ t, cycle }) => ({ weekKey: cycle.weekKey, text: t.text, topicKey: t.topicKey, theme: t.theme }));
  }

  // ── Media ──────────────────────────────────────────────────────

  async createMediaAsset(input: {
    ownerId: string;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    durationSec: number;
    bytes: number;
    purgeAfter: Date;
    at: Date;
  }) {
    const { at, ...fields } = input;
    const record: MediaAssetRecord = {
      id: this.id("media"),
      ...fields,
      playbackId: null,
      contentHash: null,
      signalRatio: null,
      usedAt: null,
      status: "pending",
      purgedAt: null,
      createdAt: at,
    };
    this.state.media.push(record);
    return copy(record);
  }

  async findMediaAsset(id: string) {
    const m = this.state.media.find((x) => x.id === id);
    return m ? copy(m) : null;
  }

  async countPendingUploads(ownerId: string) {
    return this.state.media.filter((m) => m.ownerId === ownerId && m.status === "pending").length;
  }

  async markMediaReady(id: string, input: { bytes: number; contentHash: string | null; signalRatio: number | null }) {
    const m = this.state.media.find((x) => x.id === id && x.status === "pending");
    if (!m) return false;
    Object.assign(m, input, { status: "ready" });
    return true;
  }

  async markMediaRejected(id: string, at: Date) {
    const m = this.state.media.find((x) => x.id === id);
    if (m) Object.assign(m, { status: "rejected", purgeAfter: at });
  }

  async setMediaPurgeAfter(ids: string[], purgeAfter: Date) {
    for (const m of this.state.media) if (ids.includes(m.id) && m.status !== "purged") m.purgeAfter = purgeAfter;
  }

  async listMediaDueForPurge(now: Date, limit: number) {
    return this.state.media
      .filter((m) => m.status !== "purged" && m.purgeAfter && m.purgeAfter <= now)
      .slice(0, limit)
      .map(copy);
  }

  async markMediaPurged(id: string, at: Date) {
    const m = this.state.media.find((x) => x.id === id);
    if (m) Object.assign(m, { status: "purged", purgedAt: at });
  }

  async findUsedMediaByHash(ownerId: string, contentHash: string, excludeId: string) {
    return this.state.media
      .filter((m) => m.ownerId === ownerId && m.contentHash === contentHash && m.id !== excludeId && m.usedAt)
      .map(copy);
  }

  async markMediaUsed(id: string, at: Date) {
    const m = this.state.media.find((x) => x.id === id);
    if (m) m.usedAt = at;
  }

  // ── Responses ──────────────────────────────────────────────────

  async findResponse(id: string) {
    const r = this.state.responses.find((x) => x.id === id);
    return r ? copy(r) : null;
  }

  async findResponseFor(topicId: string, userId: string) {
    const r = this.state.responses.find((x) => x.topicId === topicId && x.userId === userId);
    return r ? copy(r) : null;
  }

  async createResponse(input: {
    topicId: string;
    circleId: string;
    userId: string;
    mediaId: string;
    visibility: ResponseVisibility;
    durationSec: number;
    at: Date;
  }) {
    if (this.state.responses.some((r) => r.topicId === input.topicId && r.userId === input.userId)) {
      throw new DuplicateResponseError();
    }
    const { at, ...fields } = input;
    const record: RoomResponseRecord = {
      id: this.id("response"),
      ...fields,
      status: "submitted",
      createdAt: at,
      withdrawnAt: null,
      publishedAt: null,
      expiresAt: null,
    };
    this.state.responses.push(record);
    return copy(record);
  }

  async withdrawResponse(id: string, at: Date) {
    const r = this.state.responses.find((x) => x.id === id && x.status === "submitted");
    if (!r) return false;
    r.status = "withdrawn";
    r.withdrawnAt = at;
    return true;
  }

  async isMediaAttached(mediaId: string) {
    return this.state.responses.some((r) => r.mediaId === mediaId);
  }

  // ── Circles ────────────────────────────────────────────────────

  async listCircles(cycleId: string) {
    return this.state.circles
      .filter((c) => c.cycleId === cycleId)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((circle) => ({
        circle: copy(circle),
        memberIds: this.state.circleSeats.filter((s) => s.circleId === circle.id).map((s) => s.userId),
      }));
  }

  async createCircle(cycleId: string, ordinal: number, at: Date) {
    const existing = this.state.circles.find((c) => c.cycleId === cycleId && c.ordinal === ordinal);
    if (existing) return copy(existing);
    const record: CircleRecord = { id: this.id("circle"), cycleId, ordinal, createdAt: at };
    this.state.circles.push(record);
    return copy(record);
  }

  async seatInCircle(circleId: string, cycleId: string, userId: string) {
    if (this.state.circleSeats.some((s) => s.cycleId === cycleId && s.userId === userId)) return false;
    this.state.circleSeats.push({ circleId, cycleId, userId });
    return true;
  }

  async findCircleSeat(cycleId: string, userId: string) {
    return this.state.circleSeats.find((s) => s.cycleId === cycleId && s.userId === userId)?.circleId ?? null;
  }

  async recentCirclePartners(communityId: string, userId: string, beforeWeekKey: string, weeks: number) {
    const cycleWeek = (cycleId: string) => this.state.cycles.find((c) => c.id === cycleId)!;
    const mine = this.state.circleSeats
      .filter((s) => {
        const cycle = cycleWeek(s.cycleId);
        return s.userId === userId && cycle.communityId === communityId && cycle.weekKey < beforeWeekKey;
      })
      .sort((a, b) => (cycleWeek(a.cycleId).weekKey < cycleWeek(b.cycleId).weekKey ? 1 : -1))
      .slice(0, weeks)
      .map((s) => s.circleId);
    const partners = new Map<string, number>();
    for (const s of this.state.circleSeats) {
      if (mine.includes(s.circleId) && s.userId !== userId) partners.set(s.userId, (partners.get(s.userId) ?? 0) + 1);
    }
    return partners;
  }

  // ── The room ───────────────────────────────────────────────────

  async listCircleResponses(circleId: string) {
    return this.state.responses.filter((r) => r.circleId === circleId && r.status === "submitted").map(copy);
  }

  async upsertReaction(input: { responseId: string; userId: string; verdict: ReactionVerdict; at: Date }) {
    const r = this.state.reactions.find((x) => x.responseId === input.responseId && x.userId === input.userId);
    if (r) r.verdict = input.verdict;
    else this.state.reactions.push({ ...input });
  }

  async myReactions(userId: string, responseIds: string[]) {
    return new Map(
      this.state.reactions
        .filter((r) => r.userId === userId && responseIds.includes(r.responseId))
        .map((r) => [r.responseId, r.verdict] as const)
    );
  }

  async commentCounts(responseIds: string[]) {
    return new Map(
      responseIds.map((id) => [id, this.state.comments.filter((c) => c.responseId === id && !c.deletedAt).length])
    );
  }

  async createComment(input: { responseId: string; userId: string; parentId: string | null; body: string; at: Date }) {
    const { at, ...fields } = input;
    const record: CommentRecord = { id: this.id("comment"), ...fields, createdAt: at, deletedAt: null };
    this.state.comments.push(record);
    return copy(record);
  }

  async findComment(id: string) {
    const c = this.state.comments.find((x) => x.id === id);
    return c ? copy(c) : null;
  }

  async listComments(responseId: string) {
    return this.state.comments.filter((c) => c.responseId === responseId).map(copy);
  }

  async softDeleteComment(id: string, at: Date) {
    const c = this.state.comments.find((x) => x.id === id);
    if (c) c.deletedAt = at;
  }

  async setCommentLike(commentId: string, userId: string, liked: boolean) {
    const has = this.state.commentLikes.some((l) => l.commentId === commentId && l.userId === userId);
    if (liked && !has) this.state.commentLikes.push({ commentId, userId });
    if (!liked) this.state.commentLikes = this.state.commentLikes.filter((l) => !(l.commentId === commentId && l.userId === userId));
  }

  async commentLikes(commentIds: string[], userId: string) {
    const counts = new Map<string, number>(commentIds.map((id) => [id, 0]));
    const mine = new Set<string>();
    for (const l of this.state.commentLikes) {
      if (!counts.has(l.commentId)) continue;
      counts.set(l.commentId, counts.get(l.commentId)! + 1);
      if (l.userId === userId) mine.add(l.commentId);
    }
    return { counts, mine };
  }

  async createReport(input: {
    reporterId: string;
    responseId: string | null;
    commentId: string | null;
    reason: string;
    note: string | null;
    at: Date;
  }) {
    this.state.reports.push({ ...input });
  }

  // ── Settlement ─────────────────────────────────────────────────

  async listCyclesToSettle(now: Date) {
    return this.state.cycles.filter((c) => c.closesAt <= now && !c.settledAt).map(copy);
  }

  async listTopicResponses(topicId: string) {
    return this.state.responses.filter((r) => r.topicId === topicId).map(copy);
  }

  async countTopicReactions(topicId: string) {
    const submitted = new Set(
      this.state.responses.filter((r) => r.topicId === topicId && r.status === "submitted").map((r) => r.id)
    );
    const counts = { agree: 0, mixed: 0, disagree: 0 };
    for (const r of this.state.reactions) if (submitted.has(r.responseId)) counts[r.verdict]++;
    return counts;
  }

  async countTopicComments(topicId: string) {
    const submitted = new Set(
      this.state.responses.filter((r) => r.topicId === topicId && r.status === "submitted").map((r) => r.id)
    );
    return this.state.comments.filter((c) => submitted.has(c.responseId) && !c.deletedAt).length;
  }

  async upsertCycleResult(input: Omit<CycleResultRecord, "id" | "createdAt"> & { at: Date }) {
    const { at, ...fields } = input;
    const existing = fields.cycleId ? this.state.results.find((r) => r.cycleId === fields.cycleId) : undefined;
    if (existing) {
      Object.assign(existing, fields);
      return copy(existing);
    }
    const record: CycleResultRecord = { id: this.id("result"), ...fields, createdAt: at };
    this.state.results.push(record);
    return copy(record);
  }

  async publishResponses(ids: string[], publishedAt: Date, expiresAt: Date) {
    for (const r of this.state.responses) {
      if (ids.includes(r.id) && !r.publishedAt) Object.assign(r, { publishedAt, expiresAt });
    }
  }

  async deleteResponses(ids: string[]) {
    this.state.reactions = this.state.reactions.filter((x) => !ids.includes(x.responseId));
    const gone = new Set(this.state.comments.filter((c) => ids.includes(c.responseId)).map((c) => c.id));
    this.state.comments = this.state.comments.filter((c) => !gone.has(c.id));
    this.state.commentLikes = this.state.commentLikes.filter((l) => !gone.has(l.commentId));
    this.state.responses = this.state.responses.filter((r) => !ids.includes(r.id));
  }

  async deleteTopicConversation(topicId: string) {
    const ids = new Set(this.state.responses.filter((r) => r.topicId === topicId).map((r) => r.id));
    this.state.reactions = this.state.reactions.filter((x) => !ids.has(x.responseId));
    const gone = new Set(this.state.comments.filter((c) => ids.has(c.responseId)).map((c) => c.id));
    this.state.comments = this.state.comments.filter((c) => !gone.has(c.id));
    this.state.commentLikes = this.state.commentLikes.filter((l) => !gone.has(l.commentId));
  }

  async markSettled(cycleId: string, at: Date) {
    const c = this.state.cycles.find((x) => x.id === cycleId && !x.settledAt);
    if (!c) return false;
    c.settledAt = at;
    return true;
  }

  async findCycleResult(cycleId: string) {
    const r = this.state.results.find((x) => x.cycleId === cycleId);
    return r ? copy(r) : null;
  }

  async listCommunityResults(communityId: string, limit: number) {
    return this.state.results
      .filter((r) => r.communityId === communityId)
      .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
      .slice(0, limit)
      .map(copy);
  }

  async listExpiredPublicResponses(now: Date, limit: number) {
    return this.state.responses.filter((r) => r.expiresAt && r.expiresAt <= now).slice(0, limit).map(copy);
  }

  // ── Integrity ──────────────────────────────────────────────────

  async createStrike(input: {
    userId: string;
    reason: string;
    severity: "low" | "medium" | "high";
    responseId: string | null;
    expiresAt: Date;
    at: Date;
  }) {
    this.state.strikes.push({ ...input });
  }

  async listRecentStrikes(userId: string, since: Date) {
    return this.state.strikes
      .filter((s) => s.userId === userId && s.at > since)
      .map((s) => ({ createdAt: s.at, reason: s.reason }));
  }

  // ── Chest ──────────────────────────────────────────────────────

  async chestBalance(communityId: string) {
    return this.state.chestEntries.filter((e) => e.communityId === communityId).reduce((sum, e) => sum + e.cents, 0);
  }

  async listChestEntries(communityId: string, limit: number) {
    return this.state.chestEntries
      .filter((e) => e.communityId === communityId)
      .reverse()
      .slice(0, limit)
      .map(copy);
  }

  async createChestEntry(input: { communityId: string; cents: number; kind: string; memo: string | null; at: Date }) {
    const { at, ...fields } = input;
    this.state.chestEntries.push({ id: this.id("entry"), ...fields, createdAt: at });
  }

  async createChestProposal(input: { communityId: string; userId: string; title: string; description: string | null; at: Date }) {
    const { at, ...fields } = input;
    const record: ChestProposalRecord = {
      id: this.id("proposal"),
      ...fields,
      status: "proposed",
      ballotId: null,
      optionId: null,
      createdAt: at,
    };
    this.state.chestProposals.push(record);
    return copy(record);
  }

  async listChestProposals(communityId: string, statuses: ChestProposalStatus[]) {
    return this.state.chestProposals
      .filter((p) => p.communityId === communityId && statuses.includes(p.status))
      .reverse()
      .map(copy);
  }

  async attachProposalsToBallot(links: { proposalId: string; optionId: string }[], ballotId: string) {
    for (const link of links) {
      const p = this.state.chestProposals.find((x) => x.id === link.proposalId);
      if (p) Object.assign(p, { status: "on_ballot", ballotId, optionId: link.optionId });
    }
  }

  async resolveChestBallot(ballotId: string, chosenOptionId: string | null) {
    let chosen: ChestProposalRecord | null = null;
    for (const p of this.state.chestProposals) {
      if (p.ballotId !== ballotId || p.status !== "on_ballot") continue;
      if (chosenOptionId && p.optionId === chosenOptionId) {
        p.status = "chosen";
        chosen = copy(p);
      } else {
        p.status = "not_chosen";
      }
    }
    return chosen;
  }

  // ── Discover ───────────────────────────────────────────────────

  private publicRow(r: RoomResponseRecord, now: Date): PublicResponseRow | null {
    if (r.status !== "submitted" || !r.publishedAt || !r.expiresAt || r.expiresAt <= now) return null;
    const media = this.state.media.find((m) => m.id === r.mediaId);
    const topic = this.state.topics.find((t) => t.id === r.topicId);
    const cycle = topic && this.state.cycles.find((c) => c.id === topic.cycleId);
    const community = cycle && this.state.communities.find((c) => c.id === cycle.communityId);
    if (!media || media.status !== "ready" || !topic || !cycle || !community || community.status === "archived") return null;
    return { response: copy(r), topic: copy(topic), cycle: copy(cycle), community: copy(community), media: copy(media) };
  }

  async listPublicResponses(now: Date, limit: number) {
    return this.state.responses
      .map((r) => this.publicRow(r, now))
      .filter((row): row is PublicResponseRow => row !== null)
      .sort((a, b) => b.response.publishedAt!.getTime() - a.response.publishedAt!.getTime())
      .slice(0, limit);
  }

  async findPublicResponse(id: string, now: Date) {
    const r = this.state.responses.find((x) => x.id === id);
    return r ? this.publicRow(r, now) : null;
  }
}
