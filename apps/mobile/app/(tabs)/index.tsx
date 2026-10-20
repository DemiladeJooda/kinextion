import { Redirect } from "expo-router";

/**
 * This group's default route (what `router.replace("/(tabs)")` lands on).
 * Hidden from the tab bar via `href: null` in the layout — the Guides tab is
 * the real first screen now, this just forwards there.
 */
export default function TabsIndexRedirect() {
  return <Redirect href="/(tabs)/chat" />;
}
