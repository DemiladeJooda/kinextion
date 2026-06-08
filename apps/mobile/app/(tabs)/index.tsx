import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const MOCK_RECOMMENDATIONS = [
  {
    id: "1",
    content:
      "You've been seated most of the afternoon. Try standing during your next call and taking a 10-minute walk.",
    category: "physical" as const,
  },
  {
    id: "2",
    content:
      "Before bed tonight, write down one thing that went well today.",
    category: "emotional" as const,
  },
];

const CATEGORY_COLORS = {
  physical: "#00D68F",
  mental: "#3B82F6",
  emotional: "#A855F7",
  spiritual: "#0ABAB5",
};

export default function TodayScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A1A" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 4,
          }}
        >
          Good morning
        </Text>
        <Text style={{ color: "#64748B", fontSize: 14, marginBottom: 24 }}>
          Here&apos;s your system for today
        </Text>

        {/* Kinextion Score */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "rgba(0,214,143,0.15)",
          }}
        >
          <Text
            style={{
              color: "#64748B",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 8,
            }}
          >
            Kinextion Score
          </Text>
          <Text
            style={{
              fontSize: 56,
              fontWeight: "800",
              color: "#00D68F",
              marginBottom: 4,
            }}
          >
            --
          </Text>
          <Text style={{ color: "#94A3B8", fontSize: 13 }}>
            Complete your first habit to start building your score
          </Text>
          <View
            style={{
              height: 6,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 3,
              marginTop: 16,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: "0%",
                borderRadius: 3,
                backgroundColor: "#00D68F",
              }}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <Text
          style={{
            color: "#94A3B8",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Quick Actions
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <Pressable
            onPress={() => router.push("/chat/altheo" as never)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,214,143,0.08)",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(0,214,143,0.15)",
            }}
          >
            <Text
              style={{
                color: "#00D68F",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Altheo
            </Text>
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              Talk to your coach
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/chat/kairo" as never)}
            style={{
              flex: 1,
              backgroundColor: "rgba(168,85,247,0.08)",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(168,85,247,0.15)",
            }}
          >
            <Text
              style={{
                color: "#A855F7",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Kairo
            </Text>
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>
              Reflect &amp; process
            </Text>
          </Pressable>
        </View>

        {/* Recommendations */}
        <Text
          style={{
            color: "#94A3B8",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          For You Today
        </Text>
        {MOCK_RECOMMENDATIONS.map((rec) => (
          <View
            key={rec.id}
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              borderLeftWidth: 3,
              borderLeftColor: CATEGORY_COLORS[rec.category],
            }}
          >
            <Text
              style={{ color: "#E2E8F0", fontSize: 14, lineHeight: 20 }}
            >
              {rec.content}
            </Text>
            <Text
              style={{
                color: CATEGORY_COLORS[rec.category],
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginTop: 8,
              }}
            >
              {rec.category}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
