import { useCallback, useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  AuroraBackdrop,
  Card,
  EmptyState,
  PressCard,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type {
  TherapistCategories,
  TherapistConsent,
  TherapistReportListItem,
} from "../../services";
import { color, radius, space, tint } from "../../theme";

const CATEGORIES: ReadonlyArray<{
  key: keyof TherapistCategories;
  label: string;
  detail: string;
}> = [
  {
    key: "habits",
    label: "Habits",
    detail: "Completion rate and active streaks",
  },
  {
    key: "moodTrends",
    label: "Mood trends",
    detail: "Average mood, energy, stress — numbers only",
  },
  {
    key: "journalExcerpts",
    label: "Journal excerpts",
    detail: "The actual text you wrote — off by default",
  },
  {
    key: "patterns",
    label: "Patterns",
    detail: "Computed correlations Kinextion has noticed",
  },
  {
    key: "score",
    label: "Kinextion Score",
    detail: "Average and trend over the period",
  },
];

const EMPTY: TherapistCategories = {
  habits: false,
  moodTrends: false,
  journalExcerpts: false,
  patterns: false,
  score: false,
};

export default function TherapistScreen() {
  const router = useRouter();
  const api = useApi();
  const [consent, setConsent] = useState<TherapistConsent | null>(null);
  const [reports, setReports] = useState<TherapistReportListItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([api.getTherapistConsent(), api.listTherapistReports()]);
      setConsent(c);
      setReports(r);
    } catch {
      setError("Couldn't load this right now.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = consent?.categories ?? EMPTY;
  const anyOn = Object.values(categories).some(Boolean);

  const onToggle = async (key: keyof TherapistCategories, value: boolean) => {
    void Haptics.selectionAsync();
    const next = { ...categories, [key]: value };
    setConsent((c) =>
      c ? { ...c, categories: next, active: Object.values(next).some(Boolean) } : c
    );
    try {
      await api.updateTherapistConsent(next);
    } catch {
      setError("Couldn't save that change. Try again.");
      void refresh();
    }
  };

  const onRevoke = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const result = await api.revokeTherapistConsent();
      setConsent((c) => (c ? { ...c, ...result } : c));
    } catch {
      setError("Couldn't turn this off. Try again.");
    }
  };

  const onGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const report = await api.generateTherapistReport(30);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/therapist/report/${report.id}` as never);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Therapist Starter Pack",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.purple,
          headerTitleStyle: { color: color.text, fontWeight: "700" },
          headerBackTitle: "Profile",
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        <AuroraBackdrop accent={color.purple} />
        <ScrollView
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: space.xxxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Txt variant="small" c={color.textMuted} style={{ marginBottom: space.lg }}>
            We don't provide therapists — this builds a summary for the one you already have.
          </Txt>

          <Card accent={color.purple}>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <Ionicons name="information-circle-outline" size={18} color={color.purple} />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                Nothing is shared automatically. Turn on what you want included, generate a report,
                then send it yourself — Kinextion never contacts anyone on your behalf.
              </Txt>
            </View>
          </Card>

          <SectionTitle accent={color.purple}>What to include</SectionTitle>
          <Card padded={false} style={{ paddingVertical: space.xs }}>
            {CATEGORIES.map((c, i) => (
              <View
                key={c.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: color.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{c.label}</Txt>
                  <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
                    {c.detail}
                  </Txt>
                </View>
                <Switch
                  value={categories[c.key]}
                  onValueChange={(v) => void onToggle(c.key, v)}
                  trackColor={{
                    false: "rgba(255,255,255,0.08)",
                    true: tint(color.purple, 0.45),
                  }}
                  thumbColor={categories[c.key] ? color.purple : "#64748B"}
                />
              </View>
            ))}
          </Card>

          {error ? (
            <Txt variant="small" c={color.red} style={{ marginTop: space.sm }}>
              {error}
            </Txt>
          ) : null}

          <View style={{ marginTop: space.xl, gap: space.md }}>
            <PressCard
              onPress={() => void onGenerate()}
              disabled={!anyOn || generating}
              accent={color.purple}
              style={{ padding: space.lg, alignItems: "center" }}
            >
              <Txt variant="bodyStrong" c={anyOn ? color.purple : color.textFaint}>
                {generating ? "Generating…" : "Generate a report"}
              </Txt>
            </PressCard>

            {consent?.active ? (
              <PressCard
                onPress={() => void onRevoke()}
                accent={color.textFaint}
                style={{
                  padding: space.md,
                  alignItems: "center",
                  shadowOpacity: 0,
                  elevation: 0,
                }}
              >
                <Txt variant="small" c={color.textMuted}>
                  Turn off sharing entirely
                </Txt>
              </PressCard>
            ) : null}
          </View>

          <SectionTitle>Past reports</SectionTitle>
          {reports.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No reports yet"
              body="Turn on at least one category above, then generate your first report."
              accent={color.purple}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {reports.map((r) => (
                <PressCard
                  key={r.id}
                  onPress={() => router.push(`/therapist/report/${r.id}` as never)}
                  style={{ padding: space.lg }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">
                        {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                      </Txt>
                      <Txt variant="label" c={color.textFaint} style={{ marginTop: 2 }}>
                        Generated {formatDate(r.createdAt)}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
                  </View>
                </PressCard>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
