"use client";

/**
 * Site footer — early access, and the legal links.
 *
 * Rendered on every tab rather than tucked into one section, for two reasons.
 * The waitlist form now records which tab it was submitted from, so having it
 * everywhere is what turns "which tab converts" into a question with an
 * answer. And both stores require the privacy policy and terms to be reachable
 * from the site itself, which means every page, not one people have to find.
 *
 * Adapts to whichever backdrop the active tab uses — the site cross-fades
 * between a dark space backdrop and a light one, and a footer that ignored
 * that would be unreadable on half the tabs.
 */

import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";

export function SiteFooter({ tab, dark }: { tab: string; dark: boolean }) {
  const heading = dark ? "rgba(255,255,255,0.92)" : "#0F172A";
  const body = dark ? "rgba(255,255,255,0.55)" : "#64748B";
  const faint = dark ? "rgba(255,255,255,0.32)" : "#94A3B8";
  const rule = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";

  return (
    <footer className="relative z-10 px-6 sm:px-10 pt-16 pb-10" style={{ borderTop: `1px solid ${rule}` }}>
      <div className="mx-auto max-w-3xl">
        {/* ── Early access ─────────────────────────────────────────── */}
        <div id="early-access" className="scroll-mt-24 text-center">
          <h2
            className="font-extrabold tracking-tight mb-2"
            style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", color: heading }}
          >
            Be there when it opens
          </h2>
          <p className="text-sm mb-7 mx-auto max-w-md" style={{ color: body }}>
            Kinextion is in build. Leave an address and you&apos;ll hear from us once — when
            there&apos;s something real to use.
          </p>

          <div className="flex justify-center">
            <WaitlistForm source={tab} />
          </div>
        </div>

        {/* ── Legal & meta ─────────────────────────────────────────── */}
        <div
          className="mt-14 pt-7 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid ${rule}` }}
        >
          <p className="text-xs order-2 sm:order-1" style={{ color: faint }}>
            Kinextion &copy; {new Date().getFullYear()}
          </p>

          <nav className="flex items-center gap-5 order-1 sm:order-2" aria-label="Legal">
            <Link
              href="/privacy"
              className="text-xs underline-offset-4 hover:underline transition-opacity hover:opacity-80"
              style={{ color: body }}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs underline-offset-4 hover:underline transition-opacity hover:opacity-80"
              style={{ color: body }}
            >
              Terms
            </Link>
          </nav>
        </div>

        {/* The disclaimer belongs on the marketing site as much as in the app:
            this is where the claims are made. */}
        <p className="mt-6 text-center text-xs leading-relaxed" style={{ color: faint }}>
          Kinextion is not a medical device and does not provide medical advice, diagnosis or
          treatment. Its AI guides are not therapists. If you&apos;re in crisis, call or text 988
          (US) or your local emergency number.
        </p>
      </div>
    </footer>
  );
}
