"use client";

/**
 * Writes from the browser.
 *
 * Reads are server-rendered (lib/community-api.ts); the handful of things a
 * listener does inside a room — react, comment, like — happen after the page
 * has loaded, so they go straight to the API with the user's Clerk token, the
 * same way the phone does. The API is the only thing enforcing room rules, so
 * a write from here is no more trusted than one from anywhere else.
 */

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import type { CommentInput, CommentView, ReactionVerdict } from "@kinextion/shared";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export class CommunityApiError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function useCommunityApi() {
  const { getToken } = useAuth();

  const send = useCallback(
    async <T>(path: string, init: { method: string; body?: unknown } = { method: "GET" }): Promise<T> => {
      const token = await getToken();
      let res: Response;
      try {
        res = await fetch(`${apiBase()}/api/community${path}`, {
          method: init.method,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
          },
          body: init.body ? JSON.stringify(init.body) : undefined,
        });
      } catch {
        // The request never reached the API: it's down, unreachable, or the
        // browser refused it. Say which, rather than "something went wrong".
        throw new CommunityApiError(
          `Couldn't reach the API at ${apiBase() || "(no NEXT_PUBLIC_API_URL set)"}.`,
          "UNREACHABLE"
        );
      }
      const payload = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: T; error?: string; code?: string }
        | null;
      if (!res.ok || !payload?.success) {
        throw new CommunityApiError(
          payload?.error ?? "Something went wrong.",
          payload?.code ?? `HTTP_${res.status}`
        );
      }
      return payload.data as T;
    },
    [getToken]
  );

  return {
    react: (responseId: string, verdict: ReactionVerdict) =>
      send<{ recorded: true }>(`/responses/${responseId}/reaction`, { method: "PUT", body: { verdict } }),
    playback: (responseId: string) =>
      send<{ url: string; kind: "video" | "audio"; durationSec: number | null }>(
        `/responses/${responseId}/playback`
      ),
    comments: (responseId: string) => send<CommentView[]>(`/responses/${responseId}/comments`),
    comment: (responseId: string, input: CommentInput) =>
      send<CommentView>(`/responses/${responseId}/comments`, { method: "POST", body: input }),
    like: (commentId: string, liked: boolean) =>
      send<{ liked: boolean }>(`/comments/${commentId}/like`, { method: liked ? "PUT" : "DELETE" }),
    vote: (ballotId: string, optionId: string) =>
      send<{ recorded: true }>(`/ballots/${ballotId}/vote`, { method: "POST", body: { optionId } }),
    suggest: (cycleId: string, text: string) =>
      send<{ remaining: number }>(`/cycles/${cycleId}/suggestions`, { method: "POST", body: { text } }),
    chooseWeek: (weekKey: string, communityId: string | null) =>
      send<{ communityId: string | null; locked: boolean }>("/week/active", {
        method: "PUT",
        body: { weekKey, communityId },
      }),
  };
}
