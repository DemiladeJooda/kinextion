import { Redirect } from "expo-router";

/**
 * This group's default route (what `router.replace("/(tabs)")` lands on).
 * Hidden from the tab bar via `href: null` in the layout. Habits is the
 * product's core loop, so it's the screen the app opens on.
 */
export default function TabsIndexRedirect() {
  return <Redirect href="/(tabs)/habits" />;
}
