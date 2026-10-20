/**
 * Shell for the legal pages.
 *
 * Deliberately outside the tab-driven single-page experience: these need
 * stable, linkable URLs that a store reviewer can paste into a submission
 * form, and they need to render without the animated backdrop, the starfield,
 * or any of the marketing chrome. Plain document, high contrast, readable.
 */

import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 group" aria-label="Kinextion home">
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
            <span className="text-[15px] font-bold tracking-[-0.01em] text-slate-900 group-hover:opacity-80 transition-opacity">
              Kinextion
            </span>
          </Link>

          <nav className="flex items-center gap-5" aria-label="Legal">
            <Link href="/privacy" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">{children}</main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-xs text-slate-400">
            Kinextion &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
