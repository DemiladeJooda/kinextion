/**
 * Terms of service.
 *
 * Same standard as the privacy page: it describes what this product actually
 * is and what it actually does, in plain sentences, rather than being pasted
 * from a generic template. The medical and crisis language is not boilerplate
 * — it mirrors the boundaries the AI guides are instructed to hold, so what a
 * user is told here and what a guide will say to them agree.
 *
 * Not reviewed by a lawyer. Accurate about the software; get it checked for
 * legal sufficiency before submitting to either store.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Kinextion",
  description: "The agreement for using Kinextion, in plain language.",
};

const LAST_UPDATED = "10 September 2026";

export default function TermsPage() {
  return (
    <article>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400 mb-3">
        Last updated {LAST_UPDATED}
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
        Terms of Service
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed mb-10">
        The short version: Kinextion is a wellness tool, not a doctor. Use it honestly, don&apos;t
        break it, and you can leave with your data deleted at any time.
      </p>

      {/* The one section people most need to have actually read. */}
      <section
        className="mb-11 rounded-2xl px-6 py-6"
        style={{ background: "rgba(239,68,68,0.05)", border: "1.5px solid rgba(239,68,68,0.18)" }}
      >
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
          Kinextion is not medical care
        </h2>
        <div className="text-[15px] leading-relaxed text-slate-600 space-y-3">
          <p>
            Kinextion does not provide medical advice, diagnosis or treatment, and is not a medical
            device. Althea and Kairo are AI. They are not doctors, therapists, dietitians or
            physiotherapists, and nothing either says is a substitute for a qualified professional.
          </p>
          <p>
            Talk to a healthcare provider before starting or changing an exercise programme,
            especially if you have a medical condition, are pregnant, or are recovering from
            injury. Stop and seek help if something hurts.
          </p>
          <p className="font-semibold text-slate-900">
            If you are in crisis or thinking about harming yourself, contact emergency services. In
            the US, call or text 988 for the Suicide &amp; Crisis Lifeline, or text HOME to 741741
            for the Crisis Text Line. Kinextion is not an emergency service and cannot get help to
            you.
          </p>
        </div>
      </section>

      <Section title="Who can use it">
        <p>
          You need to be at least 13. If you&apos;re under 18, you need a parent or guardian&apos;s
          permission. One account per person, and the details you give should be accurate — the
          guides reason from them, so a false answer produces worse advice for you and nobody else.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You&apos;re responsible for keeping your sign-in secure and for what happens under your
          account. Tell us if you think someone else has access to it. You can delete your account
          from inside the app at any time; see the{" "}
          <a href="/privacy" className="text-slate-900 underline underline-offset-4">
            privacy policy
          </a>{" "}
          for exactly what that removes.
        </p>
      </Section>

      <Section title="What the AI does, and doesn't">
        <List
          items={[
            "The guides generate responses. They can be wrong, and they can be confidently wrong. Treat their output as a suggestion, not an instruction.",
            "Recommendations, habit suggestions and patterns are built from the data you've logged or connected. Where there isn't enough data to say something honest, the product is built to say so rather than guess — but no automated system is right every time.",
            "Correlations shown in the app describe relationships in your own data. They are not claims about cause.",
            "Don't use Kinextion to make decisions that need professional judgement — medical, legal, financial or otherwise.",
          ]}
        />
      </Section>

      <Section title="Your content">
        <p>
          Your journals, habits, check-ins and conversations belong to you. You grant us only the
          permission needed to operate the service for you: to store that content, to process it in
          order to generate responses and insights, and to show it back to you. We don&apos;t
          publish it, sell it, or use it to train models. We don&apos;t claim ownership of it.
        </p>
      </Section>

      <Section title="Connected services">
        <p>
          Connecting Strava, Whoop, Oura, Google Calendar or Outlook is your choice and stays under
          your control. Those services have their own terms and privacy policies, and we&apos;re not
          responsible for how they behave. We read what you authorised and nothing else, and you can
          disconnect at any time.
        </p>
      </Section>

      <Section title="Sharing with a therapist">
        <p>
          The Therapist Starter Pack produces a summary you can pass to a licensed professional you
          already have. Kinextion does not provide therapists, does not vet them, and is not part of
          your relationship with one. Sharing is off by default and every category is opt-in.
          Reports you generate are snapshots — revoking consent later stops new reports, and does
          not recall one you already handed over.
        </p>
      </Section>

      <Section title="Fair use">
        <List
          items={[
            "Don't attempt to break, overload, scrape or reverse-engineer the service.",
            "Don't use it to harass anyone, or to generate content that harms someone.",
            "Don't resell it or use another person's account.",
            "We may suspend an account that does these things.",
          ]}
        />
      </Section>

      <Section title="Availability">
        <p>
          Kinextion is early software and is provided as it is. We don&apos;t promise it will be
          available without interruption, free of bugs, or that any particular feature will keep
          working. We may change or discontinue features, and we&apos;ll give notice in the app
          where a change materially affects you.
        </p>
      </Section>

      <Section title="Limits">
        <p>
          To the extent the law allows, Kinextion is provided without warranties, and we are not
          liable for indirect or consequential losses arising from your use of it. Nothing here
          limits liability that cannot legally be limited — including for death or personal injury
          caused by negligence, or for fraud.
        </p>
      </Section>

      <Section title="Ending it">
        <p>
          You can stop using Kinextion whenever you like and delete your account from the app. We
          may end your access if you materially breach these terms. The sections on your content,
          limits and liability survive.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We&apos;ll update this page if the terms change, and the date at the top with it.
          Continuing to use Kinextion after a change means you accept it.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-slate-500">
          A published contact address will appear here before Kinextion is released.
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
