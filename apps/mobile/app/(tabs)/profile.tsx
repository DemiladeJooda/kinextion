import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const settingsItems = [
  { icon: "person-outline" as const, label: "Edit Profile", color: "#F8FAFC" },
  { icon: "notifications-outline" as const, label: "Notifications", color: "#F8FAFC" },
  { icon: "moon-outline" as const, label: "Appearance", color: "#F8FAFC" },
  { icon: "shield-checkmark-outline" as const, label: "Privacy", color: "#F8FAFC" },
  { icon: "help-circle-outline" as const, label: "Help & Support", color: "#F8FAFC" },
  { icon: "log-out-outline" as const, label: "Sign Out", color: "#EF4444" },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A1A" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 24,
          }}
        >
          Profile
        </Text>

        {/* Avatar + name */}
        <View
          style={{
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: "rgba(0,214,143,0.15)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              borderWidth: 2,
              borderColor: "rgba(0,214,143,0.3)",
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#00D68F" }}>
              K
            </Text>
          </View>
          <Text
            style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "700" }}
          >
            Kinextion User
          </Text>
          <Text style={{ color: "#64748B", fontSize: 13, marginTop: 2 }}>
            Member since 2026
          </Text>
        </View>

        {/* Stats row */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 32,
          }}
        >
          {[
            { value: "0", label: "Day Streak" },
            { value: "--", label: "Avg Score" },
            { value: "0", label: "Habits" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#00D68F",
                  fontSize: 22,
                  fontWeight: "800",
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Settings list */}
        {settingsItems.map((item, i) => (
          <Pressable
            key={item.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 16,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: "rgba(255,255,255,0.05)",
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={item.color}
              style={{ marginRight: 14 }}
            />
            <Text
              style={{
                color: item.color,
                fontSize: 15,
                fontWeight: "500",
                flex: 1,
              }}
            >
              {item.label}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </Pressable>
        ))}

        {/* Version */}
        <Text
          style={{
            color: "#334155",
            fontSize: 11,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Kinextion v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
