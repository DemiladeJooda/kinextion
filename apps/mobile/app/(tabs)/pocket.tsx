import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  TAB_BAR_CLEARANCE,
  AuroraBackdrop,
  Badge,
  PressCard,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { color, radius, space, tint } from "../../theme";

const FEATURES = [
  {
    icon: "videocam-outline" as const,
    title: "Smart Referee",
    body: "Calls the game, and shows you why.",
    accent: color.green,
    href: "/features/referee",
  },
  {
    icon: "body-outline" as const,
    title: "Form Control",
    body: "Each checkpoint scored, with the reason.",
    accent: color.amber,
    href: "/features/form",
  },
  {
    icon: "color-filter-outline" as const,
    title: "Environment Design",
    body: "Reads your actual room. Names the fixes.",
    accent: color.teal,
    href: "/features/environment",
  },
  {
    icon: "body-outline" as const,
    title: "Live Pose Preview",
    body: "Real-time skeleton overlay, beta.",
    accent: color.purple,
    href: "/features/pose-preview",
  },
];

export default function PocketScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.amber} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="In your pocket"
          subtitle="Point your camera. Kinextion tells you what it sees."
        />

        <View style={{ gap: space.md }}>
          {FEATURES.map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.duration(450).delay(i * 90)}>
              <PressCard
                accent={f.accent}
                onPress={() => router.push(f.href as never)}
                style={{ padding: space.lg }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: tint(f.accent, 0.14),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={f.icon} size={23} color={f.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{f.title}</Txt>
                    <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
                      {f.body}
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
                </View>
              </PressCard>
            </Animated.View>
          ))}
        </View>

        <View style={{ alignItems: "center", marginTop: space.xl }}>
          <Badge label="Camera stays on your device" accent={color.textFaint} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
