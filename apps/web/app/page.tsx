import { TabLayout } from "@/components/navigation/TabLayout";

// Root route. The whole site is a single-page, tab-driven experience.
// All backgrounds (the dark "space" backdrop vs. the light backdrop) and
// section routing are handled inside TabLayout, since they depend on the
// currently-active tab.
export default function HomePage() {
  return (
    <main className="relative min-h-screen">
      <TabLayout />
    </main>
  );
}
