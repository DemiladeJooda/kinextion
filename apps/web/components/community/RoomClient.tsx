"use client";

/**
 * The room, once you've spoken.
 *
 * Listening is the centre: one response at a time, with a reaction and the
 * comments underneath it. Reactions are private and the totals don't exist
 * yet, so there is nothing to display and nothing to infer — that's a product
 * rule, not a missing feature, and the copy says so plainly.
 */

import { useCallback, useEffect, useState } from "react";
import type { CommentView, ReactionVerdict, RoomResponseItem, RoomView } from "@kinextion/shared";
import { CommunityApiError, useCommunityApi } from "@/lib/community-client";
import { ResponsePlayer, formatDuration, type PlayerSource } from "./ResponsePlayer";

const VERDICTS: { value: ReactionVerdict; label: string }[] = [
  { value: "agree", label: "Agree" },
  { value: "mixed", label: "Mixed" },
  { value: "disagree", label: "Disagree" },
];

export function RoomClient({ room }: { room: RoomView }) {
  const api = useCommunityApi();
  const [selected, setSelected] = useState<RoomResponseItem | null>(room.responses[0] ?? null);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [reactions, setReactions] = useState<Record<string, ReactionVerdict | null>>(
    Object.fromEntries(room.responses.map((r) => [r.id, r.myReaction]))
  );
  const [comments, setComments] = useState<CommentView[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(
    async (item: RoomResponseItem) => {
      setSelected(item);
      setSource(null);
      setComments([]);
      setReplyTo(null);
      setError(null);
      setLoading(true);
      try {
        const [playback, thread] = await Promise.all([api.playback(item.id), api.comments(item.id)]);
        setSource({ url: playback.url, kind: playback.kind, durationSec: playback.durationSec });
        setComments(thread);
      } catch (err) {
        setError(err instanceof CommunityApiError ? err.message : "Couldn't load that response.");
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    if (room.responses[0]) void open(room.responses[0]);
    // Only on first render: re-running would interrupt whatever is playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closed = room.cycle.stage !== "open";

  async function react(verdict: ReactionVerdict) {
    if (!selected) return;
    const previous = reactions[selected.id] ?? null;
    setReactions((r) => ({ ...r, [selected.id]: verdict }));
    try {
      await api.react(selected.id, verdict);
    } catch (err) {
      setReactions((r) => ({ ...r, [selected.id]: previous }));
      setError(err instanceof CommunityApiError ? err.message : "Couldn't save that.");
    }
  }

  async function submitComment() {
    if (!selected || draft.trim().length === 0) return;
    try {
      const created = await api.comment(selected.id, {
        body: draft.trim(),
        parentId: replyTo?.id,
      });
      setComments((c) => [...c, created]);
      setDraft("");
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof CommunityApiError ? err.message : "Couldn't post that.");
    }
  }

  async function toggleLike(comment: CommentView) {
    const liked = !comment.likedByMe;
    setComments((list) =>
      list.map((c) => (c.id === comment.id ? { ...c, likedByMe: liked, likeCount: c.likeCount + (liked ? 1 : -1) } : c))
    );
    try {
      await api.like(comment.id, liked);
    } catch {
      setComments((list) =>
        list.map((c) =>
          c.id === comment.id ? { ...c, likedByMe: !liked, likeCount: c.likeCount + (liked ? -1 : 1) } : c
        )
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        {selected ? (
          <>
            {loading && !source ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900 text-sm text-slate-400">
                Loading…
              </div>
            ) : (
              <ResponsePlayer
                source={source}
                title={room.topic.text}
                speaker={selected.speaker.displayName}
              />
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-slate-200">
                {selected.speaker.displayName ?? "A member"}
                <span className="ml-2 text-sm tabular-nums text-slate-400">
                  {formatDuration(selected.durationSec)}
                </span>
              </p>
              <div className="flex gap-2">
                {VERDICTS.map((v) => {
                  const mine = reactions[selected.id] === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      disabled={closed}
                      onClick={() => react(v.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                        mine
                          ? "border-transparent bg-[#00C47A] font-medium text-slate-950"
                          : "border-white/20 text-slate-200 hover:border-white/40"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Your reaction stays private. Nobody sees the totals until the week closes — including you.
            </p>

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Comments</h2>
              <ul className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className={comment.parentId ? "ml-6 border-l border-white/10 pl-4" : undefined}
                  >
                    <p className="text-sm text-slate-300">
                      <span className="font-medium text-slate-100">
                        {comment.author.displayName ?? (comment.deleted ? "Deleted" : "A member")}
                      </span>{" "}
                      {comment.body ?? <em className="text-slate-500">comment deleted</em>}
                    </p>
                    {!comment.deleted ? (
                      <div className="mt-1 flex gap-3 text-xs text-slate-500">
                        <button type="button" onClick={() => toggleLike(comment)} className="hover:text-slate-300">
                          {comment.likedByMe ? "Liked" : "Like"}
                          {comment.likeCount > 0 ? ` · ${comment.likeCount}` : ""}
                        </button>
                        {!comment.parentId && !closed ? (
                          <button type="button" onClick={() => setReplyTo(comment)} className="hover:text-slate-300">
                            Reply
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
                {comments.length === 0 ? (
                  <li className="text-sm text-slate-500">No comments yet.</li>
                ) : null}
              </ul>

              {!closed ? (
                <div className="mt-4">
                  {replyTo ? (
                    <p className="mb-1 text-xs text-slate-400">
                      Replying to {replyTo.author.displayName ?? "a member"} ·{" "}
                      <button type="button" onClick={() => setReplyTo(null)} className="underline">
                        cancel
                      </button>
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={1000}
                      placeholder="Say something to them"
                      className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={submitComment}
                      disabled={draft.trim().length === 0}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
                    >
                      Post
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">This conversation has closed.</p>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-900 p-8 text-slate-300">
            <p className="font-medium text-slate-100">You&apos;re the first voice in this room.</p>
            <p className="mt-2 text-sm text-slate-400">
              When others in your circle share theirs, they&apos;ll appear here.
            </p>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      </div>

      <aside>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          {room.circle.voices} {room.circle.voices === 1 ? "voice" : "voices"} from {room.community.name}
        </h2>
        <ul className="mt-3 space-y-1">
          {room.responses.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  selected?.id === item.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span>{item.speaker.displayName ?? "A member"}</span>
                <span className="tabular-nums text-xs text-slate-500">
                  {formatDuration(item.durationSec)}
                  {item.commentCount > 0 ? ` · ${item.commentCount}💬` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Everyone hears this room in a different order. Nobody is first.
        </p>
      </aside>
    </div>
  );
}
