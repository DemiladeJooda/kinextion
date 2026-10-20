import { prisma, type Prisma } from "@kinextion/database";
import { DuplicateResponseError } from "./store.js";
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
  InviteRecord,
  JoinRequestRecord,
  MembershipRecord,
  MyCommunityRow,
  NewJoinRequest,
  OpenSeatRow,
  SeatRecord,
  Verdict,
} from "./store.js";

type Db = typeof prisma | Prisma.TransactionClient;

// Prisma returns the enum-like columns as plain strings; the schema comments
// and the service are the only writers, so narrowing here is safe.
const asCommunity = (row: Prisma.CommunityGetPayload<object>): CommunityRecord =>
  row as CommunityRecord;
const asMembership = (row: Prisma.CommunityMembershipGetPayload<object>): MembershipRecord =>
  row as MembershipRecord;
const asJoinRequest = (row: Prisma.JoinRequestGetPayload<object>): JoinRequestRecord => {
  const { updatedAt: _updatedAt, ...rest } = row;
  return rest as JoinRequestRecord;
};
const asSeat = (row: Prisma.AdmissionSeatGetPayload<object>): SeatRecord => row as SeatRecord;

export class PrismaCommunityStore implements CommunityStore {
  constructor(
    private readonly db: Db = prisma,
    private readonly inTransaction = false
  ) {}

  async transaction<T>(fn: (tx: CommunityStore) => Promise<T>): Promise<T> {
    // Prisma can't nest interactive transactions; an inner call joins the outer one.
    if (this.inTransaction) return fn(this);
    return prisma.$transaction((tx) => fn(new PrismaCommunityStore(tx, true)));
  }

  // ── Communities ────────────────────────────────────────────────

  async createCommunity(input: {
    slug: string;
    name: string;
    description: string | null;
    createdById: string;
    at: Date;
  }): Promise<CommunityRecord> {
    const row = await this.db.community.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        createdById: input.createdById,
        createdAt: input.at,
      },
    });
    return asCommunity(row);
  }

  async findCommunity(id: string): Promise<CommunityRecord | null> {
    const row = await this.db.community.findUnique({ where: { id } });
    return row ? asCommunity(row) : null;
  }

  async slugTaken(slug: string): Promise<boolean> {
    return (await this.db.community.count({ where: { slug } })) > 0;
  }

  async transitionCommunity(
    id: string,
    from: CommunityStatus,
    to: CommunityStatus,
    at: Date
  ): Promise<boolean> {
    const { count } = await this.db.community.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...(to === "active" ? { activatedAt: at } : {}),
        ...(to === "archived" ? { archivedAt: at } : {}),
      },
    });
    return count === 1;
  }

  async listFormingCreatedBefore(cutoff: Date): Promise<CommunityRecord[]> {
    const rows = await this.db.community.findMany({
      where: { status: "forming", createdAt: { lt: cutoff } },
    });
    return rows.map(asCommunity);
  }

  async countFormingCreatedBy(userId: string): Promise<number> {
    return this.db.community.count({ where: { createdById: userId, status: "forming" } });
  }

  // ── Membership ─────────────────────────────────────────────────

  async upsertMembership(input: {
    communityId: string;
    userId: string;
    role: "steward" | "member";
    at: Date;
  }): Promise<MembershipRecord> {
    const row = await this.db.communityMembership.upsert({
      where: { communityId_userId: { communityId: input.communityId, userId: input.userId } },
      create: {
        communityId: input.communityId,
        userId: input.userId,
        role: input.role,
        joinedAt: input.at,
      },
      update: { leftAt: null, joinedAt: input.at, role: input.role },
    });
    return asMembership(row);
  }

  async findMembership(communityId: string, userId: string): Promise<MembershipRecord | null> {
    const row = await this.db.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    return row ? asMembership(row) : null;
  }

  async endMembership(communityId: string, userId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.communityMembership.updateMany({
      where: { communityId, userId, leftAt: null },
      data: { leftAt: at },
    });
    return count === 1;
  }

  async countActiveMembers(communityId: string): Promise<number> {
    return this.db.communityMembership.count({ where: { communityId, leftAt: null } });
  }

  async listActiveMemberIds(communityId: string): Promise<string[]> {
    const rows = await this.db.communityMembership.findMany({
      where: { communityId, leftAt: null },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async listMyCommunities(userId: string): Promise<MyCommunityRow[]> {
    const rows = await this.db.communityMembership.findMany({
      where: { userId, leftAt: null, community: { status: { not: "archived" } } },
      include: {
        community: {
          include: { _count: { select: { memberships: { where: { leftAt: null } } } } },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return rows.map(({ community, ...membership }) => {
      const { _count, ...rest } = community;
      return {
        community: asCommunity(rest),
        membership: asMembership(membership),
        memberCount: _count.memberships,
      };
    });
  }

  // ── Founding invites ───────────────────────────────────────────

  async createInvite(input: {
    communityId: string;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
    at: Date;
  }): Promise<InviteRecord> {
    return this.db.communityInvite.create({
      data: {
        communityId: input.communityId,
        tokenHash: input.tokenHash,
        invitedById: input.invitedById,
        expiresAt: input.expiresAt,
        createdAt: input.at,
      },
    });
  }

  async findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null> {
    return this.db.communityInvite.findUnique({ where: { tokenHash } });
  }

  async countOpenInvites(communityId: string, now: Date): Promise<number> {
    return this.db.communityInvite.count({
      where: { communityId, usedAt: null, expiresAt: { gt: now } },
    });
  }

  async consumeInvite(id: string, userId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.communityInvite.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at, usedById: userId },
    });
    return count === 1;
  }

  // ── Join requests ──────────────────────────────────────────────

  async findJoinRequest(id: string): Promise<JoinRequestRecord | null> {
    const row = await this.db.joinRequest.findUnique({ where: { id } });
    return row ? asJoinRequest(row) : null;
  }

  async findJoinRequestFor(communityId: string, userId: string): Promise<JoinRequestRecord | null> {
    const row = await this.db.joinRequest.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    return row ? asJoinRequest(row) : null;
  }

  async resetJoinRequest(input: NewJoinRequest): Promise<JoinRequestRecord> {
    const fresh = {
      note: input.note,
      status: "pending",
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
    const existing = await this.db.joinRequest.findUnique({
      where: { communityId_userId: { communityId: input.communityId, userId: input.userId } },
      select: { id: true },
    });
    if (existing) {
      await this.db.admissionSeat.deleteMany({ where: { joinRequestId: existing.id } });
    }
    const row = await this.db.joinRequest.upsert({
      where: { communityId_userId: { communityId: input.communityId, userId: input.userId } },
      create: { communityId: input.communityId, userId: input.userId, ...fresh },
      update: fresh,
    });
    return asJoinRequest(row);
  }

  async decideJoinRequest(
    id: string,
    input: {
      status: "admitted" | "denied";
      decidedBy: "panel" | "steward" | "timeout";
      at: Date;
      fastTrackProof?: string;
    }
  ): Promise<boolean> {
    const { count } = await this.db.joinRequest.updateMany({
      where: { id, status: "pending" },
      data: {
        status: input.status,
        decidedBy: input.decidedBy,
        decidedAt: input.at,
        ...(input.fastTrackProof ? { fastTrackProof: input.fastTrackProof } : {}),
      },
    });
    return count === 1;
  }

  async startRound(id: string, round: number, deadlineAt: Date): Promise<void> {
    await this.db.joinRequest.update({ where: { id }, data: { round, deadlineAt } });
  }

  async listPendingDue(now: Date): Promise<JoinRequestRecord[]> {
    const rows = await this.db.joinRequest.findMany({
      where: { status: "pending", deadlineAt: { lte: now } },
      orderBy: { deadlineAt: "asc" },
    });
    return rows.map(asJoinRequest);
  }

  async listPendingForCommunity(communityId: string): Promise<JoinRequestRecord[]> {
    const rows = await this.db.joinRequest.findMany({
      where: { communityId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(asJoinRequest);
  }

  // ── Seats ──────────────────────────────────────────────────────

  async createSeats(joinRequestId: string, userIds: string[], round: number): Promise<void> {
    if (userIds.length === 0) return;
    await this.db.admissionSeat.createMany({
      data: userIds.map((userId) => ({ joinRequestId, userId, round })),
      skipDuplicates: true,
    });
  }

  async listSeats(joinRequestId: string): Promise<SeatRecord[]> {
    const rows = await this.db.admissionSeat.findMany({ where: { joinRequestId } });
    return rows.map(asSeat);
  }

  async castVerdict(joinRequestId: string, userId: string, verdict: Verdict, at: Date): Promise<boolean> {
    const { count } = await this.db.admissionSeat.updateMany({
      where: { joinRequestId, userId, verdict: null, expiredAt: null },
      data: { verdict, votedAt: at },
    });
    return count === 1;
  }

  async expireSeats(joinRequestId: string, userIds: string[], at: Date): Promise<void> {
    if (userIds.length === 0) return;
    await this.db.admissionSeat.updateMany({
      where: { joinRequestId, userId: { in: userIds }, verdict: null, expiredAt: null },
      data: { expiredAt: at },
    });
  }

  async expireSilentSeatsForMember(communityId: string, userId: string, at: Date): Promise<void> {
    await this.db.admissionSeat.updateMany({
      where: {
        userId,
        verdict: null,
        expiredAt: null,
        joinRequest: { communityId, status: "pending" },
      },
      data: { expiredAt: at },
    });
  }

  async openSeatCounts(userIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>(userIds.map((id) => [id, 0]));
    if (userIds.length === 0) return counts;
    const grouped = await this.db.admissionSeat.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        verdict: null,
        expiredAt: null,
        joinRequest: { status: "pending" },
      },
      _count: { _all: true },
    });
    for (const g of grouped) counts.set(g.userId, g._count._all);
    return counts;
  }

  async listOpenSeatsFor(userId: string): Promise<OpenSeatRow[]> {
    const rows = await this.db.admissionSeat.findMany({
      where: { userId, verdict: null, expiredAt: null, joinRequest: { status: "pending" } },
      include: {
        joinRequest: { include: { community: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { joinRequest: { deadlineAt: "asc" } },
    });
    return rows.map(({ joinRequest }) => {
      const { community, ...request } = joinRequest;
      return { joinRequest: asJoinRequest(request), community };
    });
  }

  // ── People ─────────────────────────────────────────────────────

  async displayNames(userIds: string[]): Promise<Map<string, string | null>> {
    const names = new Map<string, string | null>(userIds.map((id) => [id, null]));
    if (userIds.length === 0) return names;
    const profiles = await this.db.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, displayName: true },
    });
    for (const p of profiles) names.set(p.userId, p.displayName);
    return names;
  }

  // ── Cycles ─────────────────────────────────────────────────────

  async listActiveCommunityIds(): Promise<string[]> {
    const rows = await this.db.community.findMany({ where: { status: "active" }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  async ensureCycle(input: {
    communityId: string;
    weekKey: string;
    gatheringOpensAt: Date;
    votingOpensAt: Date;
    opensAt: Date;
    closesAt: Date;
    at: Date;
  }): Promise<CycleRecord> {
    const { at, ...fields } = input;
    return this.db.cycle.upsert({
      where: { communityId_weekKey: { communityId: input.communityId, weekKey: input.weekKey } },
      create: { ...fields, createdAt: at },
      update: {},
    });
  }

  async findCycle(id: string): Promise<CycleRecord | null> {
    return this.db.cycle.findUnique({ where: { id } });
  }

  async findCycleFor(communityId: string, weekKey: string): Promise<CycleRecord | null> {
    return this.db.cycle.findUnique({ where: { communityId_weekKey: { communityId, weekKey } } });
  }

  async listCyclesFor(communityIds: string[], weekKey: string): Promise<CycleRecord[]> {
    if (communityIds.length === 0) return [];
    return this.db.cycle.findMany({ where: { communityId: { in: communityIds }, weekKey } });
  }

  // ── Active choice ──────────────────────────────────────────────

  async findActiveChoice(userId: string, weekKey: string): Promise<ActiveChoiceRecord | null> {
    return this.db.activeChoice.findUnique({ where: { userId_weekKey: { userId, weekKey } } });
  }

  async setActiveChoice(input: {
    userId: string;
    weekKey: string;
    communityId: string | null;
    at: Date;
  }): Promise<ActiveChoiceRecord | null> {
    const existing = await this.findActiveChoice(input.userId, input.weekKey);
    if (existing?.lockedAt) return null;
    if (existing) {
      const { count } = await this.db.activeChoice.updateMany({
        where: { id: existing.id, lockedAt: null },
        data: { communityId: input.communityId, chosenAt: input.at },
      });
      return count === 1 ? this.findActiveChoice(input.userId, input.weekKey) : null;
    }
    return this.db.activeChoice.create({
      data: {
        userId: input.userId,
        weekKey: input.weekKey,
        communityId: input.communityId,
        chosenAt: input.at,
      },
    });
  }

  async lockActiveChoice(userId: string, weekKey: string, communityId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.activeChoice.updateMany({
      where: { userId, weekKey, communityId, lockedAt: null },
      data: { lockedAt: at },
    });
    return count === 1;
  }

  async countActiveChoices(communityId: string, weekKey: string): Promise<number> {
    return this.db.activeChoice.count({ where: { communityId, weekKey } });
  }

  // ── Suggestions ────────────────────────────────────────────────

  async createSuggestion(input: { cycleId: string; userId: string; text: string; at: Date }): Promise<void> {
    await this.db.topicSuggestion.create({
      data: { cycleId: input.cycleId, userId: input.userId, text: input.text, createdAt: input.at },
    });
  }

  async listMySuggestions(cycleId: string, userId: string) {
    return this.db.topicSuggestion.findMany({
      where: { cycleId, userId },
      select: { text: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async listSuggestionTexts(cycleId: string): Promise<string[]> {
    const rows = await this.db.topicSuggestion.findMany({ where: { cycleId }, select: { text: true } });
    return rows.map((r) => r.text);
  }

  async listCyclesAwaitingSynthesis(now: Date): Promise<CycleRecord[]> {
    return this.db.cycle.findMany({
      where: {
        votingOpensAt: { lte: now },
        synthesizedAt: null,
        settledAt: null,
        community: { status: "active" },
      },
    });
  }

  async markSynthesized(cycleId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.cycle.updateMany({
      where: { id: cycleId, synthesizedAt: null },
      data: { synthesizedAt: at },
    });
    return count === 1;
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
  }): Promise<BallotRecord> {
    const row = await this.db.ballot.create({
      data: {
        communityId: input.communityId,
        cycleId: input.cycleId,
        kind: input.kind,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        createdAt: input.at,
        options: {
          create: input.options.map((o, ordinal) => ({ ...o, ordinal })),
        },
      },
    });
    return row as BallotRecord;
  }

  async findBallot(id: string): Promise<BallotRecord | null> {
    return (await this.db.ballot.findUnique({ where: { id } })) as BallotRecord | null;
  }

  async listBallotOptions(ballotId: string): Promise<BallotOptionRecord[]> {
    return this.db.ballotOption.findMany({ where: { ballotId }, orderBy: { ordinal: "asc" } });
  }

  async findCycleBallot(cycleId: string, kind: BallotKind): Promise<BallotRecord | null> {
    return (await this.db.ballot.findFirst({
      where: { cycleId, kind },
      orderBy: { createdAt: "desc" },
    })) as BallotRecord | null;
  }

  async listCommunityBallots(communityId: string, statuses: BallotStatus[]): Promise<BallotRecord[]> {
    return (await this.db.ballot.findMany({
      where: { communityId, status: { in: statuses }, kind: { not: "topic" } },
      orderBy: { createdAt: "desc" },
    })) as BallotRecord[];
  }

  async latestBallot(communityId: string, kind: BallotKind): Promise<BallotRecord | null> {
    return (await this.db.ballot.findFirst({
      where: { communityId, kind },
      orderBy: { createdAt: "desc" },
    })) as BallotRecord | null;
  }

  async castBallotVote(input: { ballotId: string; optionId: string; userId: string; at: Date }): Promise<void> {
    await this.db.ballotVote.upsert({
      where: { ballotId_userId: { ballotId: input.ballotId, userId: input.userId } },
      create: { ballotId: input.ballotId, optionId: input.optionId, userId: input.userId, createdAt: input.at },
      update: { optionId: input.optionId },
    });
  }

  async findBallotVote(ballotId: string, userId: string): Promise<string | null> {
    const row = await this.db.ballotVote.findUnique({
      where: { ballotId_userId: { ballotId, userId } },
      select: { optionId: true },
    });
    return row?.optionId ?? null;
  }

  async listBallotVoteOptionIds(ballotId: string): Promise<string[]> {
    const rows = await this.db.ballotVote.findMany({ where: { ballotId }, select: { optionId: true } });
    return rows.map((r) => r.optionId);
  }

  async listBallotsDue(now: Date): Promise<BallotRecord[]> {
    return (await this.db.ballot.findMany({
      where: { status: "open", closesAt: { lte: now } },
      orderBy: { closesAt: "asc" },
    })) as BallotRecord[];
  }

  async decideBallot(id: string, decidedOptionId: string | null, at: Date): Promise<boolean> {
    void at;
    const { count } = await this.db.ballot.updateMany({
      where: { id, status: "open" },
      data: { status: "decided", decidedOptionId },
    });
    return count === 1;
  }

  // ── Topics ─────────────────────────────────────────────────────

  async createTopic(input: {
    cycleId: string;
    text: string;
    topicKey: string;
    theme: string | null;
    at: Date;
  }): Promise<TopicRecord> {
    return this.db.topic.upsert({
      where: { cycleId: input.cycleId },
      create: {
        cycleId: input.cycleId,
        text: input.text,
        topicKey: input.topicKey,
        theme: input.theme,
        createdAt: input.at,
      },
      update: {},
    });
  }

  async findTopic(id: string): Promise<TopicRecord | null> {
    return this.db.topic.findUnique({ where: { id } });
  }

  async findTopicForCycle(cycleId: string): Promise<TopicRecord | null> {
    return this.db.topic.findUnique({ where: { cycleId } });
  }

  async listRecentTopics(communityId: string, beforeWeekKey: string, limit: number): Promise<RecentTopicRow[]> {
    const rows = await this.db.topic.findMany({
      where: { cycle: { communityId, weekKey: { lt: beforeWeekKey } } },
      include: { cycle: { select: { weekKey: true } } },
      orderBy: { cycle: { weekKey: "desc" } },
      take: limit,
    });
    return rows.map((r) => ({ weekKey: r.cycle.weekKey, text: r.text, topicKey: r.topicKey, theme: r.theme }));
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
  }): Promise<MediaAssetRecord> {
    const { at, ...data } = input;
    return (await this.db.mediaAsset.create({ data: { ...data, createdAt: at } })) as MediaAssetRecord;
  }

  async findMediaAsset(id: string): Promise<MediaAssetRecord | null> {
    return (await this.db.mediaAsset.findUnique({ where: { id } })) as MediaAssetRecord | null;
  }

  async countPendingUploads(ownerId: string): Promise<number> {
    return this.db.mediaAsset.count({ where: { ownerId, status: "pending" } });
  }

  async markMediaReady(
    id: string,
    input: { bytes: number; contentHash: string | null; signalRatio: number | null }
  ): Promise<boolean> {
    const { count } = await this.db.mediaAsset.updateMany({
      where: { id, status: "pending" },
      data: { status: "ready", ...input },
    });
    return count === 1;
  }

  async markMediaRejected(id: string, at: Date): Promise<void> {
    await this.db.mediaAsset.update({ where: { id }, data: { status: "rejected", purgeAfter: at } });
  }

  async setMediaPurgeAfter(ids: string[], purgeAfter: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db.mediaAsset.updateMany({
      where: { id: { in: ids }, status: { not: "purged" } },
      data: { purgeAfter },
    });
  }

  async listMediaDueForPurge(now: Date, limit: number): Promise<MediaAssetRecord[]> {
    return (await this.db.mediaAsset.findMany({
      where: { status: { not: "purged" }, purgeAfter: { lte: now } },
      orderBy: { purgeAfter: "asc" },
      take: limit,
    })) as MediaAssetRecord[];
  }

  async markMediaPurged(id: string, at: Date): Promise<void> {
    await this.db.mediaAsset.update({ where: { id }, data: { status: "purged", purgedAt: at } });
  }

  async findUsedMediaByHash(ownerId: string, contentHash: string, excludeId: string): Promise<MediaAssetRecord[]> {
    return (await this.db.mediaAsset.findMany({
      where: { ownerId, contentHash, id: { not: excludeId }, usedAt: { not: null } },
    })) as MediaAssetRecord[];
  }

  async markMediaUsed(id: string, at: Date): Promise<void> {
    await this.db.mediaAsset.update({ where: { id }, data: { usedAt: at } });
  }

  // ── Responses ──────────────────────────────────────────────────

  async findResponse(id: string): Promise<RoomResponseRecord | null> {
    return (await this.db.roomResponse.findUnique({ where: { id } })) as RoomResponseRecord | null;
  }

  async findResponseFor(topicId: string, userId: string): Promise<RoomResponseRecord | null> {
    return (await this.db.roomResponse.findUnique({
      where: { topicId_userId: { topicId, userId } },
    })) as RoomResponseRecord | null;
  }

  async createResponse(input: {
    topicId: string;
    circleId: string;
    userId: string;
    mediaId: string;
    visibility: ResponseVisibility;
    durationSec: number;
    at: Date;
  }): Promise<RoomResponseRecord> {
    const { at, ...data } = input;
    try {
      return (await this.db.roomResponse.create({ data: { ...data, createdAt: at } })) as RoomResponseRecord;
    } catch (err) {
      // The unique index is the rule; this just gives it a name.
      if ((err as { code?: string }).code === "P2002") throw new DuplicateResponseError();
      throw err;
    }
  }

  async withdrawResponse(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.roomResponse.updateMany({
      where: { id, status: "submitted" },
      data: { status: "withdrawn", withdrawnAt: at },
    });
    return count === 1;
  }

  async isMediaAttached(mediaId: string): Promise<boolean> {
    return (await this.db.roomResponse.count({ where: { mediaId } })) > 0;
  }

  // ── Circles ────────────────────────────────────────────────────

  async listCircles(cycleId: string) {
    const rows = await this.db.circle.findMany({
      where: { cycleId },
      include: { seats: { select: { userId: true } } },
      orderBy: { ordinal: "asc" },
    });
    return rows.map(({ seats, ...circle }) => ({ circle, memberIds: seats.map((s) => s.userId) }));
  }

  async createCircle(cycleId: string, ordinal: number, at: Date): Promise<CircleRecord> {
    return this.db.circle.upsert({
      where: { cycleId_ordinal: { cycleId, ordinal } },
      create: { cycleId, ordinal, createdAt: at },
      update: {},
    });
  }

  async seatInCircle(circleId: string, cycleId: string, userId: string): Promise<boolean> {
    const { count } = await this.db.circleSeat.createMany({
      data: [{ circleId, cycleId, userId }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async findCircleSeat(cycleId: string, userId: string): Promise<string | null> {
    const row = await this.db.circleSeat.findUnique({
      where: { cycleId_userId: { cycleId, userId } },
      select: { circleId: true },
    });
    return row?.circleId ?? null;
  }

  async recentCirclePartners(communityId: string, userId: string, beforeWeekKey: string, weeks: number) {
    const mySeats = await this.db.circleSeat.findMany({
      where: { userId, cycle: { communityId, weekKey: { lt: beforeWeekKey } } },
      orderBy: { cycle: { weekKey: "desc" } },
      take: weeks,
      select: { circleId: true },
    });
    const partners = new Map<string, number>();
    if (mySeats.length === 0) return partners;
    const others = await this.db.circleSeat.findMany({
      where: { circleId: { in: mySeats.map((s) => s.circleId) }, userId: { not: userId } },
      select: { userId: true },
    });
    for (const o of others) partners.set(o.userId, (partners.get(o.userId) ?? 0) + 1);
    return partners;
  }

  // ── The room ───────────────────────────────────────────────────

  async listCircleResponses(circleId: string): Promise<RoomResponseRecord[]> {
    return (await this.db.roomResponse.findMany({
      where: { circleId, status: "submitted" },
      orderBy: { createdAt: "asc" },
    })) as RoomResponseRecord[];
  }

  async upsertReaction(input: { responseId: string; userId: string; verdict: ReactionVerdict; at: Date }) {
    await this.db.roomReaction.upsert({
      where: { responseId_userId: { responseId: input.responseId, userId: input.userId } },
      create: { responseId: input.responseId, userId: input.userId, verdict: input.verdict, createdAt: input.at },
      update: { verdict: input.verdict },
    });
  }

  async myReactions(userId: string, responseIds: string[]) {
    const out = new Map<string, ReactionVerdict>();
    if (responseIds.length === 0) return out;
    const rows = await this.db.roomReaction.findMany({
      where: { userId, responseId: { in: responseIds } },
      select: { responseId: true, verdict: true },
    });
    for (const r of rows) out.set(r.responseId, r.verdict as ReactionVerdict);
    return out;
  }

  async commentCounts(responseIds: string[]) {
    const out = new Map<string, number>(responseIds.map((id) => [id, 0]));
    if (responseIds.length === 0) return out;
    const grouped = await this.db.roomComment.groupBy({
      by: ["responseId"],
      where: { responseId: { in: responseIds }, deletedAt: null },
      _count: { _all: true },
    });
    for (const g of grouped) out.set(g.responseId, g._count._all);
    return out;
  }

  async createComment(input: { responseId: string; userId: string; parentId: string | null; body: string; at: Date }) {
    const { at, ...data } = input;
    return this.db.roomComment.create({ data: { ...data, createdAt: at } });
  }

  async findComment(id: string): Promise<CommentRecord | null> {
    return this.db.roomComment.findUnique({ where: { id } });
  }

  async listComments(responseId: string): Promise<CommentRecord[]> {
    return this.db.roomComment.findMany({ where: { responseId }, orderBy: { createdAt: "asc" } });
  }

  async softDeleteComment(id: string, at: Date): Promise<void> {
    await this.db.roomComment.update({ where: { id }, data: { deletedAt: at } });
  }

  async setCommentLike(commentId: string, userId: string, liked: boolean, at: Date): Promise<void> {
    if (liked) {
      await this.db.roomCommentLike.createMany({
        data: [{ commentId, userId, createdAt: at }],
        skipDuplicates: true,
      });
    } else {
      await this.db.roomCommentLike.deleteMany({ where: { commentId, userId } });
    }
  }

  async commentLikes(commentIds: string[], userId: string) {
    const counts = new Map<string, number>(commentIds.map((id) => [id, 0]));
    const mine = new Set<string>();
    if (commentIds.length === 0) return { counts, mine };
    const rows = await this.db.roomCommentLike.findMany({
      where: { commentId: { in: commentIds } },
      select: { commentId: true, userId: true },
    });
    for (const r of rows) {
      counts.set(r.commentId, (counts.get(r.commentId) ?? 0) + 1);
      if (r.userId === userId) mine.add(r.commentId);
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
  }): Promise<void> {
    const { at, ...data } = input;
    await this.db.contentReport.create({ data: { ...data, createdAt: at } });
  }

  // ── Settlement ─────────────────────────────────────────────────

  async listCyclesToSettle(now: Date): Promise<CycleRecord[]> {
    return this.db.cycle.findMany({ where: { closesAt: { lte: now }, settledAt: null } });
  }

  async listTopicResponses(topicId: string): Promise<RoomResponseRecord[]> {
    return (await this.db.roomResponse.findMany({ where: { topicId } })) as RoomResponseRecord[];
  }

  async countTopicReactions(topicId: string) {
    const grouped = await this.db.roomReaction.groupBy({
      by: ["verdict"],
      where: { response: { topicId, status: "submitted" } },
      _count: { _all: true },
    });
    const counts = { agree: 0, mixed: 0, disagree: 0 };
    for (const g of grouped) {
      if (g.verdict in counts) counts[g.verdict as keyof typeof counts] = g._count._all;
    }
    return counts;
  }

  async countTopicComments(topicId: string): Promise<number> {
    return this.db.roomComment.count({
      where: { deletedAt: null, response: { topicId, status: "submitted" } },
    });
  }

  async upsertCycleResult(input: Omit<CycleResultRecord, "id" | "createdAt"> & { at: Date }) {
    const { at, ...fields } = input;
    if (!fields.cycleId) {
      return this.db.cycleResult.create({ data: { ...fields, createdAt: at } });
    }
    return this.db.cycleResult.upsert({
      where: { cycleId: fields.cycleId },
      create: { ...fields, createdAt: at },
      update: fields,
    });
  }

  async publishResponses(ids: string[], publishedAt: Date, expiresAt: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db.roomResponse.updateMany({
      where: { id: { in: ids }, publishedAt: null },
      data: { publishedAt, expiresAt },
    });
  }

  async deleteResponses(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.roomResponse.deleteMany({ where: { id: { in: ids } } });
  }

  async deleteTopicConversation(topicId: string): Promise<void> {
    await this.db.roomComment.deleteMany({ where: { response: { topicId } } });
    await this.db.roomReaction.deleteMany({ where: { response: { topicId } } });
  }

  async markSettled(cycleId: string, at: Date): Promise<boolean> {
    const { count } = await this.db.cycle.updateMany({
      where: { id: cycleId, settledAt: null },
      data: { settledAt: at },
    });
    return count === 1;
  }

  async findCycleResult(cycleId: string): Promise<CycleResultRecord | null> {
    return this.db.cycleResult.findUnique({ where: { cycleId } });
  }

  async listCommunityResults(communityId: string, limit: number): Promise<CycleResultRecord[]> {
    return this.db.cycleResult.findMany({ where: { communityId }, orderBy: { closedAt: "desc" }, take: limit });
  }

  async listExpiredPublicResponses(now: Date, limit: number): Promise<RoomResponseRecord[]> {
    return (await this.db.roomResponse.findMany({
      where: { expiresAt: { lte: now } },
      take: limit,
    })) as RoomResponseRecord[];
  }

  // ── Integrity ──────────────────────────────────────────────────

  async createStrike(input: {
    userId: string;
    reason: string;
    severity: "low" | "medium" | "high";
    responseId: string | null;
    expiresAt: Date;
    at: Date;
  }): Promise<void> {
    const { at, ...data } = input;
    await this.db.integrityStrike.create({ data: { ...data, createdAt: at } });
  }

  async listRecentStrikes(userId: string, since: Date) {
    return this.db.integrityStrike.findMany({
      where: { userId, createdAt: { gt: since } },
      select: { createdAt: true, reason: true },
      orderBy: { createdAt: "asc" },
    });
  }

  // ── Chest ──────────────────────────────────────────────────────

  async chestBalance(communityId: string): Promise<number> {
    const agg = await this.db.chestEntry.aggregate({ where: { communityId }, _sum: { cents: true } });
    return agg._sum.cents ?? 0;
  }

  async listChestEntries(communityId: string, limit: number): Promise<ChestEntryRecord[]> {
    return this.db.chestEntry.findMany({ where: { communityId }, orderBy: { createdAt: "desc" }, take: limit });
  }

  async createChestEntry(input: { communityId: string; cents: number; kind: string; memo: string | null; at: Date }) {
    const { at, ...data } = input;
    await this.db.chestEntry.create({ data: { ...data, createdAt: at } });
  }

  async createChestProposal(input: {
    communityId: string;
    userId: string;
    title: string;
    description: string | null;
    at: Date;
  }): Promise<ChestProposalRecord> {
    const { at, ...data } = input;
    return (await this.db.chestProposal.create({ data: { ...data, createdAt: at } })) as ChestProposalRecord;
  }

  async listChestProposals(communityId: string, statuses: ChestProposalStatus[]): Promise<ChestProposalRecord[]> {
    return (await this.db.chestProposal.findMany({
      where: { communityId, status: { in: statuses } },
      orderBy: { createdAt: "desc" },
    })) as ChestProposalRecord[];
  }

  async attachProposalsToBallot(links: { proposalId: string; optionId: string }[], ballotId: string) {
    for (const link of links) {
      await this.db.chestProposal.update({
        where: { id: link.proposalId },
        data: { status: "on_ballot", ballotId, optionId: link.optionId },
      });
    }
  }

  async resolveChestBallot(ballotId: string, chosenOptionId: string | null): Promise<ChestProposalRecord | null> {
    await this.db.chestProposal.updateMany({
      where: { ballotId, status: "on_ballot", optionId: { not: chosenOptionId ?? "" } },
      data: { status: "not_chosen" },
    });
    if (!chosenOptionId) return null;
    await this.db.chestProposal.updateMany({
      where: { ballotId, optionId: chosenOptionId },
      data: { status: "chosen" },
    });
    return (await this.db.chestProposal.findFirst({ where: { ballotId, optionId: chosenOptionId } })) as
      | ChestProposalRecord
      | null;
  }

  // ── Discover ───────────────────────────────────────────────────

  private publicWhere(now: Date) {
    return {
      status: "submitted",
      publishedAt: { not: null },
      expiresAt: { gt: now },
      media: { status: "ready" },
      topic: { cycle: { community: { status: { not: "archived" } } } },
    };
  }

  private toPublicRow(row: {
    topic: TopicRecord & { cycle: CycleRecord & { community: CommunityRecord } };
    media: MediaAssetRecord | null;
  } & RoomResponseRecord): PublicResponseRow {
    const { topic, media, ...response } = row;
    const { cycle, ...topicRecord } = topic;
    const { community, ...cycleRecord } = cycle;
    return {
      response: response as RoomResponseRecord,
      topic: topicRecord,
      cycle: cycleRecord,
      community: community as CommunityRecord,
      media: media as MediaAssetRecord,
    };
  }

  async listPublicResponses(now: Date, limit: number): Promise<PublicResponseRow[]> {
    const rows = await this.db.roomResponse.findMany({
      where: this.publicWhere(now),
      include: { topic: { include: { cycle: { include: { community: true } } } }, media: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    return rows.map((r) => this.toPublicRow(r as never));
  }

  async findPublicResponse(id: string, now: Date): Promise<PublicResponseRow | null> {
    const row = await this.db.roomResponse.findFirst({
      where: { id, ...this.publicWhere(now) },
      include: { topic: { include: { cycle: { include: { community: true } } } }, media: true },
    });
    return row ? this.toPublicRow(row as never) : null;
  }
}
