import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSignIn } from "../../lib/auth";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  AuroraBackdrop,
  BrandMark,
  Button,
  IconField,
  Label,
  Notice,
  Txt,
} from "../../components/ui";
import { firstClerkError } from "../../lib/clerk-error";
import { color, space } from "../../theme";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded || loading || !email || !password) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // AuthGate routes to onboarding or the tabs once the profile resolves.
      } else {
        console.log("Sign-in did not complete:", JSON.stringify(attempt, null, 2));
        setError(`Couldn't complete sign-in (status: ${attempt.status}).`);
      }
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(firstClerkError(err) ?? "Check your email and password and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <AuroraBackdrop accent={color.green} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
            <BrandMark size={72} />
            <View style={{ marginTop: space.xl }}>
              <Label c={color.green}>Welcome back</Label>
            </View>
            <Txt variant="display" style={{ textAlign: "center", marginTop: space.xs }}>
              Kinextion
            </Txt>
            <Txt
              variant="body"
              c={color.textMuted}
              style={{ textAlign: "center", marginTop: space.xs }}
            >
              Your guides kept your place.
            </Txt>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(500).delay(120)}
            style={{ gap: space.md, marginTop: space.xxxl }}
          >
            <IconField
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              inputProps={{
                autoCapitalize: "none",
                autoComplete: "email",
                keyboardType: "email-address",
                textContentType: "emailAddress",
                returnKeyType: "next",
              }}
            />
            <IconField
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secure
              inputProps={{
                autoComplete: "password",
                textContentType: "password",
                returnKeyType: "go",
                onSubmitEditing: () => void onSubmit(),
              }}
            />
            {error ? <Notice>{error}</Notice> : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(500).delay(220)}
            style={{ marginTop: space.xl }}
          >
            <Button
              label="Sign in"
              icon="arrow-forward"
              onPress={onSubmit}
              loading={loading}
              disabled={!email || !password}
              accent={color.green}
            />
            <Pressable
              onPress={() => router.push("/(auth)/sign-up" as never)}
              hitSlop={8}
              style={{ marginTop: space.xl, alignItems: "center" }}
            >
              <View style={{ flexDirection: "row" }}>
                <Txt variant="small" c={color.textMuted}>
                  New here?{" "}
                </Txt>
                <Txt variant="small" c={color.green} style={{ fontWeight: "700" }}>
                  Create an account
                </Txt>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
