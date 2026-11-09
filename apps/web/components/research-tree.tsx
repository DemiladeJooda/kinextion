"use client";

import { useState } from "react";
import { motion } from "motion/react";

/** Signals feed the guides, the guides feed the features, the features feed your life. */
export function GrowthTree() {
  const [treeSeen, setTreeSeen] = useState(false);

  return (
        <motion.div
          className="relative mx-auto"
          style={{ maxWidth: 700, height: 590 }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          onViewportEnter={() => setTreeSeen(true)}
          transition={{ duration: 0.5 }}
        >
          <svg viewBox="0 0 700 590" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">

            {/* ── Ambient background glow ── */}
            <defs>
              <radialGradient id="treeGlow" cx="50%" cy="55%" r="48%">
                <stop offset="0%" stopColor="rgba(0,196,122,0.07)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <radialGradient id="rootGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(10,186,181,0.05)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <ellipse cx="350" cy="295" rx="295" ry="220" fill="url(#treeGlow)" />
            <ellipse cx="350" cy="490" rx="250" ry="75" fill="url(#rootGlow)" />

            {/* ── ROOTS (data signals Kinextion reads) ── */}
            {treeSeen && (
              <>
                <motion.line x1="350" y1="450" x2="350" y2="476"
                  stroke="#0ABAB5" strokeWidth="3" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }} />
                <motion.path d="M350,464 Q282,476 218,486"
                  stroke="#0ABAB5" strokeWidth="2.5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.22, duration: 0.55 }} />
                <motion.path d="M350,464 Q418,476 482,486"
                  stroke="#0ABAB5" strokeWidth="2.5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.22, duration: 0.55 }} />
                <motion.path d="M218,486 Q168,496 130,505"
                  stroke="#0ABAB5" strokeWidth="2" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }} />
                <motion.path d="M482,486 Q532,496 570,505"
                  stroke="#0ABAB5" strokeWidth="2" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }} />

                {/* ── TRUNK — AI synthesis ── */}
                <motion.line x1="350" y1="450" x2="350" y2="252"
                  stroke="#A855F7" strokeWidth="8" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.65, duration: 0.9, ease: "easeOut" }} />

                {/* ── MAIN BRANCHES — features ── */}
                <motion.path d="M350,290 Q290,260 218,232"
                  stroke="#3B82F6" strokeWidth="5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.22, duration: 0.58 }} />
                <motion.path d="M350,290 Q410,260 482,232"
                  stroke="#3B82F6" strokeWidth="5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.22, duration: 0.58 }} />
                <motion.path d="M350,340 Q280,315 192,300"
                  stroke="#3B82F6" strokeWidth="4" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.38, duration: 0.58 }} />
                <motion.path d="M350,340 Q420,315 508,300"
                  stroke="#3B82F6" strokeWidth="4" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.38, duration: 0.58 }} />
                <motion.line x1="350" y1="252" x2="350" y2="178"
                  stroke="#00C47A" strokeWidth="4" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.56, duration: 0.5 }} />

                {/* ── SUB-BRANCHES — outcomes ── */}
                <motion.path d="M350,186 Q315,163 270,138"
                  stroke="#00C47A" strokeWidth="3" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.86, duration: 0.48 }} />
                <motion.path d="M350,186 Q385,163 430,138"
                  stroke="#00C47A" strokeWidth="3" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.86, duration: 0.48 }} />
                <motion.line x1="350" y1="178" x2="350" y2="108"
                  stroke="#00C47A" strokeWidth="3" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.96, duration: 0.42 }} />
                <motion.path d="M218,232 Q168,213 130,196"
                  stroke="#00C47A" strokeWidth="2.5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.96, duration: 0.45 }} />
                <motion.path d="M482,232 Q532,213 570,196"
                  stroke="#00C47A" strokeWidth="2.5" fill="none" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 1.96, duration: 0.45 }} />
              </>
            )}

            {/* ── ROOT ZONE LABELS ── */}
            {treeSeen && (
              <>
                <motion.foreignObject x="224" y="433" width="252" height="28"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.5 }}>
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: "rgba(10,186,181,0.10)", border: "1px solid rgba(10,186,181,0.28)", color: "#0ABAB5" }}>
                      What Kinextion reads
                    </div>
                  </div>
                </motion.foreignObject>

                {/* 5 signal chips — spread across the root zone */}
                {[
                  { x: 20,  y: 505, label: "Sleep & HRV"    },
                  { x: 143, y: 494, label: "Life Context"    },
                  { x: 292, y: 484, label: "Emotional State" },
                  { x: 436, y: 494, label: "Habit Patterns"  },
                  { x: 558, y: 505, label: "Community"    },
                ].map((chip, i) => (
                  <motion.foreignObject key={chip.label} x={chip.x} y={chip.y} width="112" height="26"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.44 + i * 0.09, duration: 0.42 }}>
                    <div className="flex justify-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: "rgba(10,186,181,0.08)", border: "1px solid rgba(10,186,181,0.24)", color: "#0ABAB5" }}>
                        {chip.label}
                      </span>
                    </div>
                  </motion.foreignObject>
                ))}
              </>
            )}

            {/* ── TRUNK LABEL — AI Synthesis ── */}
            {treeSeen && (
              <motion.foreignObject x="356" y="336" width="192" height="68"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.28)", color: "#A855F7" }}>
                    AI Synthesis
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2 pl-1">
                  {["Althea", "Kairo"].map((g) => (
                    <span key={g}
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)", color: "#A855F7" }}>
                      {g}
                    </span>
                  ))}
                </div>
              </motion.foreignObject>
            )}

            {/* ── BRANCH LABELS — Features ── */}
            {treeSeen && (
              <>
                <motion.foreignObject x="12" y="248" width="175" height="60"
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}>
                  <div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold mb-1.5"
                      style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)", color: "#3B82F6" }}>
                      Coaching
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["Daily Nudges", "Your Habits"].map((label) => (
                        <span key={label}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", color: "#3B82F6" }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.foreignObject>

                <motion.foreignObject x="513" y="248" width="180" height="60"
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}>
                  <div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold mb-1.5"
                      style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.25)", color: "#3B82F6" }}>
                      Experience
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["Simulator", "Your Numbers"].map((label) => (
                        <span key={label}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)", color: "#3B82F6" }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.foreignObject>

                <motion.foreignObject x="98" y="338" width="136" height="28"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 1.58, duration: 0.45 }}>
                  <div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1"
                      style={{ background: "rgba(10,186,181,0.09)", border: "1px solid rgba(10,186,181,0.24)", color: "#0ABAB5" }}>
                      Weekly Rooms
                    </span>
                  </div>
                </motion.foreignObject>
              </>
            )}

            {/* ── CROWN / FRUITS — what you receive ── */}
            {treeSeen && (
              <>
                <motion.foreignObject x="264" y="28" width="172" height="28"
                  initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.15, duration: 0.5 }}>
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(0,196,122,0.12)", border: "1px solid rgba(0,196,122,0.30)", color: "#00C47A" }}>
                      What You Receive
                    </div>
                  </div>
                </motion.foreignObject>

                {[
                  { x: 72,  y: 167, label: "Better Sleep",    w: 104 },
                  { x: 192, y: 110, label: "Consistency",     w: 100 },
                  { x: 304, y: 80,  label: "Longevity",       w: 92  },
                  { x: 412, y: 110, label: "Real Connection", w: 114 },
                  { x: 536, y: 167, label: "Self-Insight",    w: 100 },
                ].map((fruit, i) => (
                  <motion.foreignObject key={fruit.label} x={fruit.x} y={fruit.y} width={fruit.w} height="28"
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 2.24 + i * 0.1, type: "spring", stiffness: 300, damping: 18 }}>
                    <div className="flex justify-center">
                      <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(0,196,122,0.12)", border: "1.5px solid rgba(0,196,122,0.32)", color: "#00C47A", boxShadow: "0 0 10px rgba(0,196,122,0.12)" }}>
                        {fruit.label}
                      </span>
                    </div>
                  </motion.foreignObject>
                ))}
              </>
            )}
          </svg>
        </motion.div>
  );
}
