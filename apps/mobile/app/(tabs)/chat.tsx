import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GUIDES, type GuideId } from "@kinextion/ai-core";

import {
  AuroraBackdrop,
  Badge,
  Card,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { color, radius, space, tint } from "../../theme";

/** What each guide is for, in the user's language rather than the brand's. */
const GUIDE_DETAIL: Record<
  GuideId,
  { icon: keyof typeof Ionicons.glyphMap; blurb: string; goodFor: string[] }
> = {
  altheo: {
    icon: "flash",
    blurb:
      "Reads your numbers and builds the plan around your actual week — then changes it when the week changes.",
    goodFor: ["Training & recovery", "Nutrition that's realistic", "Resizing a habit that keeps slipping"],
  },
  kairo: {
    icon: "water",
    blurb:
      "Notices what you don't say. Meets you where you are, without rushing you anywhere.",
    goodFor: ["Stress and overwhelm", "Why consistency keeps breaking", "Thinking out loud, safely"],
  },
};

export default function GuidesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.purple} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Your guides"
          subtitle="Two voices. One system that remembers you."
        />

        <View style={{ gap: space.lg }}>
          {(Object.keys(GUIDE_DETAIL) as GuideId[]).map((id, i) => {
            const g = GUIDES[id];
            const d = GUIDE_DETAIL[id];
            return (
              <Animated.View key={id} entering={FadeInDown.duration(450).delay(i * 90)}>
                <PressCard accent={g.color} onPress={() => router.push(`/chat/${id}` as never)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: radius.md,
                        backgroundColor: tint(g.color, 0.14),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name={d.icon} size={26} color={g.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="title" c={g.color}>
                        {g.name}
                      </Txt>
                      <Txt variant="small" c={color.textMuted}>
                        {g.role}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={color.textFaint} />
                  </View>

                  <Txt variant="body" c={color.textMuted} style={{ marginTop: space.lg }}>
                    {d.blurb}
                  </Txt>

                  <View style={{ marginTop: space.lg, gap: space.sm }}>
                    {d.goodFor.map((item) => (
                      <View
                        key={item}
                        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
                      >
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: g.color,
                          }}
                        />
                        <Txt variant="small" c={color.textMuted}>
                          {item}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </PressCard>
              </Animated.View>
            );
          })}
        </View>

        <SectionTitle>Good to know</SectionTitle>
        <Card>
          <View style={{ flexDirection: "row", gap: space.md, marginBottom: space.lg }}>
            <Ionicons name="lock-closed-outline" size={17} color={color.teal} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Your conversations are yours</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                Both guides see the context you choose to share in Profile.
                Nothing is posted to your pod.
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Ionicons name="medkit-outline" size={17} color={color.red} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Not a substitute for care</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                Neither guide is a doctor or a therapist. If something is
                serious, they will say so and point you to real support.
              </Txt>
            </View>
          </View>
        </Card>

        <View style={{ alignItems: "center", marginTop: space.xl }}>
          <Badge label="Powered by Claude" accent={color.textFaint} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
