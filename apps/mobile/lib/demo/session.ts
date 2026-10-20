/**
 * Demo mode: the whole app, running on sample data with no backend.
 *
 * Turned on with `EXPO_PUBLIC_DEMO_MODE=1`. It exists for showing the product
 * to people — every screen is populated the way it looks after a few weeks of
 * real use — and it never touches the API or Clerk. The flag is inlined at
 * build time, so a production build without it carries none of this at runtime.
 *
 * This file is the fake session: sign-in accepts any email and password,
 * sign-up accepts any six-digit code, and onboarding state is remembered for
 * the life of the app process.
 */

import { useSyncExternalStore } from "react";

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

interface DemoSession {
  signedIn: boolean;
  onboarded: boolean;
  name: string;
  email: string;
  avatarId: string | null;
}

let session: DemoSession = {
  signedIn: false,
  onboarded: true,
  name: "Jordan",
  email: "jordan@demo.kinextion.app",
  avatarId: null,
};

const listeners = new Set<() => void>();

export function getDemoSession(): DemoSession {
  return session;
}

export function updateDemoSession(patch: Partial<DemoSession>) {
  session = { ...session, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const useSession = () => useSyncExternalStore(subscribe, getDemoSession, getDemoSession);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First name from an email, so "sam.lee@x.com" greets Sam. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.split(/[._-]/)[0] ?? "";
  return local ? local[0]!.toUpperCase() + local.slice(1) : "Jordan";
}

// ─── Clerk-shaped hooks ───────────────────────────────────────────────────────

export function useDemoAuth() {
  const s = useSession();
  return {
    isLoaded: true,
    isSignedIn: s.signedIn,
    getToken: async () => "demo-token",
    signOut: async () => updateDemoSession({ signedIn: false }),
  };
}

export function useDemoUser() {
  const s = useSession();
  return {
    isLoaded: true,
    user: s.signedIn
      ? {
          firstName: s.name,
          hasImage: false,
          imageUrl: "",
          primaryEmailAddress: { emailAddress: s.email },
        }
      : null,
  };
}

export function useDemoSignIn() {
  return {
    isLoaded: true,
    setActive: async (_: { session: string | null }) => {
      updateDemoSession({ signedIn: true });
    },
    signIn: {
      create: async ({ identifier }: { identifier: string; password: string }) => {
        await wait(700);
        // A returning user: straight into a lived-in app.
        updateDemoSession({ email: identifier, name: nameFromEmail(identifier), onboarded: true });
        return { status: "complete" as const, createdSessionId: "demo-session" };
      },
    },
  };
}

export function useDemoSignUp() {
  return {
    isLoaded: true,
    setActive: async (_: { session: string | null }) => {
      updateDemoSession({ signedIn: true });
    },
    signUp: {
      create: async ({ emailAddress }: { emailAddress: string; password: string }) => {
        await wait(600);
        // A new user walks through onboarding first.
        updateDemoSession({ email: emailAddress, onboarded: false });
      },
      prepareEmailAddressVerification: async (_: { strategy: "email_code" }) => {
        await wait(300);
      },
      attemptEmailAddressVerification: async ({ code }: { code: string }) => {
        await wait(600);
        if (!/^\d{6}$/.test(code)) throw new Error("Enter any six digits.");
        return { status: "complete" as const, createdSessionId: "demo-session" };
      },
    },
  };
}
