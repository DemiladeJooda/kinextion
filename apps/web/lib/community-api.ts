import "server-only";

/**
 * Reading the community API from the web app.
 *
 * Same shape as lib/data-api.ts: server-side, token minted in a Server
 * Component, failures degrade to null rather than taking a page down. Two
 * differences worth knowing:
 *
 *   - Discover is public. It takes no token, so a signed-out visitor gets the
 *     same server-rendered page as a member.
 *   - A locked room is not a failure. The API answers 403 UNLOCK_REQUIRED, and
 *     that's the page's content, so these helpers return the refusal's `code`
 *     instead of swallowing it.
 */

import { auth } from "@clerk/nextjs/server";
import type {
  BallotView,
  CommunityDetail,
  CommunityHistoryView,
  CycleResultView,
  DiscoverResponseView,
  DiscoverView,
  MyWeekView,
  RoomView,
  TopicView,
} from "@kinextion/shared";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export interface ApiResult<T> {
  data: T | null;
  /** The refusal's stable code, when the API refused for a reason the page renders. */
  code: string | null;
  /** True when the API couldn't be reached at all. */
  unreachable: boolean;
}

async function request<T>(path: string, { withAuth = true }: { withAuth?: boolean } = {}): Promise<ApiResult<T>> {
  const base = apiBase();
  if (!base) return { data: null, code: null, unreachable: true };

  try {
    const headers: Record<string, string> = {};
    if (withAuth) {
      const { getToken } = await auth();
      const token = await getToken();
      if (!token) return { data: null, code: "UNAUTHENTICATED", unreachable: false };
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: T; code?: string }
      | null;

    if (!res.ok || !payload?.success) {
      return { data: null, code: payload?.code ?? `HTTP_${res.status}`, unreachable: false };
    }
    return { data: payload.data ?? null, code: null, unreachable: false };
  } catch {
    return { data: null, code: null, unreachable: true };
  }
}

// ─── Public ──────────────────────────────────────────────────────

export const loadDiscover = (seed: string) =>
  request<DiscoverView>(`/api/discover?seed=${encodeURIComponent(seed)}`, { withAuth: false });

export const loadDiscoverResponse = (id: string, seed: string) =>
  request<DiscoverResponseView>(`/api/discover/responses/${id}?seed=${encodeURIComponent(seed)}`, {
    withAuth: false,
  });

// ─── Signed in ───────────────────────────────────────────────────

export const loadMyWeek = () => request<MyWeekView>("/api/community/week");

export const loadMyCommunities = () => request<CommunityDetail[]>("/api/community/communities");

export const loadTopic = (topicId: string) => request<TopicView>(`/api/community/topics/${topicId}`);

export const loadRoom = (topicId: string) => request<RoomView>(`/api/community/topics/${topicId}/room`);

export const loadResult = (topicId: string) =>
  request<CycleResultView>(`/api/community/topics/${topicId}/result`);

export const loadBallot = (ballotId: string) => request<BallotView>(`/api/community/ballots/${ballotId}`);

export const loadCommunity = (communityId: string) =>
  request<CommunityDetail>(`/api/community/communities/${communityId}`);

export const loadHistory = (communityId: string) =>
  request<CommunityHistoryView>(`/api/community/communities/${communityId}/history`);

/** A stable-per-visit shuffle seed, so a refresh doesn't reshuffle the page. */
export function discoverSeed(): string {
  const hour = Math.floor(Date.now() / 3_600_000);
  return `web${hour}`;
}
