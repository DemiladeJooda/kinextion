/**
 * The community API, from the phone.
 *
 * Same shape as the rest of services/: plain functions taking the caller's
 * Clerk token, wrapped by hooks/useApi.ts for screens. Media is the one
 * exception to "everything goes through apiRequest" — the file itself is PUT
 * straight to storage with a presigned URL, so the API never carries it.
 */

import * as Crypto from "expo-crypto";
// SDK 54 moved these functions (uploadAsync, readAsStringAsync) to /legacy.
import * as FileSystem from "expo-file-system/legacy";
import type {
  AdmissionSeatView,
  AdmissionVerdict,
  BallotView,
  ChestView,
  CommunityDetail,
  CommunityGoalInput,
  CommunityGoalView,
  CommunityHistoryView,
  CommentInput,
  CommentView,
  CycleResultView,
  DiscoverView,
  DiscoverResponseView,
  MySuggestionsView,
  MyResponseView,
  MyWeekView,
  PlaybackView,
  ReactionVerdict,
  RoomView,
  StandingView,
  TopicView,
  UploadTicketView,
} from "@kinextion/shared";
import { apiRequest } from "./client";

export type {
  AdmissionSeatView,
  AdmissionVerdict,
  BallotView,
  ChestView,
  CommunityDetail,
  CommunityGoalInput,
  CommunityGoalView,
  CommunityHistoryView,
  CommentView,
  CycleResultView,
  DiscoverItem,
  DiscoverView,
  DiscoverResponseView,
  DiscoverRow,
  MyResponseView,
  MyWeekView,
  PlaybackView,
  ReactionVerdict,
  RoomView,
  StandingView,
  TopicView,
} from "@kinextion/shared";

const base = "/api/community";
const discoverBase = "/api/discover";

// ─── Discover — public, no-session browsing of what communities made public ──

export const getDiscover = (token: string | null, seed: string) =>
  apiRequest<DiscoverView>(discoverBase, { token, query: { seed } });

export const getDiscoverResponse = (token: string | null, responseId: string, seed: string) =>
  apiRequest<DiscoverResponseView>(`${discoverBase}/responses/${responseId}`, {
    token,
    query: { seed },
  });

// ─── The week ───────────────────────────────────────────────────────────────

export const getMyWeek = (token: string | null) => apiRequest<MyWeekView>(`${base}/week`, { token });

export const chooseActiveCommunity = (
  token: string | null,
  weekKey: string,
  communityId: string | null
) =>
  apiRequest<{ communityId: string | null; locked: boolean }>(`${base}/week/active`, {
    method: "PUT",
    token,
    body: { weekKey, communityId },
  });

export const listMyCommunities = (token: string | null) =>
  apiRequest<CommunityDetail[]>(`${base}/communities`, { token });

export const getCommunity = (token: string | null, id: string) =>
  apiRequest<CommunityDetail>(`${base}/communities/${id}`, { token });

export const getCommunityHistory = (token: string | null, id: string) =>
  apiRequest<CommunityHistoryView>(`${base}/communities/${id}/history`, { token });

export const getChest = (token: string | null, id: string) =>
  apiRequest<ChestView>(`${base}/communities/${id}/chest`, { token });

export const proposeChestProject = (
  token: string | null,
  id: string,
  input: { title: string; description?: string }
) => apiRequest<{ id: string }>(`${base}/communities/${id}/chest/proposals`, {
  method: "POST",
  token,
  body: input,
});

export const callChestVote = (token: string | null, id: string) =>
  apiRequest<{ ballotId: string }>(`${base}/communities/${id}/chest/ballot`, {
    method: "POST",
    token,
  });

// ─── Goals ──────────────────────────────────────────────────────────────────

export const getCommunityGoal = (token: string | null, id: string) =>
  apiRequest<CommunityGoalView | null>(`${base}/communities/${id}/goal`, { token });

export const setCommunityGoal = (token: string | null, id: string, input: CommunityGoalInput) =>
  apiRequest<CommunityGoalView>(`${base}/communities/${id}/goal`, {
    method: "POST",
    token,
    body: input,
  });

// ─── Admission ────────────────────────────────────────────────────────────────

export const listMyAdmissionSeats = (token: string | null) =>
  apiRequest<AdmissionSeatView[]>(`${base}/admissions/pending`, { token });

export const castAdmissionVote = (
  token: string | null,
  joinRequestId: string,
  verdict: AdmissionVerdict
) =>
  apiRequest<{ recorded: true }>(`${base}/admissions/${joinRequestId}/vote`, {
    method: "POST",
    token,
    body: { verdict },
  });

// ─── Topics & ballots ───────────────────────────────────────────────────────

export const suggestTopic = (token: string | null, cycleId: string, text: string) =>
  apiRequest<MySuggestionsView>(`${base}/cycles/${cycleId}/suggestions`, {
    method: "POST",
    token,
    body: { text },
  });

export const getMySuggestions = (token: string | null, cycleId: string) =>
  apiRequest<MySuggestionsView>(`${base}/cycles/${cycleId}/suggestions/mine`, { token });

export const getBallot = (token: string | null, ballotId: string) =>
  apiRequest<BallotView>(`${base}/ballots/${ballotId}`, { token });

export const voteOnBallot = (token: string | null, ballotId: string, optionId: string) =>
  apiRequest<{ recorded: true }>(`${base}/ballots/${ballotId}/vote`, {
    method: "POST",
    token,
    body: { optionId },
  });

// ─── The room ───────────────────────────────────────────────────────────────

export const getTopic = (token: string | null, topicId: string) =>
  apiRequest<TopicView>(`${base}/topics/${topicId}`, { token });

export const getRoom = (token: string | null, topicId: string) =>
  apiRequest<RoomView>(`${base}/topics/${topicId}/room`, { token });

export const getTopicResult = (token: string | null, topicId: string) =>
  apiRequest<CycleResultView>(`${base}/topics/${topicId}/result`, { token });

export const getResponsePlayback = (token: string | null, responseId: string) =>
  apiRequest<PlaybackView>(`${base}/responses/${responseId}/playback`, { token });

export const reactToResponse = (token: string | null, responseId: string, verdict: ReactionVerdict) =>
  apiRequest<{ recorded: true }>(`${base}/responses/${responseId}/reaction`, {
    method: "PUT",
    token,
    body: { verdict },
  });

export const listComments = (token: string | null, responseId: string) =>
  apiRequest<CommentView[]>(`${base}/responses/${responseId}/comments`, { token });

export const addComment = (token: string | null, responseId: string, input: CommentInput) =>
  apiRequest<CommentView>(`${base}/responses/${responseId}/comments`, {
    method: "POST",
    token,
    body: input,
  });

export const likeComment = (token: string | null, commentId: string, liked: boolean) =>
  apiRequest<{ liked: boolean }>(`${base}/comments/${commentId}/like`, {
    method: liked ? "PUT" : "DELETE",
    token,
  });

export const reportResponse = (
  token: string | null,
  responseId: string,
  input: { reason: string; note?: string }
) => apiRequest<{ recorded: true }>(`${base}/responses/${responseId}/report`, {
  method: "POST",
  token,
  body: input,
});

export const withdrawResponse = (token: string | null, responseId: string) =>
  apiRequest<MyResponseView>(`${base}/responses/${responseId}`, { method: "DELETE", token });

export const getMyStanding = (token: string | null) =>
  apiRequest<StandingView>(`${base}/me/standing`, { token });

// ─── Recording & submitting ─────────────────────────────────────────────────

export interface LocalRecording {
  uri: string;
  kind: "video" | "audio";
  mimeType: string;
  durationSec: number;
  bytes: number;
  /** Fraction of the recording above the silence threshold, where we could measure it. */
  signalRatio?: number;
}

/**
 * A cheap fingerprint of the file: its size, plus the first and last 64KB.
 *
 * Hashing a 300MB video on a phone would take long enough to be felt, and
 * this is only here to catch the same file being submitted twice — two
 * different recordings never collide, and re-uploading the identical file
 * always matches.
 */
export async function fingerprintFile(uri: string, bytes: number): Promise<string | undefined> {
  const CHUNK = 64 * 1024;
  try {
    const head = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: CHUNK,
    });
    const tail =
      bytes > CHUNK
        ? await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
            position: Math.max(0, bytes - CHUNK),
            length: CHUNK,
          })
        : "";
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${bytes}:${head}:${tail}`);
  } catch {
    // A fingerprint is a nicety; never block a submission on it.
    return undefined;
  }
}

/**
 * Upload a finished recording: ask for a ticket, PUT the file straight to
 * storage, then tell the API it landed. Returns the media id to submit with.
 */
export async function uploadRecording(
  token: string | null,
  recording: LocalRecording,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const ticket = await apiRequest<UploadTicketView>(`${base}/media/uploads`, {
    method: "POST",
    token,
    body: {
      kind: recording.kind,
      mimeType: recording.mimeType,
      durationSec: Math.round(recording.durationSec),
      bytes: recording.bytes,
    },
  });

  onProgress?.(0);
  const result = await FileSystem.uploadAsync(ticket.uploadUrl, recording.uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: ticket.headers,
  });
  if (result.status >= 300) {
    throw new Error("The upload didn't finish. Check your connection and try again.");
  }
  onProgress?.(1);

  const contentHash = await fingerprintFile(recording.uri, recording.bytes);
  await apiRequest(`${base}/media/${ticket.assetId}/complete`, {
    method: "POST",
    token,
    body: {
      ...(contentHash ? { contentHash } : {}),
      ...(recording.signalRatio !== undefined ? { signalRatio: recording.signalRatio } : {}),
    },
  });

  return ticket.assetId;
}

export const submitResponse = (
  token: string | null,
  topicId: string,
  input: { mediaId: string; visibility: "community" | "public_after_close" }
) =>
  apiRequest<MyResponseView>(`${base}/topics/${topicId}/responses`, {
    method: "POST",
    token,
    body: input,
  });
