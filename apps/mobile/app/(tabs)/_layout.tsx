import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const AURORA_GREEN = "#00D68F";
const SLATE_500 = "#64748B";
const MIDNIGHT = "#0F172A";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AURORA_GREEN,
        tabBarInactiveTintColor: SLATE_500,
        tabBarStyle: {
          backgroundColor: MIDNIGHT,
          borderTopColor: "rgba(255,255,255,0.05)",
          borderTopWidth: 1,
          paddingTop: 4,
          height: 85,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: "Habits",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Guides",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
