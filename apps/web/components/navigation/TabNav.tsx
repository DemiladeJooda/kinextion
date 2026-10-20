"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { track } from "@/lib/analytics";

export interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onEarlyAccess: () => void;
}

const BRAND_GRADIENT = "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)";

export function TabNav({ tabs, activeTab, onTabChange, onEarlyAccess }: TabNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { isSignedIn, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep the active pill in view on desktop, where the strip can still
  // overflow at narrower widths.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    if (!btn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const target =
      nav.scrollLeft + btnRect.left - navRect.left - navRect.width / 2 + btnRect.width / 2;
    nav.scrollTo({ left: target, behavior: "smooth" });
  }, [activeTab]);

  // While the sheet is open it owns the screen: Escape closes it, and the
  // page behind must not scroll away underneath it.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Send focus back to the control that opened it, so keyboard users
      // aren't dropped at the top of the document.
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  const selectTab = (id: string) => {
    onTabChange(id);
    setMenuOpen(false);
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: "var(--nav-height, 56px)" }}
      >
        {/* Light glass backdrop */}
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80" />

        <div className="relative flex items-center h-full px-4 sm:px-6 gap-2">
          {/* Logo. The wordmark appears alongside the mark once there's room
              for it — on the narrowest screens the mark alone has to carry it. */}
          <button
            onClick={() => selectTab("home")}
            className="shrink-0 flex items-center gap-1.5 -ml-1 px-2 h-11 rounded-lg hover:bg-slate-100/70 transition-colors"
            aria-label="Kinextion home"
          >
            <span
              className="font-extrabold text-lg leading-none"
              style={{
                backgroundImage: BRAND_GRADIENT,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              K
            </span>
            <span className="hidden sm:inline text-[15px] font-bold tracking-[-0.01em] text-slate-900">
              Kinextion
            </span>
          </button>

          {/* Desktop tab strip. Hidden below lg, where it could only ever show
              a fraction of the sections — the menu button replaces it. */}
          <div
            ref={navRef}
            className="hidden lg:flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 mx-2"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative shrink-0 px-3.5 h-9 flex items-center text-sm font-medium rounded-full transition-colors duration-150 ${
                    isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-slate-100 border border-slate-200"
                      transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Push the right-hand controls to the edge when the tab strip is
              hidden and there's no flex-1 element to do it. */}
          <div className="flex-1 lg:hidden" />

          <div className="shrink-0 flex items-center gap-2">
            {isLoaded &&
              (isSignedIn ? (
                <>
                  {/* Signing in used to lead nowhere. It leads here. */}
                  <Link
                    href="/dashboard"
                    className="hidden sm:flex items-center px-3.5 h-9 text-[13px] font-semibold rounded-full text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300 bg-white transition-all duration-200 whitespace-nowrap"
                  >
                    Today
                  </Link>
                  <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
                </>
              ) : (
                <SignInButton mode="modal">
                  <button
                    onClick={() => track("signin_click", activeTab)}
                    className="hidden sm:flex items-center px-3.5 h-9 text-[13px] font-semibold rounded-full text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300 bg-white transition-all duration-200 whitespace-nowrap"
                  >
                    Sign In
                  </button>
                </SignInButton>
              ))}

            <button
              onClick={() => {
                track("cta_click", activeTab, { target: "early_access" });
                onEarlyAccess();
              }}
              className="flex items-center px-4 h-9 text-[13px] font-bold rounded-full text-white whitespace-nowrap transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
              style={{
                background: BRAND_GRADIENT,
                boxShadow: "0 2px 12px rgba(0,196,122,0.25)",
              }}
            >
              Early Access
            </button>

            {/* Menu trigger — the only way to reach most sections below lg. */}
            <button
              ref={menuButtonRef}
              onClick={() => setMenuOpen((open) => !open)}
              className="lg:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              {/* Rotated/translated straight lines rather than animating `d`:
                  path morphing between different command sequences can't be
                  interpolated, which throws on every frame. */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <motion.line
                  x1="3" y1="6" x2="17" y2="6"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                  style={{ originX: "50%", originY: "50%" }}
                  animate={menuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.line
                  x1="3" y1="10" x2="17" y2="10"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                  animate={{ opacity: menuOpen ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                />
                <motion.line
                  x1="3" y1="14" x2="17" y2="14"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                  style={{ originX: "50%", originY: "50%" }}
                  animate={menuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Plain conditional rendering, deliberately — no exit animation.
          An AnimatePresence exit here failed to resolve and left the backdrop
          mounted on top of the page, silently swallowing every click. A
          missing 200ms fade-out is imperceptible; a dead page is not. */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {menuOpen && (
            <motion.div
              id="mobile-nav"
              className="lg:hidden fixed left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-xl overflow-hidden"
              style={{ top: "var(--nav-height, 56px)" }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="px-4 py-3 flex flex-col">
                {tabs.map((tab, i) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => selectTab(tab.id)}
                      aria-current={isActive ? "page" : undefined}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 + i * 0.025, duration: 0.2 }}
                      className={`flex items-center justify-between min-h-[48px] px-3 rounded-xl text-[15px] font-medium text-left transition-colors ${
                        isActive
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: BRAND_GRADIENT }}
                          aria-hidden="true"
                        />
                      )}
                    </motion.button>
                  );
                })}

                {/* Sign-in lives here on the narrowest screens, where it's
                    hidden from the bar to keep the CTA from being crowded. */}
                {isLoaded && (
                  <div className="sm:hidden mt-2 pt-3 border-t border-slate-100">
                    {isSignedIn ? (
                      <Link
                        href="/dashboard"
                        className="flex items-center w-full min-h-[48px] px-3 rounded-xl text-[15px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Today
                      </Link>
                    ) : (
                      <SignInButton mode="modal">
                        <button
                          onClick={() => track("signin_click", activeTab)}
                          className="w-full min-h-[48px] px-3 rounded-xl text-[15px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        >
                          Sign In
                        </button>
                      </SignInButton>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
      )}
    </>
  );
}
