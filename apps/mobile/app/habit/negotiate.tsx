/**
 * Working out a new habit with Althea, any time after onboarding. It starts
 * from what she already knows: what they came for and why it matters.
 */

import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { FOCUS_AREAS, habitFromProposal, type HabitProposal, type HelpStyleId, type Understanding } from "@kinextion/shared";

import { AuroraBackdrop } from "../../components/ui";
import { HabitNegotiation } from "../../components/onboarding/HabitNegotiation";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { color } from "../../theme";

export default function NegotiateHabitScreen() {
  const api = useApi();
  const router = useRouter();
  const { addHabits } = useAppState();
  const [name, setName] = useState<string | null>(null);
  const [known, setKnown] = useState<Partial<Understanding>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getMyProfile()
      .then((u) => {
        const understanding = u.profile?.aiContext?.understanding;
        setKnown(understanding ?? {});
        setName(u.profile?.displayName ?? "");
      })
      .catch(() => setName(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = async (proposal: HabitProposal) => {
    setSaving(true);
    try {
      await addHabits([habitFromProposal(proposal, known.coreWhy, FOCUS_AREAS.find((a) => a.label === known.area)?.category ?? "physical")]);
    } finally {
      setSaving(false);
      router.back();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen options={{ title: "With Althea", headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false, headerTintColor: color.text, headerBackTitle: "Back" }} />
      <AuroraBackdrop accent={color.green} />
      {name === null ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={color.green} />
        </View>
      ) : (
        <HabitNegotiation
          name={name}
          area={known.area ?? "Building a new habit"}
          specifics={known.specifics ?? []}
          routine={known.routine}
          obstacles={known.obstacles ?? []}
          helpStyle={known.helpStyle as HelpStyleId | undefined}
          coreWhy={known.coreWhy}
          submitting={saving}
          onCommit={(p) => void commit(p)}
          onSkip={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}
