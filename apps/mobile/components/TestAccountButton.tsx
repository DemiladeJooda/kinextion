/**
 * Development-only "New test account" button for the auth screens. Render it
 * behind `testAccountsEnabled`: it calls Clerk's hook directly, which only
 * exists under the ClerkProvider (never in demo mode).
 */

import { useState } from "react";
import { View } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

import { Button, Notice, Txt } from "./ui";
import { firstClerkError } from "../lib/clerk-error";
import { createTestAccount } from "../lib/test-account";
import { color, space } from "../theme";

export function TestAccountButton() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    if (!isLoaded || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { sessionId } = await createTestAccount(signUp);
      await setActive({ session: sessionId });
      router.replace("/onboarding" as never);
    } catch (err) {
      setError(firstClerkError(err) ?? (err instanceof Error ? err.message : "Couldn't create a test account."));
      setLoading(false);
    }
  };

  return (
    <View style={{ marginTop: space.xxl, gap: space.sm }}>
      <Button
        label="New test account"
        icon="flask-outline"
        variant="ghost"
        accent={color.amber}
        onPress={() => void onPress()}
        loading={loading}
      />
      <Txt variant="small" c={color.textFaint} style={{ textAlign: "center", fontSize: 12 }}>
        Development only. A fresh user straight into onboarding, no email needed.
      </Txt>
      {error ? <Notice>{error}</Notice> : null}
    </View>
  );
}
