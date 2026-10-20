import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { AuroraBackdrop, Button, Card, SectionTitle, Txt } from "../../../components/ui";
import { useApi } from "../../../hooks/useApi";
import type { TherapistReport, TherapistReportSummary } from "../../../services";
import { color, space } from "../../../theme";

export default function TherapistReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [report, setReport] = useState<TherapistReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getTherapistReport(id)
      .then(setReport)
      .catch(() => setError("Couldn't load this report."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onShare = async () => {
    if (!report) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({ message: formatReportAsText(report.summary) });
    } catch {
      // User cancelled or the share sheet failed — nothing to recover from here.
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: "Report",
        headerStyle: { backgroundColor: color.bg },
        headerShadowVisible: false,
        headerTintColor: color.purple,
        headerTitleStyle: { color: color.text, fontWeight: "700" },
        headerBackTitle: "Back",
      }}
    />
  );

  if (error) {
    return (
      <>
        {header}
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: color.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt c={color.textMuted}>{error}</Txt>
        </SafeAreaView>
      </>
    );
  }

  if (!report) {
    return (
      <>
        {header}
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: color.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={color.purple} />
        </SafeAreaView>
      </>
    );
  }

  const s = report.summary;

  return (
    <>
      {header}
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
            {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
          </Txt>

          {s.habits ? (
            <>
              <SectionTitle accent={color.green}>Habits</SectionTitle>
              <Card>
                <Row label="Active habits" value={String(s.habits.total)} />
                <Row
                  label="Completion rate"
                  value={`${Math.round(s.habits.completionRate * 100)}%`}
                />
                <Row
                  label="Longest active streak"
                  value={`${s.habits.longestActiveStreak}d`}
                  last
                />
              </Card>
            </>
          ) : null}

          {s.moodTrends ? (
            <>
              <SectionTitle accent={color.purple}>Mood trends</SectionTitle>
              <Card>
                <Row label="Check-ins" value={String(s.moodTrends.entries)} />
                <Row label="Average mood" value={fmt1(s.moodTrends.averageMood)} />
                <Row label="Average energy" value={fmt1(s.moodTrends.averageEnergy)} />
                <Row
                  label="Average stress"
                  value={fmt1(s.moodTrends.averageStress)}
                  last={!s.moodTrends.commonTags.length}
                />
                {s.moodTrends.commonTags.length ? (
                  <Row label="Common tags" value={s.moodTrends.commonTags.join(", ")} last />
                ) : null}
              </Card>
            </>
          ) : null}

          {s.journalExcerpts?.length ? (
            <>
              <SectionTitle accent={color.amber}>Journal excerpts</SectionTitle>
              <View style={{ gap: space.sm }}>
                {s.journalExcerpts.map((e, i) => (
                  <Card key={i}>
                    <Txt variant="small" c={color.textFaint}>
                      {formatDate(e.date)}
                    </Txt>
                    {e.journal ? (
                      <Txt variant="body" style={{ marginTop: space.xs }}>
                        {e.journal}
                      </Txt>
                    ) : null}
                    {e.gratitude ? (
                      <Txt variant="small" c={color.textMuted} style={{ marginTop: space.xs }}>
                        Grateful for: {e.gratitude}
                      </Txt>
                    ) : null}
                  </Card>
                ))}
              </View>
            </>
          ) : null}

          {s.patterns?.length ? (
            <>
              <SectionTitle accent={color.pink}>Patterns</SectionTitle>
              <Card>
                <View style={{ gap: space.md }}>
                  {s.patterns.map((p, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                      <Ionicons
                        name="analytics-outline"
                        size={16}
                        color={color.pink}
                        style={{ marginTop: 2 }}
                      />
                      <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                        {p}
                      </Txt>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}

          {s.score ? (
            <>
              <SectionTitle accent={color.teal}>Kinextion Score</SectionTitle>
              <Card>
                <Row
                  label="Average"
                  value={s.score.average === null ? "—" : String(Math.round(s.score.average))}
                />
                <Row label="Trend" value={trendLabel(s.score.trend)} last />
              </Card>
            </>
          ) : null}

          <View style={{ marginTop: space.xl }}>
            <Button
              label="Share report"
              icon="share-outline"
              onPress={() => void onShare()}
              accent={color.purple}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: space.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.border,
      }}
    >
      <Txt variant="small" c={color.textMuted}>
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

function fmt1(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}

function trendLabel(t: "up" | "down" | "flat" | "not_enough_data"): string {
  if (t === "up") return "Trending up";
  if (t === "down") return "Trending down";
  if (t === "flat") return "Holding steady";
  return "Not enough data yet";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReportAsText(s: TherapistReportSummary): string {
  const lines: string[] = [
    `Kinextion Therapist Starter Pack`,
    `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`,
    "",
  ];

  if (s.habits) {
    lines.push(
      "HABITS",
      `Active habits: ${s.habits.total}`,
      `Completion rate: ${Math.round(s.habits.completionRate * 100)}%`,
      `Longest active streak: ${s.habits.longestActiveStreak} days`,
      ""
    );
  }

  if (s.moodTrends) {
    lines.push(
      "MOOD TRENDS",
      `Check-ins: ${s.moodTrends.entries}`,
      `Average mood: ${fmt1(s.moodTrends.averageMood)}/10`,
      `Average energy: ${fmt1(s.moodTrends.averageEnergy)}/10`,
      `Average stress: ${fmt1(s.moodTrends.averageStress)}/10`,
      s.moodTrends.commonTags.length ? `Common tags: ${s.moodTrends.commonTags.join(", ")}` : "",
      ""
    );
  }

  if (s.journalExcerpts?.length) {
    lines.push("JOURNAL EXCERPTS");
    for (const e of s.journalExcerpts) {
      lines.push(`${formatDate(e.date)}:`);
      if (e.journal) lines.push(e.journal);
      if (e.gratitude) lines.push(`Grateful for: ${e.gratitude}`);
      lines.push("");
    }
  }

  if (s.patterns?.length) {
    lines.push("PATTERNS", ...s.patterns.map((p) => `- ${p}`), "");
  }

  if (s.score) {
    lines.push(
      "KINEXTION SCORE",
      `Average: ${s.score.average === null ? "—" : Math.round(s.score.average)}`,
      `Trend: ${trendLabel(s.score.trend)}`,
      ""
    );
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
