/**
 * What the API sends about communities, and so what the phone and the web
 * app render.
 *
 * These shapes are the privacy boundary as much as they are types. Several of
 * the community's rules are enforced simply by what a view leaves out — who
 * voted, a tally while a room is open, a deadline that would reveal a redraw
 * — and apps/api's anonymity and reveal tests scan real responses for the
 * keys that must never appear. Add a field here deliberately.
 *
 * Dates are ISO strings: this is the wire format, not the database's.
 */

import type { CycleStage } from "./schedule.js";

// ─── Communities & admission ─────────────────────────────────────

export interface CommunityView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "forming" | "active" | "archived";
  memberCount: number;
  /** Forming only: how many more founders must accept before it's real. */
  foundersNeeded: number | null;
  createdAt: string;
  activatedAt: string | null;
}

export interface MembershipView {
  role: "steward" | "member";
  joinedAt: string;
}

/**
 * What an applicant learns about their own request: the outcome, and when they
 * can ask again. Never a count, never who, never a deadline — a moving deadline
 * would reveal that a panel was redrawn.
 */
export interface JoinRequestView {
  status: "pending" | "admitted" | "denied";
  requestedAt: string;
  canReapplyAt: string | null;
}

export interface CommunityDetail {
  community: CommunityView;
  membership: MembershipView | null;
  joinRequest: JoinRequestView | null;
}

export interface InvitePreview {
  community: CommunityView;
  invitedBy: string | null;
}

export interface AdmissionSeatView {
  joinRequestId: string;
  community: { id: string; name: string; slug: string };
  applicant: { displayName: string | null };
  note: string | null;
  respondBy: string;
}

export interface CommunityRef {
  id: string;
  name: string;
  slug: string;
}

// ─── Ballots ─────────────────────────────────────────────────────

export interface BallotOptionView {
  id: string;
  text: string;
  /** Kairo's one line on why this option is here. Never names anyone. */
  rationale: string | null;
}

/**
 * A ballot as a member sees it. There is no count here, open or decided —
 * for a topic the room learns what won, not by how much.
 */
export interface BallotView {
  id: string;
  kind: "topic" | "closure" | "chest_project";
  status: "open" | "decided" | "cancelled";
  opensAt: string;
  closesAt: string;
  options: BallotOptionView[];
  myVote: string | null;
  decidedOptionId: string | null;
}

export interface MySuggestionsView {
  suggestions: { text: string; createdAt: string }[];
  remaining: number;
}

// ─── Media ───────────────────────────────────────────────────────

export interface UploadTicketView {
  assetId: string;
  /** PUT the file here, directly — the API never handles the bytes. */
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export interface MediaAssetView {
  id: string;
  kind: "video" | "audio";
  status: "pending" | "ready" | "rejected" | "purged";
  durationSec: number | null;
  bytes: number | null;
}

export interface PlaybackView {
  kind: "video" | "audio";
  url: string;
  /** Request a fresh one after this; the URL stops working. */
  expiresAt: string;
  durationSec: number | null;
}

// ─── Responses & the gate ────────────────────────────────────────

export type ResponseStatus = "submitted" | "withdrawn" | "rejected";

export interface MyResponseView {
  id: string;
  topicId: string;
  status: ResponseStatus;
  visibility: "community" | "public_after_close";
  kind: "video" | "audio";
  durationSec: number;
  createdAt: string;
  withdrawnAt: string | null;
}

/**
 * Everything a member needs to render a topic before they've spoken — the
 * locked room. Deliberately nothing about anyone else: no count of who has
 * spoken, no names, no hint of what they said.
 */
export interface TopicView {
  id: string;
  text: string;
  community: CommunityRef;
  cycle: { id: string; weekKey: string; stage: CycleStage; opensAt: string; closesAt: string };
  you: {
    /** This is your community for the week. */
    chosen: boolean;
    /** You chose a different community this week. */
    choseElsewhere: boolean;
    response: MyResponseView | null;
    /** "open" once you've spoken; "locked" until then. */
    room: "locked" | "open";
  };
}

// ─── The room ────────────────────────────────────────────────────

/**
 * One response in a room. There is no agree/mixed/disagree count here, and
 * there can't be: while a room is open the totals don't exist anywhere the API
 * can reach. You see your own reaction, nothing else.
 */
export interface RoomResponseItem {
  id: string;
  speaker: { displayName: string | null };
  kind: "video" | "audio";
  durationSec: number;
  createdAt: string;
  myReaction: "agree" | "mixed" | "disagree" | null;
  /** Comments are live by design; their number isn't a verdict. */
  commentCount: number;
}

export interface RoomView {
  topic: { id: string; text: string };
  community: CommunityRef;
  cycle: { weekKey: string; stage: CycleStage; closesAt: string };
  /** How many voices are in your circle — "ten voices from Favour House this week." */
  circle: { voices: number };
  mine: MyResponseView;
  /** Everyone else in your circle, in an order seeded for you — different for each listener, stable for you. */
  responses: RoomResponseItem[];
}

export interface CommentView {
  id: string;
  parentId: string | null;
  author: { displayName: string | null };
  isMine: boolean;
  /** null once deleted — the thread keeps its shape, the words go. */
  body: string | null;
  deleted: boolean;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

// ─── The reveal & history ────────────────────────────────────────

/** What a week leaves behind. Holds no individual — only where the room landed. */
export interface CycleResultView {
  weekKey: string;
  closedAt: string;
  topic: { text: string; topicKey: string };
  /** Always REVEAL_HEADLINE. */
  headline: string;
  agreePct: number;
  mixedPct: number;
  disagreePct: number;
  /** Members who spoke. */
  voices: number;
  reactions: number;
  comments: number;
}

export interface CommunityHistoryView {
  community: CommunityRef;
  results: CycleResultView[];
  /** Questions the community has come back to — where "we changed" shows. */
  recurring: { topicKey: string; text: string; results: CycleResultView[] }[];
}

// ─── Integrity & chest ───────────────────────────────────────────

/** Your own standing — shown to you plainly, so a restriction is never a mystery. */
export interface StandingView {
  restrictedUntil: string | null;
  recentStrikes: number;
}

export interface ChestProposalView {
  id: string;
  title: string;
  description: string | null;
  status: "proposed" | "on_ballot" | "chosen" | "not_chosen" | "withdrawn";
  /** Proposals carry no author, like suggestions — only whether it's yours. */
  isMine: boolean;
  createdAt: string;
}

/**
 * A shared goal the whole community works toward — weeks completed
 * together — with a fixed reward. `progressWeeks` is always counted live
 * from closed weeks since the goal was set, never stored.
 */
export interface CommunityGoalView {
  id: string;
  title: string;
  targetWeeks: number;
  progressWeeks: number;
  rewardLabel: string;
  achievedAt: string | null;
  createdAt: string;
}

export interface ChestView {
  community: CommunityRef;
  /** A ledger. Nothing pays out yet; this is what the community has earned. */
  balanceCents: number;
  currency: "USD";
  entries: { kind: string; cents: number; memo: string | null; createdAt: string }[];
  proposals: ChestProposalView[];
  openBallotId: string | null;
}

// ─── Discover ────────────────────────────────────────────────────

export interface DiscoverItem {
  id: string;
  speaker: { displayName: string | null };
  kind: "video" | "audio";
  durationSec: number;
  publishedAt: string;
}

/** A row on Discover: the thought first, then where it came from. */
export interface DiscoverRow {
  topic: { text: string; topicKey: string };
  community: { name: string; slug: string };
  weekKey: string;
  responses: DiscoverItem[];
}

export interface DiscoverView {
  rows: DiscoverRow[];
}

export interface DiscoverResponseView {
  item: DiscoverItem;
  topic: { text: string; topicKey: string };
  community: { name: string; slug: string };
  playback: PlaybackView;
  /** Stay in the conversation: other voices on the same question from the same community. */
  next: DiscoverItem[];
}

// ─── The week ────────────────────────────────────────────────────

export interface CycleView {
  id: string;
  weekKey: string;
  stage: CycleStage;
  gatheringOpensAt: string;
  votingOpensAt: string;
  opensAt: string;
  closesAt: string;
  community: CommunityRef;
  /** The week's question, once the vote has chosen it. */
  topic: { id: string; text: string } | null;
  /** The ballot for this week's topic, while it's being chosen. */
  ballotId: string | null;
  you: {
    suggestions: number;
    voted: boolean;
    /** "none" | "submitted" | "withdrawn" — withdrawn can never be replaced. */
    response: "none" | "submitted" | "withdrawn" | "rejected";
  };
}

export interface ActiveChoiceView {
  /** null means sitting this week out — no penalty, no streak, no guilt. */
  communityId: string | null;
  /** Locked once you've spoken; the choice can't move after that. */
  locked: boolean;
}

export interface WeekView {
  weekKey: string;
  choice: ActiveChoiceView | null;
  /** One per active community you belong to that has a room this week. */
  cycles: CycleView[];
}

export interface MyWeekView {
  now: string;
  /** The zone the schedule runs on. Clients render every deadline in the viewer's own zone. */
  timeZone: string;
  current: WeekView;
  next: WeekView;
}
