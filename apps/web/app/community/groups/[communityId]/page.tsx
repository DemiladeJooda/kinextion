/**
 * A community's page.
 *
 * The community is the identity unit, so this is the richer profile: who's in
 * it, what it's discussing, and — the part that lasts — where its rooms have
 * landed over time, including the questions it has come back to.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CycleResultView } from "@kinextion/shared";
import { loadCommunity, loadHistory } from "@/lib/community-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ communityId: string }>;
}): Promise<Metadata> {
  const { communityId } = await params;
  const { data } = await loadCommunity(communityId);
  return { title: data ? `${data.community.name} — Kinextion` : "Community — Kinextion" };
}

function ResultBar({ result }: { result: CycleResultView }) {
  const slices = [
    { pct: result.agreePct, tone: "bg-[#00C47A]", label: "agree" },
    { pct: result.mixedPct, tone: "bg-[#3B82F6]", label: "mixed" },
    { pct: result.disagreePct, tone: "bg-[#A855F7]", label: "disagree" },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded bg-slate-200">
        {slices.map((s) => (
          <div key={s.label} className={s.tone} style={{ width: `${s.pct}%` }} title={`${s.pct}% ${s.label}`} />
        ))}
      </div>
      <p className="mt-2 text-sm tabular-nums text-slate-500">
        {result.agreePct}% agree · {result.mixedPct}% mixed · {result.disagreePct}% disagree ·{" "}
        {result.voices} {result.voices === 1 ? "voice" : "voices"}
      </p>
    </div>
  );
}

export default async function CommunityPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const [detail, history] = await Promise.all([loadCommunity(communityId), loadHistory(communityId)]);

  if (!detail.data) {
    if (detail.unreachable) {
      return (
        <main className="min-h-screen bg-slate-50 px-6 py-20 text-center text-slate-600">
          We can&apos;t reach this community right now.
        </main>
      );
    }
    notFound();
  }

  const { community, membership } = detail.data;
  const results = history.data?.results ?? [];
  const recurring = history.data?.recurring ?? [];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          <Link href="/community" className="text-sm text-slate-600 hover:text-slate-900">
            ← Your week
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{community.name}</h1>
        <p className="mt-2 text-slate-600">
          {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
          {membership ? ` · you've been here since ${new Date(membership.joinedAt).toLocaleDateString()}` : ""}
          {community.status === "forming" && community.foundersNeeded
            ? ` · ${community.foundersNeeded} more founders needed`
            : ""}
        </p>
        {community.description ? <p className="mt-4 text-slate-700">{community.description}</p> : null}

        {recurring.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Questions this community came back to
            </h2>
            <div className="mt-4 space-y-6">
              {recurring.map((group) => (
                <div key={group.topicKey} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="font-medium text-slate-900">{group.text}</p>
                  <div className="mt-4 space-y-4">
                    {group.results.map((result) => (
                      <div key={result.weekKey}>
                        <p className="text-xs uppercase tracking-widest text-slate-400">
                          {new Date(result.closedAt).toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <div className="mt-1">
                          <ResultBar result={result} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Where the rooms landed
          </h2>
          {results.length === 0 ? (
            <p className="mt-3 text-slate-600">
              No weeks have closed yet. When one does, what the community thought stays here — the
              recordings don&apos;t.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {results.map((result) => (
                <li key={`${result.weekKey}-${result.topic.topicKey}`} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="font-medium text-slate-900">{result.topic.text}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">{result.weekKey}</p>
                  <div className="mt-3">
                    <ResultBar result={result} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
