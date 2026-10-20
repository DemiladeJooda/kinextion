import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSignUp } from "../../lib/auth";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import {
  AuroraBackdrop,
  BackButton,
  BrandMark,
  Button,
  IconField,
  Label,
  Notice,
  Txt,
} from "../../components/ui";
import { firstClerkError } from "../../lib/clerk-error";
import { color, space, tint } from "../../theme";

const MIN_PASSWORD = 8;

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fail = (err: unknown, fallback: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(firstClerkError(err) ?? fallback);
  };

  const onCreate = async () => {
    if (!isLoaded || loading || !email || password.length < MIN_PASSWORD) return;
    setError(null);
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      fail(err, "Couldn't create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded || loading || code.trim().length < 6) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // New account, no profile yet — onboarding persists it once completed.
        router.replace("/onboarding" as never);
      } else {
        setError("That code didn't work. Try again.");
      }
    } catch (err) {
      fail(err, "That code didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setNotice(`New code sent to ${email.trim()}.`);
    } catch (err) {
      fail(err, "Couldn't resend the code.");
    }
  };

  const strength = Math.min(password.length / MIN_PASSWORD, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <AuroraBackdrop accent={color.purple} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: space.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackButton
            onPress={
              pendingVerification
                ? () => {
                    setPendingVerification(false);
                    setCode("");
                    setError(null);
                  }
                : undefined
            }
          />

          <View style={{ flex: 1, justifyContent: "center" }}>
            {pendingVerification ? (
              <Animated.View
                key="verify"
                entering={FadeInRight.duration(320)}
                style={{ gap: space.md }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: tint(color.purple, 0.14),
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: space.md,
                  }}
                >
                  <Txt variant="title">✉️</Txt>
                </View>
                <Label c={color.purple}>Check your email</Label>
                <Txt variant="title">Enter the code we sent</Txt>
                <Txt variant="body" c={color.textMuted}>
                  Six digits, sent to {email.trim()}.
                </Txt>
                <View style={{ marginTop: space.lg, gap: space.md }}>
                  <IconField
                    icon="keypad-outline"
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                    placeholder="123456"
                    accent={color.purple}
                    inputProps={{
                      keyboardType: "number-pad",
                      maxLength: 6,
                      autoFocus: true,
                      textContentType: "oneTimeCode",
                      autoComplete: "one-time-code",
                      onSubmitEditing: () => void onVerify(),
                    }}
                  />
                  {error ? <Notice>{error}</Notice> : null}
                  {notice && !error ? (
                    <Notice accent={color.green} icon="checkmark-circle">
                      {notice}
                    </Notice>
                  ) : null}
                </View>
                <Button
                  label="Verify and continue"
                  icon="checkmark"
                  onPress={onVerify}
                  loading={loading}
                  disabled={code.trim().length < 6}
                  accent={color.purple}
                  style={{ marginTop: space.md }}
                />
                <Pressable
                  onPress={onResend}
                  hitSlop={8}
                  style={{ alignItems: "center", marginTop: space.md }}
                >
                  <Txt variant="small" c={color.purple} style={{ fontWeight: "700" }}>
                    Resend code
                  </Txt>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View key="create" entering={FadeInDown.duration(450)}>
                <View style={{ alignItems: "center" }}>
                  <BrandMark size={64} />
                  <View style={{ marginTop: space.xl }}>
                    <Label c={color.purple}>Get started</Label>
                  </View>
                  <Txt variant="title" style={{ textAlign: "center", marginTop: space.xs }}>
                    Create your account
                  </Txt>
                  <Txt
                    variant="body"
                    c={color.textMuted}
                    style={{ textAlign: "center", marginTop: space.xs }}
                  >
                    Two guides and a community, in one place.
                  </Txt>
                </View>

                <View style={{ gap: space.md, marginTop: space.xxl }}>
                  <IconField
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    accent={color.purple}
                    inputProps={{
                      autoCapitalize: "none",
                      autoComplete: "email",
                      keyboardType: "email-address",
                      textContentType: "emailAddress",
                    }}
                  />
                  <IconField
                    icon="lock-closed-outline"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secure
                    accent={color.purple}
                    inputProps={{
                      autoComplete: "new-password",
                      textContentType: "newPassword",
                      onSubmitEditing: () => void onCreate(),
                    }}
                  />
                  {/* Length meter — the only rule, shown rather than scolded. */}
                  <View style={{ gap: 6 }}>
                    <View
                      style={{
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: color.surfaceAlt,
                      }}
                    >
                      <View
                        style={{
                          height: 3,
                          borderRadius: 2,
                          width: `${strength * 100}%`,
                          backgroundColor: strength < 1 ? color.amber : color.green,
                        }}
                      />
                    </View>
                    <Txt
                      variant="small"
                      c={strength < 1 ? color.textFaint : color.green}
                      style={{ fontSize: 12 }}
                    >
                      {strength < 1 ? `At least ${MIN_PASSWORD} characters` : "Good to go"}
                    </Txt>
                  </View>
                  {error ? <Notice>{error}</Notice> : null}
                </View>

                <Button
                  label="Create account"
                  icon="arrow-forward"
                  onPress={onCreate}
                  loading={loading}
                  disabled={!email || password.length < MIN_PASSWORD}
                  accent={color.purple}
                  style={{ marginTop: space.xl }}
                />
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={{ marginTop: space.xl, alignItems: "center" }}
                >
                  <View style={{ flexDirection: "row" }}>
                    <Txt variant="small" c={color.textMuted}>
                      Already have an account?{" "}
                    </Txt>
                    <Txt variant="small" c={color.purple} style={{ fontWeight: "700" }}>
                      Sign in
                    </Txt>
                  </View>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
