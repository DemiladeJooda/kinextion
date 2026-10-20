/**
 * Your week.
 *
 * Which community you're sitting with, what stage it's at, and the one thing
 * to do next. Navigation is light and calm; the room itself is dark and
 * focused — the same signal the phone sends by asking you to turn it
 * sideways.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import type { BallotView, CycleView, WeekView } from "@kinextion/shared";
import { loadBallot, loadMyWeek } from "@/lib/community-api";
import { WeekActions } from "@/components/community/WeekActions";

export const metadata: Metadata = { title: "Your week — Kinextion" };
export const dynamic = "force-dynamic";

const STAGE_COPY: Record<CycleView["stage"], string> = {
  scheduled: "Opens soon",
  gathering: "Collecting what's on people's minds",
  voting: "Choosing the question",
  open: "The room is open",
  closed: "Closed — results coming",
  settled: "Where the room landed",
};

function localTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CycleCard({ cycle }: { cycle: CycleView }) {
  const spoken = cycle.you.response === "submitted";
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-900">{cycle.community.name}</p>
          <p className="text-sm text-slate-500">{STAGE_COPY[cycle.stage]}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs tabular-nums text-slate-600">
          {cycle.weekKey}
        </span>
      </div>

      {cycle.topic ? (
        <p className="mt-4 text-lg font-medium leading-snug text-slate-900">{cycle.topic.text}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {cycle.topic ? (
          <Link
            href={`/community/rooms/${cycle.topic.id}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {spoken ? "Open the room" : "See the question"}
          </Link>
        ) : null}
        <Link
          href={`/community/groups/${cycle.community.id}`}
          className="text-sm text-slate-600 underline-offset-4 hover:underline"
        >
          About {cycle.community.name}
        </Link>
      </div>

      {cycle.stage === "open" ? (
        <p className="mt-3 text-sm text-slate-500">
          {spoken
            ? `You've spoken. The room closes ${localTime(cycle.closesAt)}.`
            : `Share your own response to open the room. It closes ${localTime(cycle.closesAt)}.`}
        </p>
      ) : null}
    </li>
  );
}

async function ballotsFor(week: WeekView): Promise<Record<string, BallotView>> {
  const ids = week.cycles.map((c) => c.ballotId).filter((id): id is string => !!id);
  const loaded = await Promise.all(ids.map((id) => loadBallot(id)));
  return Object.fromEntries(
    loaded.flatMap((result) => (result.data ? [[result.data.id, result.data] as const] : []))
  );
}

export default async function CommunityWeekPage() {
  const { data, unreachable } = await loadMyWeek();

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Your week</h1>
          <p className="mt-3 text-slate-600">
            {unreachable ? "We can't reach your communities right now." : "Nothing to show yet."}
          </p>
        </div>
      </main>
    );
  }

  const [currentBallots, nextBallots] = await Promise.all([ballotsFor(data.current), ballotsFor(data.next)]);
  const hasAny = data.current.cycles.length > 0 || data.next.cycles.length > 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="font-semibold tracking-tight text-slate-900">
            Kinextion
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/discover" className="text-sm text-slate-600 hover:text-slate-900">
              Discover
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your week</h1>
        <p className="mt-2 text-slate-600">
          One community a week, one question, one response. Recording happens in the app.
        </p>

        {!hasAny ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-8">
            <p className="font-medium text-slate-900">You&apos;re not in a community yet.</p>
            <p className="mt-2 text-sm text-slate-600">
              Communities start with people who already know each other — six of them have to agree
              it&apos;s real before it exists. You can start one, or ask to join one, in the app.
            </p>
            <Link href="/discover" className="mt-4 inline-block text-sm text-slate-900 underline underline-offset-4">
              Listen to some public conversations first
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {/* Only when there's actually a choice to make. A community founded
                mid-week has no room until next week, and an empty chooser with
                nothing but "sit this out" reads as something being broken. */}
            {data.current.cycles.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <WeekActions
                  weekKey={data.current.weekKey}
                  weekLabel="This week"
                  cycles={data.current.cycles}
                  chosenCommunityId={data.current.choice?.communityId ?? null}
                  locked={data.current.choice?.locked ?? false}
                  ballots={currentBallots}
                />
              </section>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">
                  No room this week — your community joined after this week&apos;s question was
                  chosen. Next week&apos;s is below.
                </p>
              </section>
            )}

            {data.current.cycles.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">This week</h2>
                <ul className="mt-3 space-y-3">
                  {data.current.cycles.map((cycle) => (
                    <CycleCard key={cycle.id} cycle={cycle} />
                  ))}
                </ul>
              </section>
            ) : null}

            {data.next.cycles.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Next week</h2>
                <ul className="mt-3 space-y-3">
                  {data.next.cycles.map((cycle) => (
                    <CycleCard key={cycle.id} cycle={cycle} />
                  ))}
                </ul>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                  <WeekActions
                    weekKey={data.next.weekKey}
                    weekLabel="Next week"
                    cycles={data.next.cycles}
                    chosenCommunityId={data.next.choice?.communityId ?? null}
                    locked={data.next.choice?.locked ?? false}
                    ballots={nextBallots}
                  />
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
