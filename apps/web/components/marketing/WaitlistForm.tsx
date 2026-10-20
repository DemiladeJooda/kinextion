"use client";

/**
 * Early access capture.
 *
 * The previous version of this form set a local flag on submit and stopped —
 * every address anyone typed into the site was discarded, and the page said
 * "You're in" anyway. This one POSTs to the API, stores the address, and only
 * claims success once the server has confirmed it.
 *
 * The failure path matters as much as the success path here: an email lost
 * silently is worse than an error, because the person believes they're on a
 * list they aren't on.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { track } from "@/lib/analytics";

type Status = "idle" | "sending" | "done" | "error";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

function sessionId(): string | undefined {
  try {
    return sessionStorage.getItem("kx_session") ?? undefined;
  } catch {
    return undefined;
  }
}

export function WaitlistForm({
  source,
  compact = false,
}: {
  /** Which tab this instance sits on — the conversion attribution. */
  source: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    track("waitlist_view", source);
  }, [source]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || status === "sending") return;

    setStatus("sending");
    setMessage("");

    const base = apiBase();
    if (!base) {
      // A missing API URL is a deployment mistake, not the visitor's problem —
      // but they still must not be told they're on a list.
      setStatus("error");
      setMessage("Sign-ups aren't reachable right now. Try again shortly.");
      track("waitlist_error", source, { reason: "no_api_url" });
      return;
    }

    try {
      const res = await fetch(`${base}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source, sessionId: sessionId() }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!res.ok || !payload?.success) {
        setStatus("error");
        setMessage(payload?.error ?? "Couldn't sign you up just now. Try again.");
        track("waitlist_error", source, { status: res.status });
        return;
      }

      setStatus("done");
      track("waitlist_submit", source);
    } catch {
      setStatus("error");
      setMessage("Couldn't reach us — check your connection and try again.");
      track("waitlist_error", source, { reason: "network" });
    }
  }

  return (
    <div className={compact ? "w-full" : "w-full max-w-lg"}>
      <AnimatePresence mode="wait">
        {status === "done" ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-6 py-5 text-center"
            style={{
              background: "rgba(0,196,122,0.10)",
              border: "1.5px solid rgba(0,196,122,0.28)",
            }}
          >
            <p className="text-2xl mb-1">✓</p>
            <p className="font-bold text-base mb-1" style={{ color: "#0F172A" }}>
              You&apos;re on the list.
            </p>
            <p className="text-sm" style={{ color: "#64748B" }}>
              We&apos;ll email {email.trim()} before we open the doors. Nothing else — no
              newsletter, no sharing your address.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={onSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <label className="sr-only" htmlFor={`waitlist-${source}`}>
              Email address
            </label>
            <input
              id={`waitlist-${source}`}
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={status === "sending"}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="your@email.com"
              className="flex-1 px-5 py-3.5 rounded-full text-sm outline-none transition-all duration-200 disabled:opacity-60"
              style={{
                background: "rgba(0,0,0,0.04)",
                border: "1.5px solid rgba(0,0,0,0.10)",
                color: "#0F172A",
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="px-7 py-3.5 rounded-full font-bold text-sm text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] whitespace-nowrap disabled:opacity-60 disabled:hover:scale-100"
              style={{
                background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
                boxShadow: "0 6px 24px rgba(0,196,122,0.30)",
              }}
            >
              {status === "sending" ? "Adding you…" : "Join Early Access"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {status === "error" ? (
        <p className="mt-3 text-sm" role="alert" style={{ color: "#DC2626" }}>
          {message}
        </p>
      ) : status !== "done" ? (
        <p className="mt-3 text-xs" style={{ color: "#94A3B8" }}>
          One email when we launch. We don&apos;t sell or share your address —{" "}
          <a href="/privacy" className="underline hover:opacity-80">
            privacy policy
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
