"use client";

/**
 * Legal links and the disclaimer, on every page. Both app stores require the
 * privacy policy and terms to be reachable from the site itself.
 */

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative z-10 px-6 sm:px-10 pt-10 pb-10">
      <div className="mx-auto max-w-3xl text-center">
        <nav className="flex items-center justify-center gap-5" aria-label="Legal">
          <Link href="/privacy" className="text-xs text-white/60 underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="text-xs text-white/60 underline-offset-4 hover:underline">
            Terms
          </Link>
          <span className="text-xs text-white/40">Kinextion &copy; {new Date().getFullYear()}</span>
        </nav>

        <p className="mt-5 text-xs leading-relaxed text-white/40">
          Kinextion is not a medical device and does not provide medical advice, diagnosis or
          treatment. Its AI guides are not therapists. If you&apos;re in crisis, call or text 988
          (US) or your local emergency number.
        </p>
      </div>
    </footer>
  );
}
