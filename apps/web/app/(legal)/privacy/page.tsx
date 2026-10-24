/**
 * Privacy policy.
 *
 * Written from the code rather than from a template: every claim below
 * describes something that is actually implemented and can be pointed at —
 * the log redaction list in apps/api/src/server.ts, the AES-256-GCM helper in
 * lib/crypto.ts, the calendar reduction in providers/calendar-rhythm.ts, the
 * cascade in the account-delete route. If a practice changes, this page is
 * wrong and has to change with it.
 *
 * It has not been reviewed by a lawyer. It is accurate about what the software
 * does; whether it is legally sufficient for the jurisdictions Kinextion ships
 * into is a separate question, and one for a solicitor before submission.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Kinextion",
  description:
    "What Kinextion collects, why, who it's shared with, and how to get rid of it.",
};

/** Kept in one place so the page and the terms agree on the date. */
const LAST_UPDATED = "24 October 2026";

export default function PrivacyPage() {
  return (
    <article>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400 mb-3">
        Last updated {LAST_UPDATED}
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
        Privacy Policy
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed mb-10">
        Kinextion holds things people don&apos;t tell many others — how their week actually went,
        what they wrote at midnight, how they slept. This page says exactly what we keep, why we
        keep it, and how to make it stop.
      </p>

      <Section title="What we collect">
        <H3>Because you told us</H3>
        <List
          items={[
            "Account details: your email address, through our sign-in provider Clerk.",
            "Profile: display name, optional age, fitness level, goals, weekly availability, equipment, and your guide preferences.",
            "Habits and check-offs: the habits you create, the days you mark them done, amounts you log (like glasses of water), and any stretch you mark as away (travel, illness, family, a move).",
            "About you, only if you fill it in: gender, background (race, ethnicity or culture), where you live, what your days look like, who you live with, and anything else you choose to add, in your own words. It's used only so the guides fit their advice to your life. It's never guessed, never used to make assumptions about you, and you can clear it at any time.",
            "Weekly answers to four short questions about how automatic a habit feels.",
            "Daily check-ins: mood, energy, stress, tags, gratitude notes and journal entries.",
            "Conversations with the AI guides, Altheo and Kairo, typed or spoken (see Voice below).",
            "Communities, if you join one: your responses to the weekly question (text, or audio and video you record), reactions and comments, which members of that community can see. If you share a habit with a community, its members see the habit and which days you did it that week. No streaks or totals are shown.",
          ]}
        />

        <H3>Because you connected something</H3>
        <List
          items={[
            "Wearables (Strava, Whoop, Oura): activity, workouts, steps, sleep, heart-rate variability and resting heart rate, on the days those services report them. If you link a habit to one of them, we use those readings to mark the habit done for you. Those days are shown as logged automatically and you can undo them.",
            "Apple Health or Health Connect, if you connect it: daily totals only (steps, workout minutes, sleep minutes) for the last few days, read on your phone with your permission. Individual readings never leave your phone, and this data is never used for advertising.",
            "Calendars (Google, Microsoft): only the shape of your days — when your first commitment is, how many minutes are booked, and where the longest free block sits. Event titles, attendees, locations and descriptions are discarded before anything is stored, and are never sent to the AI.",
          ]}
        />

        <H3>Because you used the app</H3>
        <List
          items={[
            "Your daily Kinextion Score and its components.",
            "Recommendations we generated and whether you acted on or skipped them.",
            "Short factual notes distilled from your conversations — for example a stated goal or an injury to work around — so a guide doesn't ask you the same question every week.",
          ]}
        />

        <H3>On this website</H3>
        <List
          items={[
            "If you join the early-access list: your email address and which page you submitted it from.",
            "Anonymous usage events: which tab was viewed, how long for, how far it was scrolled, and whether the chat demo was used. These carry a random id that lives only until you close the browser tab. No IP address, no cookie, no advertising identifier, no third-party analytics script.",
            "If your browser sends Do Not Track or Global Privacy Control, we collect no usage events from you at all.",
          ]}
        />
      </Section>

      <Section title="Voice">
        <p>
          When you talk to a guide, your phone&apos;s own speech recognition turns what you say into
          text. Where your phone supports it, that happens on the phone. Otherwise your phone&apos;s
          speech service (Apple&apos;s or Google&apos;s) does it, under their terms. Kinextion only
          receives the text, and we never record or keep audio of your conversations.
        </p>
        <p className="mt-4">
          Replies are read aloud by your phone&apos;s built-in voice. If we switch on a premium voice,
          the text of the guide&apos;s reply is sent to that voice provider (currently ElevenLabs) to
          be spoken. The audio is played and then deleted from your phone.
        </p>
      </Section>

      <Section title="Camera">
        <p>
          Smart Referee, Form Control and Environment Design send individual camera frames for
          analysis and receive an answer back. Frames are not stored, not used for training, and
          not retained after the response. The camera only runs while you have one of those
          screens open.
        </p>
      </Section>

      <Section title="What we do with it">
        <List
          items={[
            "Run the product: compute your score, track streaks, answer you as a guide who remembers the last conversation.",
            "Personalise: suggest habits that fit your real days, and learn which recommendations you actually act on.",
            "Find real patterns: correlate connected data against your mood and habits. We only surface a pattern once there are at least five overlapping days and the relationship is strong enough to be worth stating, and we always show the sample size.",
          ]}
        />
        <p className="mt-4">
          We do not sell your data. We do not share it with advertisers. We do not use it to train
          anyone&apos;s models.
        </p>
      </Section>

      <Section title="Who else sees it">
        <List
          items={[
            "Anthropic processes the text of your conversations and the context we send with them, in order to generate replies. It is a processor acting on our instructions.",
            "If a premium voice is on, the voice provider (currently ElevenLabs) receives the text of guides' replies in order to speak them. Nothing you say is sent to it.",
            "Members of a community you join see what you post there, and any habit you choose to share with it.",
            "Clerk handles sign-in and holds your email address and authentication credentials.",
            "Our database is hosted with a managed Postgres provider.",
            "Strava, Whoop, Oura, Google and Microsoft receive nothing from us. The connection is one-way: we read what you authorised, and you can revoke it at any time from their side or ours.",
            "A therapist, only if you switch it on. The Therapist Starter Pack is off by default, opt-in for each category separately, and revocable. Nothing is shared with anyone until you do that.",
          ]}
        />
      </Section>

      <Section title="How it's protected">
        <List
          items={[
            "Journal entries, gratitude notes, chat messages and authentication tokens are stripped from our server logs before they are written.",
            "Access tokens for connected services are encrypted with AES-256-GCM before storage.",
            "Every request is checked against the signed-in account. No route trusts an identifier sent by the client.",
            "Errors return a fixed message rather than internal detail.",
          ]}
        />
        <p className="mt-4">
          No system is perfectly secure, and we won&apos;t claim otherwise. If you find a
          vulnerability, please tell us before telling anyone else.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Detailed records age out on a schedule and are compressed into summaries — weekly and
          monthly aggregates survive where individual rows do not, so long-term trends stay
          available without keeping every raw row forever. Conversation transcripts are compacted
          into short factual notes and then deleted. Your account data is kept for as long as your
          account exists.
        </p>
      </Section>

      <Section title="Your choices">
        <List
          items={[
            "Download a copy: Profile → Privacy & data → Download my data. You get one file with your habits, check-ins, journals, conversations, remembered facts and community posts. Connection keys are never included, and neither is anything other people wrote.",
            "Delete everything: Profile → Privacy & data → Delete account, in the app. This immediately removes your habits, check-ins, journals, conversations, scores, connected accounts and remembered facts, then removes your sign-in identity. It cannot be undone.",
            "Disconnect a service: Profile → the connection → disconnect. Readings already pulled are removed with your account, or you can delete the account to remove them now.",
            "Stop sharing with a therapist: revoke consent in the app. Reports already generated and handed over are snapshots and stay as they were.",
            "Turn off site analytics: enable Do Not Track or Global Privacy Control in your browser.",
            "Leave the early-access list: reply to any email from us, or contact us, and we'll remove your address.",
          ]}
        />
        <p className="mt-4">
          Depending on where you live you may also have the right to access, correct, export or
          object to our use of your data. Contact us and we&apos;ll action it.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Kinextion is for people aged 13 and over. We don&apos;t knowingly collect data from
          children under 13. If you believe a child has given us data, contact us and we&apos;ll
          remove it.
        </p>
      </Section>

      <Section title="Where data is processed">
        <p>
          Our infrastructure and the services listed above operate in the United States, so your
          data is processed there regardless of where you use Kinextion.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change what we collect or who processes it, we&apos;ll update this page and the
          date at the top. Material changes will be flagged in the app before they take effect.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-slate-500">
          A published contact address will appear here before Kinextion is released. We&apos;re
          deliberately not listing one that nobody is monitoring yet.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-11">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">{title}</h2>
      <div className="text-[15px] leading-relaxed text-slate-600 space-y-3">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-400 mt-6 mb-2">
      {children}
    </h3>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "linear-gradient(135deg, #00C47A 0%, #0ABAB5 100%)" }}
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
