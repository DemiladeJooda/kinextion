/**
 * What the community service needs from storage, and nothing more.
 *
 * Most modules in this API call Prisma directly, and that's right for them —
 * a habit is a row. Community is different: its value is a handful of
 * invariants that span several tables and several steps (a vote that admits
 * someone, an invite that tips a community into existence), and those need
 * testing against real state transitions, not mocked return values.
 *
 * So the service talks to this interface. Production uses PrismaCommunityStore;
 * the tests use an in-memory implementation of the same contract. Methods are
 * named for what they mean, and every write that races is shaped to return
 * whether it won (`boolean`) rather than trusting a read beforehand.
 */

export type CommunityStatus = "forming" | "active" | "archived";
export type MembershipRole = "steward" | "member";
export type JoinRequestStatus = "pending" | "admitted" | "denied";
export type DecidedBy = "panel" | "steward" | "timeout";
export type Verdict = "belongs" | "objects";

export interface CommunityRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: CommunityStatus;
  createdById: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
}

export interface MembershipRecord {
  id: string;
  communityId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface InviteRecord {
  id: string;
  communityId: string;
  tokenHash: string;
  invitedById: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedById: string | null;
  createdAt: Date;
}

export interface JoinRequestRecord {
  id: string;
  communityId: string;
  userId: string;
  note: string | null;
  status: JoinRequestStatus;
  panelMode: "all" | "sample";
  panelSize: number;
  minBelongs: number;
  maxObjections: number;
  round: number;
  deadlineAt: Date;
  decidedAt: Date | null;
  decidedBy: DecidedBy | null;
  fastTrackProof: string | null;
  createdAt: Date;
}

export interface SeatRecord {
  id: string;
  joinRequestId: string;
  userId: string;
  round: number;
  verdict: Verdict | null;
  votedAt: Date | null;
  expiredAt: Date | null;
}

export interface CycleRecord {
  id: string;
  communityId: string;
  weekKey: string;
  gatheringOpensAt: Date;
  votingOpensAt: Date;
  opensAt: Date;
  closesAt: Date;
  synthesizedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}

export interface ActiveChoiceRecord {
  id: string;
  userId: string;
  weekKey: string;
  communityId: string | null;
  chosenAt: Date;
  lockedAt: Date | null;
}

export type BallotKind = "topic" | "closure" | "chest_project";
export type BallotStatus = "open" | "decided" | "cancelled";

export interface BallotRecord {
  id: string;
  communityId: string;
  cycleId: string | null;
  kind: BallotKind;
  status: BallotStatus;
  opensAt: Date;
  closesAt: Date;
  decidedOptionId: string | null;
  createdAt: Date;
}

export interface BallotOptionRecord {
  id: string;
  ballotId: string;
  text: string;
  rationale: string | null;
  theme: string | null;
  ordinal: number;
}

export interface TopicRecord {
  id: string;
  cycleId: string;
  text: string;
  topicKey: string;
  theme: string | null;
  createdAt: Date;
}

export interface RecentTopicRow {
  weekKey: string;
  text: string;
  topicKey: string;
  theme: string | null;
}

export type MediaKind = "video" | "audio";
export type MediaStatus = "pending" | "ready" | "rejected" | "purged";

export interface MediaAssetRecord {
  id: string;
  ownerId: string;
  kind: MediaKind;
  storageKey: string;
  playbackId: string | null;
  mimeType: string;
  durationSec: number | null;
  bytes: number | null;
  contentHash: string | null;
  signalRatio: number | null;
  usedAt: Date | null;
  status: MediaStatus;
  purgeAfter: Date | null;
  purgedAt: Date | null;
  createdAt: Date;
}

export type ResponseVisibility = "community" | "public_after_close";
export type ResponseStatus = "submitted" | "withdrawn" | "rejected";

export interface RoomResponseRecord {
  id: string;
  topicId: string;
  circleId: string | null;
  userId: string;
  mediaId: string | null;
  visibility: ResponseVisibility;
  status: ResponseStatus;
  durationSec: number;
  createdAt: Date;
  withdrawnAt: Date | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
}

export interface CircleRecord {
  id: string;
  cycleId: string;
  ordinal: number;
  createdAt: Date;
}

export type ReactionVerdict = "agree" | "mixed" | "disagree";

export interface CommentRecord {
  id: string;
  responseId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CycleResultRecord {
  id: string;
  communityId: string;
  cycleId: string | null;
  weekKey: string;
  topicKey: string;
  topicText: string;
  closedAt: Date;
  agreePct: number;
  mixedPct: number;
  disagreePct: number;
  reactionCount: number;
  participantCount: number;
  responseCount: number;
  commentCount: number;
  createdAt: Date;
}

export type ChestProposalStatus = "proposed" | "on_ballot" | "chosen" | "not_chosen" | "withdrawn";

export interface ChestProposalRecord {
  id: string;
  communityId: string;
  userId: string;
  title: string;
  description: string | null;
  status: ChestProposalStatus;
  ballotId: string | null;
  optionId: string | null;
  createdAt: Date;
}

export interface ChestEntryRecord {
  id: string;
  communityId: string;
  cents: number;
  kind: string;
  memo: string | null;
  createdAt: Date;
}

export interface PublicResponseRow {
  response: RoomResponseRecord;
  topic: TopicRecord;
  cycle: CycleRecord;
  community: CommunityRecord;
  media: MediaAssetRecord;
}

export interface MyCommunityRow {
  community: CommunityRecord;
  membership: MembershipRecord;
  memberCount: number;
}

export interface OpenSeatRow {
  joinRequest: JoinRequestRecord;
  community: Pick<CommunityRecord, "id" | "name" | "slug">;
}

export interface NewJoinRequest {
  communityId: string;
  userId: string;
  note: string | null;
  panelMode: "all" | "sample";
  panelSize: number;
  minBelongs: number;
  maxObjections: number;
  deadlineAt: Date;
  at: Date;
}

export interface CommunityStore {
  /**
   * Run `fn` atomically. Everything inside sees and writes through `tx`; if
   * it throws, nothing it wrote survives.
   */
  transaction<T>(fn: (tx: CommunityStore) => Promise<T>): Promise<T>;

  // ── Communities ────────────────────────────────────────────────
  createCommunity(input: {
    slug: string;
    name: string;
    description: string | null;
    createdById: string;
    at: Date;
  }): Promise<CommunityRecord>;
  findCommunity(id: string): Promise<CommunityRecord | null>;
  slugTaken(slug: string): Promise<boolean>;
  /** Only moves from `from`; false if the status had already changed. */
  transitionCommunity(id: string, from: CommunityStatus, to: CommunityStatus, at: Date): Promise<boolean>;
  listFormingCreatedBefore(cutoff: Date): Promise<CommunityRecord[]>;
  countFormingCreatedBy(userId: string): Promise<number>;

  // ── Membership ─────────────────────────────────────────────────
  /** Creates, or reactivates a membership that had ended. */
  upsertMembership(input: {
    communityId: string;
    userId: string;
    role: MembershipRole;
    at: Date;
  }): Promise<MembershipRecord>;
  findMembership(communityId: string, userId: string): Promise<MembershipRecord | null>;
  /** False if there was no active membership to end. */
  endMembership(communityId: string, userId: string, at: Date): Promise<boolean>;
  countActiveMembers(communityId: string): Promise<number>;
  listActiveMemberIds(communityId: string): Promise<string[]>;
  listMyCommunities(userId: string): Promise<MyCommunityRow[]>;

  // ── Founding invites ───────────────────────────────────────────
  createInvite(input: {
    communityId: string;
    tokenHash: string;
    invitedById: string;
    expiresAt: Date;
    at: Date;
  }): Promise<InviteRecord>;
  findInviteByTokenHash(tokenHash: string): Promise<InviteRecord | null>;
  countOpenInvites(communityId: string, now: Date): Promise<number>;
  /** Single use: false if someone already used it. */
  consumeInvite(id: string, userId: string, at: Date): Promise<boolean>;

  // ── Join requests ──────────────────────────────────────────────
  findJoinRequest(id: string): Promise<JoinRequestRecord | null>;
  findJoinRequestFor(communityId: string, userId: string): Promise<JoinRequestRecord | null>;
  /**
   * Create the request, or reset a previous one back to a fresh round 1 —
   * removing its old seats. One row per person per community.
   */
  resetJoinRequest(input: NewJoinRequest): Promise<JoinRequestRecord>;
  /** Only decides a pending request; false if it was already decided. */
  decideJoinRequest(
    id: string,
    input: { status: "admitted" | "denied"; decidedBy: DecidedBy; at: Date; fastTrackProof?: string }
  ): Promise<boolean>;
  startRound(id: string, round: number, deadlineAt: Date): Promise<void>;
  listPendingDue(now: Date): Promise<JoinRequestRecord[]>;
  listPendingForCommunity(communityId: string): Promise<JoinRequestRecord[]>;

  // ── Seats ──────────────────────────────────────────────────────
  createSeats(joinRequestId: string, userIds: string[], round: number): Promise<void>;
  listSeats(joinRequestId: string): Promise<SeatRecord[]>;
  /** One verdict per seat, never changed: false if absent, expired, or already cast. */
  castVerdict(joinRequestId: string, userId: string, verdict: Verdict, at: Date): Promise<boolean>;
  /** Expire these users' seats on a request — only the ones still unanswered. */
  expireSeats(joinRequestId: string, userIds: string[], at: Date): Promise<void>;
  /** Someone left: their unanswered seats in that community no longer count. */
  expireSilentSeatsForMember(communityId: string, userId: string, at: Date): Promise<void>;
  /** For each user, how many unanswered seats they hold on pending requests. */
  openSeatCounts(userIds: string[]): Promise<Map<string, number>>;
  listOpenSeatsFor(userId: string): Promise<OpenSeatRow[]>;

  // ── People ─────────────────────────────────────────────────────
  displayNames(userIds: string[]): Promise<Map<string, string | null>>;

  // ── Cycles ─────────────────────────────────────────────────────
  listActiveCommunityIds(): Promise<string[]>;
  /** Create the cycle if it doesn't exist; an existing one is returned untouched. */
  ensureCycle(input: {
    communityId: string;
    weekKey: string;
    gatheringOpensAt: Date;
    votingOpensAt: Date;
    opensAt: Date;
    closesAt: Date;
    at: Date;
  }): Promise<CycleRecord>;
  findCycle(id: string): Promise<CycleRecord | null>;
  findCycleFor(communityId: string, weekKey: string): Promise<CycleRecord | null>;
  listCyclesFor(communityIds: string[], weekKey: string): Promise<CycleRecord[]>;

  // ── Active choice ──────────────────────────────────────────────
  findActiveChoice(userId: string, weekKey: string): Promise<ActiveChoiceRecord | null>;
  /** Set or change the choice. Null when the choice is already locked. */
  setActiveChoice(input: {
    userId: string;
    weekKey: string;
    communityId: string | null;
    at: Date;
  }): Promise<ActiveChoiceRecord | null>;
  /** Lock a choice that still points at `communityId`. False if it moved or was already locked. */
  lockActiveChoice(userId: string, weekKey: string, communityId: string, at: Date): Promise<boolean>;
  countActiveChoices(communityId: string, weekKey: string): Promise<number>;

  // ── Suggestions ────────────────────────────────────────────────
  createSuggestion(input: { cycleId: string; userId: string; text: string; at: Date }): Promise<void>;
  listMySuggestions(cycleId: string, userId: string): Promise<{ text: string; createdAt: Date }[]>;
  /** Text only — authorship never leaves storage through this. */
  listSuggestionTexts(cycleId: string): Promise<string[]>;
  /** Cycles whose voting has begun and whose ballot hasn't been built. */
  listCyclesAwaitingSynthesis(now: Date): Promise<CycleRecord[]>;
  /** Claim synthesis for a cycle. False if another run already has. */
  markSynthesized(cycleId: string, at: Date): Promise<boolean>;

  // ── Ballots ────────────────────────────────────────────────────
  createBallot(input: {
    communityId: string;
    cycleId: string | null;
    kind: BallotKind;
    opensAt: Date;
    closesAt: Date;
    options: { text: string; rationale: string | null; theme: string | null }[];
    at: Date;
  }): Promise<BallotRecord>;
  findBallot(id: string): Promise<BallotRecord | null>;
  listBallotOptions(ballotId: string): Promise<BallotOptionRecord[]>;
  findCycleBallot(cycleId: string, kind: BallotKind): Promise<BallotRecord | null>;
  listCommunityBallots(communityId: string, statuses: BallotStatus[]): Promise<BallotRecord[]>;
  latestBallot(communityId: string, kind: BallotKind): Promise<BallotRecord | null>;
  /** One vote per person per ballot; casting again moves it. */
  castBallotVote(input: { ballotId: string; optionId: string; userId: string; at: Date }): Promise<void>;
  findBallotVote(ballotId: string, userId: string): Promise<string | null>;
  /** Option ids only — who voted for what never leaves storage through this. */
  listBallotVoteOptionIds(ballotId: string): Promise<string[]>;
  listBallotsDue(now: Date): Promise<BallotRecord[]>;
  /** Only decides an open ballot; false if it was already decided. */
  decideBallot(id: string, decidedOptionId: string | null, at: Date): Promise<boolean>;

  // ── Topics ─────────────────────────────────────────────────────
  /** One topic per cycle; an existing one is returned untouched. */
  createTopic(input: { cycleId: string; text: string; topicKey: string; theme: string | null; at: Date }): Promise<TopicRecord>;
  findTopic(id: string): Promise<TopicRecord | null>;
  findTopicForCycle(cycleId: string): Promise<TopicRecord | null>;
  /** The community's chosen topics before `beforeWeekKey`, newest first. */
  listRecentTopics(communityId: string, beforeWeekKey: string, limit: number): Promise<RecentTopicRow[]>;

  // ── Media ──────────────────────────────────────────────────────
  createMediaAsset(input: {
    ownerId: string;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    durationSec: number;
    bytes: number;
    purgeAfter: Date;
    at: Date;
  }): Promise<MediaAssetRecord>;
  findMediaAsset(id: string): Promise<MediaAssetRecord | null>;
  countPendingUploads(ownerId: string): Promise<number>;
  /** Only moves a pending asset; false if it had already been completed or rejected. */
  markMediaReady(
    id: string,
    input: { bytes: number; contentHash: string | null; signalRatio: number | null }
  ): Promise<boolean>;
  markMediaRejected(id: string, at: Date): Promise<void>;
  setMediaPurgeAfter(ids: string[], purgeAfter: Date): Promise<void>;
  listMediaDueForPurge(now: Date, limit: number): Promise<MediaAssetRecord[]>;
  markMediaPurged(id: string, at: Date): Promise<void>;
  /** Earlier assets of this owner, with the same content hash, that were submitted as a response. */
  findUsedMediaByHash(ownerId: string, contentHash: string, excludeId: string): Promise<MediaAssetRecord[]>;
  markMediaUsed(id: string, at: Date): Promise<void>;

  // ── Responses ──────────────────────────────────────────────────
  findResponse(id: string): Promise<RoomResponseRecord | null>;
  /** In any status — a withdrawn response still occupies the one slot. */
  findResponseFor(topicId: string, userId: string): Promise<RoomResponseRecord | null>;
  /** Throws DuplicateResponseError if this person already has a response to this topic. */
  createResponse(input: {
    topicId: string;
    circleId: string;
    userId: string;
    mediaId: string;
    visibility: ResponseVisibility;
    durationSec: number;
    at: Date;
  }): Promise<RoomResponseRecord>;
  /** Only withdraws a submitted response; false otherwise. */
  withdrawResponse(id: string, at: Date): Promise<boolean>;
  isMediaAttached(mediaId: string): Promise<boolean>;

  // ── Circles ────────────────────────────────────────────────────
  listCircles(cycleId: string): Promise<{ circle: CircleRecord; memberIds: string[] }[]>;
  /** One circle per ordinal per cycle; an existing one is returned. */
  createCircle(cycleId: string, ordinal: number, at: Date): Promise<CircleRecord>;
  /** One seat per person per cycle. False if they already have one. */
  seatInCircle(circleId: string, cycleId: string, userId: string): Promise<boolean>;
  findCircleSeat(cycleId: string, userId: string): Promise<string | null>;
  /** People who shared a circle with `userId` in this community's recent weeks, and how often. */
  recentCirclePartners(
    communityId: string,
    userId: string,
    beforeWeekKey: string,
    weeks: number
  ): Promise<Map<string, number>>;

  // ── The room ───────────────────────────────────────────────────
  // Deliberately no method here aggregates reactions. Totals are computed only
  // at settlement (countTopicReactions), and the reveal test fails if anything
  // calls that while a room is open.
  listCircleResponses(circleId: string): Promise<RoomResponseRecord[]>;
  upsertReaction(input: { responseId: string; userId: string; verdict: ReactionVerdict; at: Date }): Promise<void>;
  myReactions(userId: string, responseIds: string[]): Promise<Map<string, ReactionVerdict>>;
  commentCounts(responseIds: string[]): Promise<Map<string, number>>;
  createComment(input: {
    responseId: string;
    userId: string;
    parentId: string | null;
    body: string;
    at: Date;
  }): Promise<CommentRecord>;
  findComment(id: string): Promise<CommentRecord | null>;
  listComments(responseId: string): Promise<CommentRecord[]>;
  softDeleteComment(id: string, at: Date): Promise<void>;
  setCommentLike(commentId: string, userId: string, liked: boolean, at: Date): Promise<void>;
  commentLikes(commentIds: string[], userId: string): Promise<{ counts: Map<string, number>; mine: Set<string> }>;
  createReport(input: {
    reporterId: string;
    responseId: string | null;
    commentId: string | null;
    reason: string;
    note: string | null;
    at: Date;
  }): Promise<void>;

  // ── Settlement ─────────────────────────────────────────────────
  listCyclesToSettle(now: Date): Promise<CycleRecord[]>;
  /** Every response to a topic, in any status. */
  listTopicResponses(topicId: string): Promise<RoomResponseRecord[]>;
  /**
   * The only reaction aggregate in the system. Called by settlement after a
   * room has closed, and by nothing else — tests/community-settle.test.ts
   * fails if it runs while a room is open.
   */
  countTopicReactions(topicId: string): Promise<{ agree: number; mixed: number; disagree: number }>;
  countTopicComments(topicId: string): Promise<number>;
  /** One result per cycle; re-running settlement overwrites it with the same numbers. */
  upsertCycleResult(input: Omit<CycleResultRecord, "id" | "createdAt"> & { at: Date }): Promise<CycleResultRecord>;
  publishResponses(ids: string[], publishedAt: Date, expiresAt: Date): Promise<void>;
  /** Removes responses, and with them their reactions and comments. */
  deleteResponses(ids: string[]): Promise<void>;
  /** The week's conversation expires: every reaction and comment on the topic goes. */
  deleteTopicConversation(topicId: string): Promise<void>;
  markSettled(cycleId: string, at: Date): Promise<boolean>;
  findCycleResult(cycleId: string): Promise<CycleResultRecord | null>;
  listCommunityResults(communityId: string, limit: number): Promise<CycleResultRecord[]>;
  listExpiredPublicResponses(now: Date, limit: number): Promise<RoomResponseRecord[]>;

  // ── Integrity ──────────────────────────────────────────────────
  createStrike(input: {
    userId: string;
    reason: string;
    severity: "low" | "medium" | "high";
    responseId: string | null;
    expiresAt: Date;
    at: Date;
  }): Promise<void>;
  listRecentStrikes(userId: string, since: Date): Promise<{ createdAt: Date; reason: string }[]>;

  // ── Chest ──────────────────────────────────────────────────────
  chestBalance(communityId: string): Promise<number>;
  listChestEntries(communityId: string, limit: number): Promise<ChestEntryRecord[]>;
  createChestEntry(input: { communityId: string; cents: number; kind: string; memo: string | null; at: Date }): Promise<void>;
  createChestProposal(input: {
    communityId: string;
    userId: string;
    title: string;
    description: string | null;
    at: Date;
  }): Promise<ChestProposalRecord>;
  listChestProposals(communityId: string, statuses: ChestProposalStatus[]): Promise<ChestProposalRecord[]>;
  attachProposalsToBallot(links: { proposalId: string; optionId: string }[], ballotId: string): Promise<void>;
  /** Mark the ballot's chosen proposal, and every other proposal on it as not chosen. */
  resolveChestBallot(ballotId: string, chosenOptionId: string | null): Promise<ChestProposalRecord | null>;

  // ── Discover ───────────────────────────────────────────────────
  /** Published, unexpired, still-submitted responses with ready media, newest first. */
  listPublicResponses(now: Date, limit: number): Promise<PublicResponseRow[]>;
  findPublicResponse(id: string, now: Date): Promise<PublicResponseRow | null>;
}

/** The one-response-per-topic constraint, surfaced from storage. */
export class DuplicateResponseError extends Error {
  constructor() {
    super("Response already exists for this topic");
    this.name = "DuplicateResponseError";
  }
}
