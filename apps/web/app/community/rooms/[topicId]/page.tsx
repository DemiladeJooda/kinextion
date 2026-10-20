/**
 * A week's room: locked, open, or revealed.
 *
 * The locked state is the product, not an error page — so it's rendered with
 * the same care as the room itself, and carries nothing about who has already
 * spoken.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadResult, loadRoom, loadTopic } from "@/lib/community-api";
import { RoomClient } from "@/components/community/RoomClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topicId: string }>;
}): Promise<Metadata> {
  const { topicId } = await params;
  const { data } = await loadTopic(topicId);
  return { title: data ? `${data.text} — Kinextion` : "This week — Kinextion" };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <Link href="/community" className="text-sm text-slate-300 hover:text-white">
            ← Your week
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </main>
  );
}

export default async function RoomPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const topic = await loadTopic(topicId);

  if (!topic.data) {
    if (topic.unreachable) {
      return (
        <Shell>
          <p className="text-slate-300">We can&apos;t reach this room right now.</p>
        </Shell>
      );
    }
    notFound();
  }

  const view = topic.data;

  // Settled: the week is over, and what remains is where the room landed.
  if (view.cycle.stage === "settled") {
    const { data: result } = await loadResult(topicId);
    return (
      <Shell>
        <p className="text-sm text-slate-400">
          {view.community.name} · {view.cycle.weekKey}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{view.text}</h1>
        {result ? (
          <>
            <p className="mt-8 text-lg text-slate-300">{result.headline}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Agree", value: result.agreePct, tone: "bg-[#00C47A]" },
                { label: "Mixed", value: result.mixedPct, tone: "bg-[#3B82F6]" },
                { label: "Disagree", value: result.disagreePct, tone: "bg-[#A855F7]" },
              ].map((slice) => (
                <div key={slice.label} className="rounded-xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-3xl font-semibold tabular-nums">{slice.value}%</p>
                  <p className="mt-1 text-sm text-slate-400">{slice.label}</p>
                  <div className={`mt-3 h-1 rounded ${slice.tone}`} style={{ width: `${slice.value}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-400">
              {result.voices} {result.voices === 1 ? "member" : "members"} spoke · {result.comments} comments.
              The recordings are gone; this is what the community keeps.
            </p>
          </>
        ) : (
          <p className="mt-8 text-slate-400">Nobody spoke this week, so there&apos;s nothing to reveal.</p>
        )}
      </Shell>
    );
  }

  const room = view.you.room === "open" ? await loadRoom(topicId) : null;

  return (
    <Shell>
      <p className="text-sm text-slate-400">
        {view.community.name} · closes{" "}
        {new Date(view.cycle.closesAt).toLocaleString(undefined, {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{view.text}</h1>

      {room?.data ? (
        <div className="mt-8">
          <RoomClient room={room.data} />
        </div>
      ) : (
        <div className="mt-8 max-w-xl rounded-xl border border-white/10 bg-slate-900 p-8">
          <h2 className="text-lg font-medium">Your community wants to hear from you.</h2>
          {view.you.choseElsewhere ? (
            <p className="mt-2 text-slate-400">
              You&apos;re sitting with a different community this week, so this room stays closed.
            </p>
          ) : (
            <p className="mt-2 text-slate-400">
              Share your own answer first, and the room opens. You hear what everyone else thinks
              after you&apos;ve said what you think — not before.
            </p>
          )}
          <p className="mt-4 text-sm text-slate-500">
            Recording happens in the Kinextion app. Two minutes minimum; five to fifteen is the shape
            of a real answer.
          </p>
        </div>
      )}
    </Shell>
  );
}
