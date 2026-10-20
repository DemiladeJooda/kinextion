/**
 * The signed-in web surface.
 *
 * Until now signing in on the website led nowhere: the middleware ran, Clerk
 * created a session, and the only routes that existed were the marketing page
 * and the two auth pages. This is the destination.
 *
 * Scope is deliberate. It's a read of today — score, habits, check-in, the
 * current recommendation — rendered on the server from the same API the phone
 * uses. It doesn't duplicate the app's write paths, and it says so plainly
 * rather than offering controls that half-work. A companion view that is
 * honest about being a view beats a second, worse copy of the product.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { loadDashboard, todayString, type DashboardData } from "@/lib/data-api";

export const metadata: Metadata = {
  title: "Today — Kinextion",
};

/** Personal and changes through the day; never prerender it. */
export const dynamic = "force-dynamic";

const CATEGORY_COLOR: Record<string, string> = {
  physical: "#00C47A",
  mental: "#3B82F6",
  emotional: "#A855F7",
  spiritual: "#0ABAB5",
};

const CATEGORY_LABEL: Record<string, string> = {
  physical: "Body",
  mental: "Mind",
  emotional: "Heart",
  spiritual: "Spirit",
};

export default async function DashboardPage() {
  const data = await loadDashboard();
  const name = data.profile?.profile?.displayName;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5" aria-label="Kinextion home">
            <span
              className="font-extrabold text-lg leading-none"
              style={{
                backgroundImage: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              K
            </span>
            <span className="text-[15px] font-bold tracking-[-0.01em] text-slate-900">
              Kinextion
            </span>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {name ? `Hey, ${name}.` : "Today"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {data.unreachable ? <Unreachable /> : <Body data={data} />}
      </main>
    </div>
  );
}

function Body({ data }: { data: DashboardData }) {
  const today = todayString();
  const habits = data.habits ?? [];
  const doneIds = new Set(
    (data.logs ?? [])
      .filter((l) => l.completed && l.date.slice(0, 10) === today)
      .map((l) => l.habitId)
  );
  const done = habits.filter((h) => doneIds.has(h.id)).length;
  const score = data.score;
  const breakdown = score?.breakdown;

  return (
    <div className="space-y-5">
      {/* ── Score ─────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-6">
          <ScoreDial value={score?.overallScore ?? null} />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">
              Kinextion Score
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              {score === null
                ? "No score yet today."
                : done === 0 && !breakdown?.moodCheckedIn
                  ? "Nothing logged yet today. It starts moving with the first habit."
                  : `${done} of ${habits.length} habits done${
                      breakdown?.streakDays
                        ? `, ${breakdown.streakDays}-day streak running`
                        : ""
                    }.`}
            </p>
          </div>
        </div>

        {breakdown ? (
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Component label="Habits" done={done > 0} detail={`${done}/${habits.length}`} />
            <Component label="Workout" done={breakdown.workoutLogged} />
            <Component label="Check-in" done={breakdown.moodCheckedIn} />
            <Component label="Reflection" done={breakdown.reflectionDone} />
          </div>
        ) : null}
      </Card>

      {/* ── Recommendation ────────────────────────────────────────── */}
      {data.recommendation ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-3">
            Today&apos;s one thing
          </p>
          <p
            className="text-lg font-semibold text-slate-900"
            style={
              data.recommendation.acted
                ? { textDecorationLine: "line-through", opacity: 0.5 }
                : undefined
            }
          >
            {data.recommendation.content}
          </p>
          {data.recommendation.context ? (
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {data.recommendation.context}
            </p>
          ) : null}
          {data.recommendation.acted ? (
            <p className="mt-3 text-xs font-semibold" style={{ color: "#00C47A" }}>
              ✓ Done
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* ── Habits ────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Habits</p>
          {habits.length > 0 ? (
            <p className="text-xs text-slate-400 tabular-nums">
              {done} / {habits.length}
            </p>
          ) : null}
        </div>

        {habits.length === 0 ? (
          <p className="text-sm text-slate-500">
            No habits yet. Build your first one in the app — it can suggest some from what it
            already knows, or work them out with you in conversation.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {habits.map((habit) => {
              const complete = doneIds.has(habit.id);
              const accent = CATEGORY_COLOR[habit.category] ?? "#94A3B8";
              return (
                <li key={habit.id} className="flex items-center gap-3 py-3">
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold text-white"
                    style={{
                      borderColor: complete ? accent : "#CBD5E1",
                      background: complete ? accent : "transparent",
                    }}
                    aria-hidden="true"
                  >
                    {complete ? "✓" : ""}
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      complete ? "text-slate-400 line-through" : "text-slate-800"
                    }`}
                  >
                    {habit.name}
                    {habit.cue ? (
                      <span className="block text-xs text-slate-400 mt-0.5">{habit.cue}</span>
                    ) : null}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: accent, background: `${accent}1A` }}
                  >
                    {CATEGORY_LABEL[habit.category] ?? habit.category}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Check-in ──────────────────────────────────────────────── */}
      <Card>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-3">
          Today&apos;s check-in
        </p>
        {data.checkIn?.entry ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
              <span>
                Mood <strong className="tabular-nums">{data.checkIn.entry.mood}</strong>/10
              </span>
              {data.checkIn.entry.energy !== null ? (
                <span>
                  Energy <strong className="tabular-nums">{data.checkIn.entry.energy}</strong>/10
                </span>
              ) : null}
              {data.checkIn.entry.stress !== null ? (
                <span>
                  Stress <strong className="tabular-nums">{data.checkIn.entry.stress}</strong>/10
                </span>
              ) : null}
            </div>

            {data.checkIn.entry.tags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.checkIn.entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {/* The entries themselves stay on the phone. Rendering a journal
                into a browser tab someone left open on a shared desk is not a
                convenience worth adding. */}
            <p className="text-xs text-slate-400">
              {data.checkIn.reflectionDone
                ? "Journal and gratitude written — they stay in the app."
                : "No reflection written yet today."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not checked in yet today.</p>
        )}
      </Card>

      <p className="pt-2 text-center text-xs text-slate-400">
        This is a read-only view of today. Logging, chatting with your guides and everything else
        happens in the Kinextion app.
      </p>
    </div>
  );
}

function Unreachable() {
  return (
    <Card>
      <p className="text-base font-semibold text-slate-900">Can&apos;t reach your data right now</p>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        You&apos;re signed in, but the Kinextion API didn&apos;t answer. Nothing is lost — try
        again in a moment, or open the app.
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {children}
    </section>
  );
}

function Component({ label, done, detail }: { label: string; done: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: done ? "#00C47A" : "#CBD5E1" }}
        aria-hidden="true"
      />
      <span className="text-xs text-slate-500">
        {label}
        {detail ? <span className="text-slate-400 tabular-nums"> {detail}</span> : null}
      </span>
    </div>
  );
}

/** Score as a ring, drawn with an SVG arc so it needs no client JS. */
function ScoreDial({ value }: { value: number | null }) {
  const size = 92;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={stroke}
        />
        {value !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#00C47A"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-2xl font-extrabold tabular-nums text-slate-900">
          {value ?? "—"}
        </span>
      </div>
    </div>
  );
}
