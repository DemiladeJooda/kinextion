import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEMO_MODE, useAuth } from "../lib/auth";

import { AppStateProvider } from "../lib/store";
import { HabitReminderSync } from "../components/HabitReminderSync";
import { tokenCache } from "../lib/clerk-token-cache";
import { useApi } from "../hooks/useApi";
import Animated, { FadeIn } from "react-native-reanimated";
import { AuroraBackdrop, BrandMark, Txt } from "../components/ui";
import { color, space } from "../theme";

const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!CLERK_PUBLISHABLE_KEY && !DEMO_MODE) {
  console.warn(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — sign-in will fail. See apps/mobile/.env.",
  );
}

/**
 * Redirects between the (auth) group, onboarding, and the tabs based on
 * sign-in state and whether the user has a completed profile. Runs once
 * Clerk has resolved a session; blocks nothing while it does.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const segments = useSegments();
  const router = useRouter();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setOnboarded(null);
      return;
    }
    let cancelled = false;
    api
      .getMyProfile()
      .then((user) => {
        if (!cancelled) setOnboarded(user.profile?.onboardingComplete ?? false);
      })
      .catch(() => {
        // Profile fetch failing shouldn't strand the user — treat as
        // not-yet-onboarded so onboarding can create it.
        if (!cancelled) setOnboarded(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in" as never);
      return;
    }

    if (onboarded === null) return; // still resolving profile

    const inOnboarding = segments[0] === "onboarding";

    if (!onboarded && !inOnboarding) {
      // Onboarding may have just finished — confirm with the server before
      // bouncing the user back to it.
      let cancelled = false;
      api
        .getMyProfile()
        .then((user) => {
          if (cancelled) return;
          if (user.profile?.onboardingComplete) setOnboarded(true);
          else router.replace("/onboarding" as never);
        })
        .catch(() => {
          if (!cancelled) router.replace("/onboarding" as never);
        });
      return () => {
        cancelled = true;
      };
    } else if (onboarded && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)" as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, onboarded, segments, router]);

  if (!isLoaded || (isSignedIn && onboarded === null)) {
    return <BootScreen />;
  }

  return <>{children}</>;
}

/** Shown while the session and profile resolve — the brand, not a black frame. */
function BootScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AuroraBackdrop accent={color.green} />
      <Animated.View
        entering={FadeIn.duration(400)}
        style={{ alignItems: "center", gap: space.lg }}
      >
        <BrandMark size={84} />
        <Txt variant="title">Kinextion</Txt>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  /**
   * The app is portrait everywhere except a community response, which locks
   * landscape while you listen and restores portrait on the way out. The
   * native config has to allow rotation for that to be possible at all, so the
   * default is pinned here rather than in app.json.
   */
  useEffect(() => {
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  }, []);

  return (
    <SessionProvider>
      {/* GestureHandlerRootView must wrap the whole tree for Reanimated gestures
            and the swipe-back stack transitions to work on Android. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppStateProvider>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.bg },
                animation: "slide_from_right",
                // Defaults for every screen that turns its header on.
                headerStyle: { backgroundColor: color.bg },
                headerTintColor: color.text,
                headerTitleStyle: { fontWeight: "700", fontSize: 17 },
                headerShadowVisible: false,
                headerBackTitle: "Back",
              }}
            >
              <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="onboarding/index"
                options={{ animation: "fade" }}
              />
              <Stack.Screen
                name="chat/[persona]"
                options={{ headerShown: true }}
              />
              {/* Feature screens set their own header options per screen. */}
              <Stack.Screen
                name="features/referee"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="features/form"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="features/environment"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="features/pose-preview"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="therapist/index"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="therapist/report/[id]"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="discover/map"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="discover/group/[id]"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="discover/response/[id]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="avatar/create"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="admissions/index"
                options={{ headerShown: true }}
              />
              {/* Habit builder and check-in set their own titles per screen. */}
              <Stack.Screen name="habit/new" options={{ headerShown: true }} />
              <Stack.Screen
                name="habit/suggest"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="habit/discover"
                options={{ headerShown: true }}
              />
              <Stack.Screen name="habit/[id]" options={{ headerShown: true }} />
              <Stack.Screen
                name="habit/starter"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="workout/log"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="recommendations/index"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="metrics/index"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="settings/edit"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="settings/notifications"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="settings/privacy"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="settings/habits"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="settings/about"
                options={{ headerShown: true }}
              />
              <Stack.Screen name="simulate" options={{ headerShown: true }} />
              <Stack.Screen
                name="settings/help"
                options={{ headerShown: true }}
              />
              <Stack.Screen
                name="checkin/index"
                options={{
                  headerShown: true,
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
            </Stack>
          </AuthGate>
          <HabitReminderSync />
          {DEMO_MODE ? <DemoBadge /> : null}
        </AppStateProvider>
      </GestureHandlerRootView>
    </SessionProvider>
  );
}

/** Clerk in real builds; nothing in demo mode, where sessions are faked. */
function SessionProvider({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}

/** Small, always-visible marker so nobody mistakes sample data for real users. */
function DemoBadge() {
  return (
    <SafeAreaView
      pointerEvents="none"
      edges={["top"]}
      style={{ position: "absolute", top: 0, right: space.md }}
    >
      <View
        style={{
          marginTop: 2,
          paddingHorizontal: space.sm,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: "rgba(245,158,11,0.16)",
          borderWidth: 1,
          borderColor: "rgba(245,158,11,0.4)",
        }}
      >
        <Txt variant="label" c={color.amber} style={{ fontSize: 9 }}>
          Demo
        </Txt>
      </View>
    </SafeAreaView>
  );
}
