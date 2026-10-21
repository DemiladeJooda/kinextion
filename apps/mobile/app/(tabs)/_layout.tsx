import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";

import { color, space } from "../../theme";

/**
 * Tab bar.
 *
 * Translucent over the content on iOS so scrolled content shows through —
 * one of the small touches that makes an app feel native rather than framed.
 * Android falls back to a solid fill, where blur is expensive and inconsistent.
 */
export default function TabLayout() {
  const useBlur = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.green,
        tabBarInactiveTintColor: color.textFaint,
        tabBarStyle: {
          position: useBlur ? "absolute" : "relative",
          backgroundColor: useBlur ? "transparent" : color.surface,
          borderTopColor: color.border,
          borderTopWidth: 1,
          paddingTop: space.sm,
          height: Platform.OS === "ios" ? 88 : 68,
          elevation: 0,
        },
        tabBarBackground: useBlur
          ? () => (
              <BlurView
                intensity={40}
                tint="dark"
                style={{ flex: 1, backgroundColor: "rgba(14,21,36,0.72)" }}
              />
            )
          : undefined,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      {/* Hidden — exists only so "/(tabs)" has a route to resolve to; it
          immediately redirects into the Habits tab below. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="habits"
        options={{
          title: "Habits",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon name={focused ? "checkbox" : "checkbox-outline"} c={c} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Guides",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              c={c}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pocket"
        options={{
          title: "In Your Pocket",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon name={focused ? "cube" : "cube-outline"} c={c} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon name={focused ? "people" : "people-outline"} c={c} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color: c, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} c={c} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

/** Icon with an active-state dot underneath — a quieter cue than a pill. */
function TabIcon({
  name,
  c,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  /** Navigation hands tab colours over as ColorValue, not plain strings. */
  c: ColorValue;
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: "center", gap: 3 }}>
      <Ionicons name={name} size={22} color={c} />
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: focused ? c : "transparent",
        }}
      />
    </View>
  );
}
