import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppStateProvider } from "../lib/store";
import { color } from "../theme";

export default function RootLayout() {
  return (
    // GestureHandlerRootView must wrap the whole tree for Reanimated gestures
    // and the swipe-back stack transitions to work on Android.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding/index" options={{ animation: "fade" }} />
          <Stack.Screen
            name="chat/[persona]"
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: color.surface },
              headerTintColor: color.text,
              headerBackTitle: "Back",
            }}
          />
          {/* Feature screens set their own header options per screen. */}
          <Stack.Screen name="features/referee" options={{ headerShown: true }} />
          <Stack.Screen name="features/form" options={{ headerShown: true }} />
          <Stack.Screen name="features/environment" options={{ headerShown: true }} />
        </Stack>
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
