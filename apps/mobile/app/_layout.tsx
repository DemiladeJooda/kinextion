import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0A1A" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding/index"
          options={{ animation: "fade" }}
        />
        <Stack.Screen
          name="chat/[persona]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: "#0F172A" },
            headerTintColor: "#F8FAFC",
            headerBackTitle: "Back",
          }}
        />
      </Stack>
    </>
  );
}
