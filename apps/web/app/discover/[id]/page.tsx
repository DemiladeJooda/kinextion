/**
 * One public response, and the rest of its conversation.
 *
 * After it finishes, what's offered next is another voice on the same
 * question from the same community — the point is to understand a room, not
 * to be handed something unrelated.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discoverSeed, loadDiscoverResponse } from "@/lib/community-api";
import { ResponsePlayer, formatDuration } from "@/components/community/ResponsePlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data } = await loadDiscoverResponse(id, discoverSeed());
  return { title: data ? `${data.topic.text} — Kinextion` : "Conversation — Kinextion" };
}

export default async function DiscoverResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, unreachable } = await loadDiscoverResponse(id, discoverSeed());

  // A response that expired is simply gone — that's the promise, not an error.
  if (!data && !unreachable) notFound();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-300">
        <p>This conversation is unavailable right now.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-6">
          <Link href="/discover" className="text-sm text-slate-300 hover:text-white">
            ← Discover
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-slate-400">
          {data.community.name} · asked this week
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{data.topic.text}</h1>

        <div className="mt-8">
          <ResponsePlayer
            source={{ url: data.playback.url, kind: data.playback.kind, durationSec: data.playback.durationSec }}
            title={data.topic.text}
            speaker={data.item.speaker.displayName}
          />
        </div>

        <p className="mt-4 text-sm text-slate-300">
          {data.item.speaker.displayName ?? "A member"} · {formatDuration(data.item.durationSec)}
        </p>

        {data.next.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              More voices on this question
            </h2>
            <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
              {data.next.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/discover/${item.id}`}
                    className="flex items-center justify-between gap-4 py-3 hover:text-white"
                  >
                    <span>{item.speaker.displayName ?? "A member"}</span>
                    <span className="text-sm tabular-nums text-slate-400">
                      {formatDuration(item.durationSec)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
