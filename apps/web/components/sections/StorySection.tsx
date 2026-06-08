"use client";

import { motion } from "framer-motion";

// Team data: co-founders with brand accent colors, bio copy, and pull-quote.
// Accent colors (member.color) are intentionally kept as-is — they pop on the dark background.
const team = [
  {
    name:     "Demi",
    role:     "Co-Founder & CTO",
    initials: "D",
    color:    "#00C47A",
    bio:      "The architect behind Kinextion's technical foundation. Demi's work spans AI systems, behavioral data modeling, and full-stack engineering — building the intelligence layer that makes Althea and Kairo genuinely adaptive.",
    quote:    "The hard problem isn't building the app — it's building the intelligence. That's what we get right.",
  },
  {
    name:     "Cecil",
    role:     "Co-Founder & CEO",
    initials: "C",
    color:    "#A855F7",
    bio:      "Fitness-obsessed builder who spent years watching motivated, talented people fail at consistency — not from lack of effort, but from lack of system. Cecil brings lived experience, product vision, and relentless user empathy to every Kinextion decision.",
    quote:    "I built this because I needed it — and I refused to believe the system couldn't be better.",
  },
];

// StorySection renders the "Our Story" tab content:
// a hero title, a video placeholder, a team grid, and a footer note.
// All colors are dark-theme-safe — white/near-white text on a transparent-glass surface
// that sits above the global deep-space starfield background.
export function StorySection() {
  return (
    <section className="tab-section">
      <div className="section-container relative z-10">

        {/* ── Title block — white heading on dark backdrop ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <p className="section-label" style={{ color: "#A855F7" }}>Our Story</p>
          {/* Dark-theme heading: #FFFFFF instead of the original near-black #0F172A */}
          <h2
            className="font-bold mb-4 text-balance"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#FFFFFF" }}
          >
            From our journey to yours.
          </h2>
        </motion.div>

        {/* ── Video placeholder — dark translucent panel with aurora-tinted gradient ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="max-w-2xl mx-auto mb-24"
        >
          <div
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            style={{
              aspectRatio: "16 / 9",
              // Dark panel: replaces the old light rgba(248,250,252,1) endpoint with a near-transparent white
              background:  "linear-gradient(135deg, rgba(0,196,122,0.12) 0%, rgba(10,186,181,0.08) 40%, rgba(255,255,255,0.03) 80%)",
              // White-based border so it reads against the dark starfield
              border:      "1px solid rgba(255,255,255,0.12)",
              boxShadow:   "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Play button — accent green ring, unchanged from original */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-200"
                style={{
                  background: "rgba(0,196,122,0.12)",
                  border:     "2px solid rgba(0,196,122,0.28)",
                  boxShadow:  "0 4px 20px rgba(0,196,122,0.16)",
                }}
              >
                <span className="text-2xl ml-1" style={{ color: "#00C47A" }}>▶</span>
              </motion.div>
              {/* Video title and meta — white text on dark panel */}
              <p className="font-semibold text-base" style={{ color: "#FFFFFF" }}>Why We Started Kinextion</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Demi & Cecil · 4 minutes</p>
            </div>

            {/* Progress bar — white-tinted track so it's visible on dark */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
                <div className="w-0 h-full rounded-full" style={{ background: "#00C47A" }} />
              </div>
              {/* Timestamp — muted white */}
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>0:00 / 4:12</span>
            </div>
          </div>

          {/* Caption beneath video — muted white */}
          <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.42)" }}>
            Full video coming soon — follow our journey
          </p>
        </motion.div>

        {/* ── Team grid — dark glass cards, white text, accent color highlights ── */}
        {/* Divider uses white-based rgba so it's visible against the dark background */}
        <div className="border-t pt-16 mb-20" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
            className="text-center mb-12"
          >
            <p className="section-label" style={{ color: "#0ABAB5" }}>The Team</p>
            {/* Section heading — white on dark */}
            <h2
              className="font-bold mb-4 text-balance"
              style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", color: "#FFFFFF" }}
            >
              The people behind Kinextion.
            </h2>
            {/* Subheading — 70% white for comfortable reading contrast */}
            <p className="text-lg max-w-2xl mx-auto text-balance" style={{ color: "rgba(255,255,255,0.70)" }}>
              Two founders. One shared obsession. Endless conviction that consistency
              doesn&apos;t have to be this hard.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {team.map((member, i) => (
              // Each card uses glass-card-dark-vivid — frosted dark glass with slight brightness
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.15, duration: 0.55 }}
                whileHover={{ y: -3 }}
                className="glass-card-dark-vivid p-8 flex flex-col transition-all duration-300"
                style={{ border: `1px solid ${member.color}18` }}
              >
                <div className="flex items-center gap-5 mb-6">
                  {/* Avatar tile — member accent color for background/border/initial, unchanged */}
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold shrink-0"
                    style={{
                      background: `${member.color}10`,
                      border:     `2px solid ${member.color}30`,
                      color:      member.color,
                    }}
                  >
                    {member.initials}
                  </div>
                  <div>
                    {/* Name — white on dark */}
                    <h3 className="text-2xl font-bold" style={{ color: "#FFFFFF" }}>{member.name}</h3>
                    <p className="text-sm font-medium mt-0.5" style={{ color: member.color }}>{member.role}</p>
                  </div>
                </div>

                {/* Bio — 70% white for readable body copy */}
                <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.70)" }}>{member.bio}</p>

                {/* Pull-quote — left border in member accent color, quote text at 55% white.
                    Focus box and skill chips intentionally removed: the bare quote keeps the
                    card feeling like a piece of the founders rather than a résumé. */}
                <blockquote className="mt-auto border-l-2 pl-4" style={{ borderColor: member.color }}>
                  <p className="text-xs italic leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                    &ldquo;{member.quote}&rdquo;
                  </p>
                </blockquote>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Footer note — muted white on dark, white-based divider ── */}
        <div className="pt-8 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>
            Kinextion &copy; {new Date().getFullYear()} — Systems are our creation. Action leading to intentional impact.
          </p>
        </div>

      </div>
    </section>
  );
}
