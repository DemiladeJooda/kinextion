/**
 * Throwaway accounts for testing sign-up and onboarding again and again.
 *
 * Uses Clerk's development-instance test identities: any email containing
 * `+clerk_test`, and phone numbers in +1 (XXX) 555-0100–0199, never get a
 * real email or SMS and always verify with 424242. They only work against a
 * `pk_test_` instance, so the button is gated on that as well as __DEV__.
 */

import type { useSignUp } from "@clerk/clerk-expo";

import { DEMO_MODE } from "./demo/session";

type ClerkSignUp = NonNullable<ReturnType<typeof useSignUp>["signUp"]>;

const TEST_CODE = "424242";

export const testAccountsEnabled =
  __DEV__ &&
  !DEMO_MODE &&
  (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");

const randomDigits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

const randomPassword = () =>
  `kx-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

/** +1 (XXX) 555-01NN with a random area code, so repeat runs don't collide. */
const randomTestPhone = () => `+1${200 + Math.floor(Math.random() * 790)}55501${randomDigits(2)}`;

/**
 * Creates and verifies a fresh test user, returning its session id for
 * `setActive`. Fills in a test phone number when the Clerk instance requires
 * one, so it works whichever way the dashboard is set.
 */
export async function createTestAccount(signUp: ClerkSignUp): Promise<{ email: string; sessionId: string }> {
  const email = `tester-${randomDigits(6)}+clerk_test@example.com`;

  await signUp.create({ emailAddress: email, password: randomPassword() });
  await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
  let result = await signUp.attemptEmailAddressVerification({ code: TEST_CODE });

  if (result.status === "missing_requirements" && result.missingFields.includes("phone_number")) {
    // A taken test number throws; a few random tries is plenty.
    for (let attempt = 0; ; attempt++) {
      try {
        await result.update({ phoneNumber: randomTestPhone() });
        break;
      } catch (err) {
        if (attempt >= 2) throw err;
      }
    }
    await result.preparePhoneNumberVerification({ strategy: "phone_code" });
    result = await result.attemptPhoneNumberVerification({ code: TEST_CODE });
  }

  if (result.status !== "complete" || !result.createdSessionId) {
    throw new Error(`Test sign-up stopped at "${result.status}". Still missing: ${result.missingFields.join(", ") || "nothing listed"}.`);
  }
  return { email, sessionId: result.createdSessionId };
}
