"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

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

export function TabNav({ tabs, activeTab, onTabChange, onEarlyAccess }: TabNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const { isSignedIn, isLoaded } = useUser();

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

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ height: "var(--nav-height, 56px)" }}
    >
      {/* Light glass backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/80" />

      <div className="relative flex items-center h-full px-3 sm:px-6 gap-1">
        {/* Logo mark */}
        <button
          onClick={() => onTabChange("home")}
          className="shrink-0 mr-2 flex items-center gap-1.5 group"
          aria-label="Home"
        >
          <span
            className="font-extrabold text-base leading-none group-hover:opacity-70 transition-opacity"
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
        </button>

        {/* Scrollable tab list */}
        <div
          ref={navRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative shrink-0 px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors duration-150 ${
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
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

        {/* Right side: auth + CTA */}
        <div className="shrink-0 ml-2 flex items-center gap-2">
          {isLoaded && (
            isSignedIn ? (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-7 h-7",
                  },
                }}
              />
            ) : (
              <SignInButton mode="modal">
                <button className="px-3 py-1.5 text-xs font-semibold rounded-full text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300 bg-white transition-all duration-200 whitespace-nowrap">
                  Sign In
                </button>
              </SignInButton>
            )
          )}

          <button
            onClick={onEarlyAccess}
            className="px-4 py-1.5 text-xs font-bold rounded-full text-white whitespace-nowrap transition-all duration-200 hover:opacity-90 hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)",
              boxShadow: "0 2px 12px rgba(0,196,122,0.25)",
            }}
          >
            Early Access
          </button>
        </div>
      </div>
    </nav>
  );
}
