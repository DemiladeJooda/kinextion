"use client";

/**
 * The three things you do before a room opens: choose where you're sitting,
 * tell Kairo what's been on your mind, and vote on the question.
 *
 * Sitting the week out is a first-class option here, not a hidden one — the
 * product promises it costs nothing, so it shouldn't be harder to find than
 * joining in.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BallotView, CycleView } from "@kinextion/shared";
import { CommunityApiError, useCommunityApi } from "@/lib/community-client";

function Message({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="mt-2 text-sm text-slate-600">{text}</p>;
}

export function WeekActions({
  weekKey,
  weekLabel,
  cycles,
  chosenCommunityId,
  locked,
  ballots,
}: {
  weekKey: string;
  /** "This week" / "Next week" — without it, two of these on a page are indistinguishable. */
  weekLabel: string;
  cycles: CycleView[];
  chosenCommunityId: string | null;
  locked: boolean;
  ballots: Record<string, BallotView>;
}) {
  const api = useCommunityApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof CommunityApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const active = cycles.find((c) => c.community.id === chosenCommunityId);
  const activeBallot = active?.ballotId ? ballots[active.ballotId] : undefined;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Where are you sitting — {weekLabel.toLowerCase()}?
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          One community a week ({weekKey}).{" "}
          {locked ? "You've spoken, so this is set." : "You can change your mind until you speak."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cycles.map((cycle) => {
            const isChosen = cycle.community.id === chosenCommunityId;
            return (
              <button
                key={cycle.id}
                type="button"
                disabled={busy || locked}
                onClick={() => run(() => api.chooseWeek(weekKey, cycle.community.id), `Sitting with ${cycle.community.name}.`)}
                className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                  isChosen
                    ? "border-transparent bg-[#00C47A] font-medium text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {cycle.community.name}
              </button>
            );
          })}
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => run(() => api.chooseWeek(weekKey, null), "Sitting this one out — nothing counts against you.")}
            className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
              chosenCommunityId === null
                ? "border-transparent bg-slate-800 font-medium text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            Sit this week out
          </button>
        </div>
        <Message text={message} />
      </section>

      {active?.stage === "gathering" ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            What&apos;s been on your mind?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Private. Kairo turns what the room raises into four questions to vote on — never with your name on it.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              maxLength={280}
              placeholder="Something you'd want to hear people talk about"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || suggestion.trim().length < 5}
              onClick={() =>
                run(async () => {
                  await api.suggest(active.id, suggestion.trim());
                  setSuggestion("");
                }, "Sent to Kairo, privately.")
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </section>
      ) : null}

      {active?.stage === "voting" && activeBallot ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Choose this week&apos;s question
          </h3>
          <ul className="mt-3 space-y-2">
            {activeBallot.options.map((option) => {
              const mine = activeBallot.myVote === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => api.vote(activeBallot.id, option.id), "Vote counted.")}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition disabled:opacity-50 ${
                      mine ? "border-[#00C47A] bg-[#00C47A]/5" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{option.text}</span>
                    {option.rationale ? (
                      <span className="mt-1 block text-sm text-slate-500">{option.rationale}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Nobody sees the running count — only which question opens on Monday.
          </p>
        </section>
      ) : null}
    </div>
  );
}
