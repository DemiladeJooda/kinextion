/**
 * Discover — the public side of community.
 *
 * Netflix-shaped, but the rows are conversations rather than people: the
 * question first, the community second, the speaker last. Nothing here is
 * ranked by anyone's popularity, and there are no follower counts to show.
 *
 * Open to everyone: no session required, server-rendered.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { discoverSeed, loadDiscover } from "@/lib/community-api";
import { formatDuration } from "@/components/community/ResponsePlayer";

export const metadata: Metadata = {
  title: "Discover — Kinextion",
  description: "Short conversations from real communities, in their own words.",
};

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { data, unreachable } = await loadDiscover(discoverSeed());
  const rows = data?.rows ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight">
            Kinextion
          </Link>
          <Link href="/community" className="text-sm text-slate-300 hover:text-white">
            Your community →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What people are actually thinking about
        </h1>
        <p className="mt-3 max-w-xl text-slate-400">
          Real communities answer one question a week, in their own voices. These are the responses
          people chose to share beyond their own room.
        </p>

        {rows.length === 0 ? (
          <div className="mt-12 rounded-xl border border-white/10 bg-slate-900/60 p-8">
            <p className="font-medium">
              {unreachable ? "Discover is offline right now." : "Nothing public yet this week."}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {unreachable
                ? "The conversations will be back shortly."
                : "Conversations appear here after a community's week closes, and only the responses people chose to make public."}
            </p>
          </div>
        ) : (
          <div className="mt-12 space-y-14">
            {rows.map((row) => (
              <section key={`${row.community.slug}-${row.topic.topicKey}-${row.weekKey}`}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">{row.topic.text}</h2>
                  <span className="text-sm text-slate-400">
                    {row.community.name} · {row.responses.length} {row.responses.length === 1 ? "voice" : "voices"}
                  </span>
                </div>

                <div className="mt-5 flex snap-x gap-4 overflow-x-auto pb-3">
                  {row.responses.map((item) => (
                    <Link
                      key={item.id}
                      href={`/discover/${item.id}`}
                      className="group w-64 flex-none snap-start rounded-xl border border-white/10 bg-slate-900 p-4 transition hover:border-white/25 hover:bg-slate-800"
                    >
                      <div
                        className={`flex h-28 items-end rounded-lg p-3 ${
                          item.kind === "audio"
                            ? "bg-gradient-to-br from-[#7B2FBE] to-[#0ABAB5]"
                            : "bg-gradient-to-br from-[#0F172A] to-[#3B82F6]"
                        }`}
                      >
                        <span className="rounded bg-black/40 px-1.5 py-0.5 text-xs tabular-nums text-white">
                          {formatDuration(item.durationSec)}
                        </span>
                      </div>
                      <p className="mt-3 font-medium group-hover:underline">
                        {item.speaker.displayName ?? "A member"}
                      </p>
                      <p className="text-xs text-slate-400">{row.community.name}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
