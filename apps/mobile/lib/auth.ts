/**
 * Session hooks for the app. Screens import these instead of Clerk directly,
 * so demo mode can stand in without a Clerk key or a network. The choice is
 * made once, at build time, so hook order never changes between renders.
 */

import {
  useAuth as useClerkAuth,
  useSignIn as useClerkSignIn,
  useSignUp as useClerkSignUp,
  useUser as useClerkUser,
} from "@clerk/clerk-expo";

import {
  DEMO_MODE,
  useDemoAuth,
  useDemoSignIn,
  useDemoSignUp,
  useDemoUser,
} from "./demo/session";

export { DEMO_MODE };

export const useAuth = (DEMO_MODE ? useDemoAuth : useClerkAuth) as typeof useDemoAuth;
export const useUser = (DEMO_MODE ? useDemoUser : useClerkUser) as unknown as typeof useDemoUser;
export const useSignIn = (DEMO_MODE ? useDemoSignIn : useClerkSignIn) as unknown as () =>
  | ReturnType<typeof useDemoSignIn>
  | { isLoaded: false; signIn: undefined; setActive: undefined };
export const useSignUp = (DEMO_MODE ? useDemoSignUp : useClerkSignUp) as unknown as () =>
  | ReturnType<typeof useDemoSignUp>
  | { isLoaded: false; signUp: undefined; setActive: undefined };
