import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const guides = [
  {
    id: "altheo",
    name: "Altheo",
    title: "The Coach",
    description: "Workouts, nutrition, form guidance, and recovery.",
    color: "#00D68F",
    bgColor: "rgba(0,214,143,0.08)",
    borderColor: "rgba(0,214,143,0.15)",
    icon: "fitness-outline" as const,
  },
  {
    id: "kairo",
    name: "Kairo",
    title: "The Listener",
    description: "Mood, reflection, journaling, and emotional clarity.",
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.08)",
    borderColor: "rgba(168,85,247,0.15)",
    icon: "leaf-outline" as const,
  },
];

export default function ChatSelectScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A1A" }}>
      <View style={{ padding: 20, flex: 1 }}>
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 4,
          }}
        >
          Your Guides
        </Text>
        <Text style={{ color: "#64748B", fontSize: 14, marginBottom: 32 }}>
          Choose who you want to talk to
        </Text>

        {guides.map((guide) => (
          <Pressable
            key={guide.id}
            onPress={() => router.push(`/chat/${guide.id}` as never)}
            style={{
              backgroundColor: guide.bgColor,
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: guide.borderColor,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: `${guide.color}20`,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <Ionicons name={guide.icon} size={24} color={guide.color} />
              </View>
              <View>
                <Text
                  style={{
                    color: guide.color,
                    fontSize: 22,
                    fontWeight: "700",
                  }}
                >
                  {guide.name}
                </Text>
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>
                  {guide.title}
                </Text>
              </View>
            </View>
            <Text
              style={{ color: "#94A3B8", fontSize: 14, lineHeight: 20 }}
            >
              {guide.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
