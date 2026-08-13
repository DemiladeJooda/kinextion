"use client";

import { motion } from "framer-motion";
import { useNavigate } from "@/components/navigation/navigation-context";

interface NextPageButtonProps {
  readonly toTab: string;
  readonly label?: string;
  /** Set true when placed over a dark aurora background (home page) */
  readonly dark?: boolean;
}

export function NextPageButton({ toTab, label = "Continue", dark = false }: NextPageButtonProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.5 }}
      className="flex flex-col items-center gap-3 pt-16 pb-8"
    >
      <button
        onClick={() => navigate(toTab)}
        className="group flex flex-col items-center gap-2 px-8 py-4 rounded-2xl transition-all duration-300"
        style={{
          background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,196,122,0.05)",
          border:     dark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,196,122,0.18)",
        }}
      >
        <span
          className="text-sm font-semibold transition-colors"
          style={{ color: dark ? "rgba(255,255,255,0.75)" : "#475569" }}
        >
          {label}
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-0.5"
        >
          <span
            className="block w-px h-5"
            style={{
              background: "linear-gradient(to bottom, transparent, #00C47A, transparent)",
              opacity: 0.7,
            }}
          />
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none" style={{ color: "#00C47A", opacity: 0.85 }}>
            <path
              d="M1 1L8 8L15 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </button>
    </motion.div>
  );
}
