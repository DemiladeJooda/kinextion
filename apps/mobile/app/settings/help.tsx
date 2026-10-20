/**
 * Help & support.
 *
 * The important half of this screen is the top of it. Until now the crisis
 * resources existed only inside the guides' system prompt, which meant they
 * were reachable only by starting a conversation and disclosing enough for a
 * model to decide to offer them. Someone in trouble at 3am should not have to
 * negotiate with a chatbot to find a phone number — so the same list the
 * guides are instructed to give is here, static, one tap from the profile tab,
 * and reachable whether or not anything is working.
 *
 * The list is imported from @kinextion/ai-core rather than retyped, so the
 * numbers on this screen and the numbers a guide gives are the same numbers.
 */

import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CRISIS_RESOURCES } from "@kinextion/ai-core";

import { AuroraBackdrop, Card, Label, PressCard, ScreenHeader, Txt } from "../../components/ui";
import { color, radius, space, tint } from "../../theme";

/** What the guides are and aren't — the same boundaries their prompts carry. */
const BOUNDARIES = [
  "Althea and Kairo are AI. They are not doctors, therapists, dietitians or physiotherapists.",
  "Nothing in Kinextion is medical advice, a diagnosis, or a treatment plan.",
  "For pain, injury or symptoms, talk to a qualified healthcare provider.",
  "The therapist starter pack is context for a licensed therapist you already have — Kinextion doesn't provide one.",
];

export default function HelpScreen() {
  const version =
    Constants.expoConfig?.version ?? (Constants.expoConfig as { version?: string } | null)?.version;

  const open = (href: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Linking.openURL(href).catch(() => {
      // A device without a dialler or browser for the scheme — the number is
      // still on screen to be read or typed manually, which is the point of
      // showing it as text rather than only as a button.
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Help & support",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.red} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Help & support" subtitle="Including the numbers that matter most." />

        {/* ── Crisis resources. First, always. ─────────────────────── */}
        <Card accent={color.red}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
            }}
          >
            <Ionicons name="heart" size={16} color={color.red} />
            <Label c={color.red}>If you need help right now</Label>
          </View>

          <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
            If you&apos;re in immediate danger, call your local emergency number. Otherwise these
            are free, confidential, and answered by people.
          </Txt>

          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {CRISIS_RESOURCES.map((r) => (
              <PressCard
                key={r.name}
                haptic="none"
                onPress={() => open(r.href)}
                style={{
                  padding: space.lg,
                  backgroundColor: tint(color.red, 0.08),
                  borderColor: tint(color.red, 0.22),
                  shadowOpacity: 0,
                  elevation: 0,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.sm,
                      }}
                    >
                      <Txt variant="bodyStrong">{r.name}</Txt>
                      <View
                        style={{
                          paddingHorizontal: space.sm,
                          paddingVertical: 1,
                          borderRadius: radius.pill,
                          backgroundColor: tint(color.red, 0.14),
                        }}
                      >
                        <Txt variant="label" c={color.red} style={{ fontSize: 9 }}>
                          {r.region}
                        </Txt>
                      </View>
                    </View>
                    <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                      {r.detail}
                    </Txt>
                  </View>
                  <Ionicons
                    name={
                      r.href.startsWith("tel:")
                        ? "call"
                        : r.href.startsWith("sms:")
                          ? "chatbubble"
                          : "open-outline"
                    }
                    size={17}
                    color={color.red}
                  />
                </View>
              </PressCard>
            ))}
          </View>
        </Card>

        {/* ── What this app is ─────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl, marginBottom: space.md }}>
          <Label>What Kinextion is, and isn&apos;t</Label>
        </View>
        <Card>
          <View style={{ gap: space.md }}>
            {BOUNDARIES.map((line) => (
              <View key={line} style={{ flexDirection: "row", gap: space.md }}>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={color.textFaint}
                  style={{ marginTop: 2 }}
                />
                <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                  {line}
                </Txt>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Contact ──────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl, marginBottom: space.md }}>
          <Label>Getting in touch</Label>
        </View>
        <PressCard haptic="light" onPress={() => open("mailto:demilade.jooda10@gmail.com")}>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Ionicons name="mail-outline" size={16} color={color.text} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Email support</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                demilade.jooda10@gmail.com
              </Txt>
            </View>
            <Ionicons name="open-outline" size={17} color={color.textFaint} />
          </View>
        </PressCard>

        <View style={{ alignItems: "center", marginTop: space.xxl }}>
          <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
            Kinextion{version ? ` ${version}` : ""}
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
