/**
 * A community's page.
 *
 * The community is the identity unit in this product, so this is the richer
 * profile — while a person's stays deliberately thin. What lasts here is the
 * history: where each week's room landed, and how the community's answer to a
 * returning question has moved.
 */

import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import type { CommunityDetail, CommunityGoalView, CommunityHistoryView } from "@kinextion/shared";
import { Ionicons } from "@expo/vector-icons";

import {
  AuroraBackdrop,
  BackButton,
  SkeletonCard,
  Card,
  EmptyState,
  Label,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { color, space } from "../../theme";

function ResultBar({ agree, mixed, disagree }: { agree: number; mixed: number; disagree: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        height: 8,
        borderRadius: 4,
        overflow: "hidden",
        marginTop: space.sm,
      }}
    >
      <View style={{ flex: Math.max(agree, 0.01), backgroundColor: color.green }} />
      <View style={{ flex: Math.max(mixed, 0.01), backgroundColor: color.blue }} />
      <View
        style={{
          flex: Math.max(disagree, 0.01),
          backgroundColor: color.purple,
        }}
      />
    </View>
  );
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [history, setHistory] = useState<CommunityHistoryView | null>(null);
  const [goal, setGoal] = useState<CommunityGoalView | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [d, h, g] = await Promise.all([
      api.getCommunity(id).catch(() => null),
      api.getCommunityHistory(id).catch(() => null),
      api.getCommunityGoal(id).catch(() => null),
    ]);
    setDetail(d);
    setHistory(h);
    setGoal(g);
    setLoaded(true);
  }, [api, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const community = detail?.community;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <BackButton label="Community" />
        <ScreenHeader
          title={community?.name ?? "Community"}
          subtitle={
            community
              ? `${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}${
                  community.status === "forming" && community.foundersNeeded
                    ? ` · ${community.foundersNeeded} more founders needed`
                    : ""
                }`
              : undefined
          }
        />

        {community?.description ? (
          <Card>
            <Txt variant="body" c={color.textMuted}>
              {community.description}
            </Txt>
          </Card>
        ) : null}

        {goal ? (
          <>
            <SectionTitle accent={color.amber}>The goal</SectionTitle>
            <Card accent={goal.achievedAt ? color.green : color.amber}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Ionicons
                  name={goal.achievedAt ? "trophy" : "flag-outline"}
                  size={18}
                  color={goal.achievedAt ? color.green : color.amber}
                />
                <Txt variant="bodyStrong" style={{ flex: 1 }}>
                  {goal.title}
                </Txt>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 4,
                  marginTop: space.lg,
                }}
              >
                {Array.from({ length: goal.targetWeeks }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        i < goal.progressWeeks
                          ? goal.achievedAt
                            ? color.green
                            : color.amber
                          : "rgba(255,255,255,0.07)",
                    }}
                  />
                ))}
              </View>

              <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
                {goal.achievedAt
                  ? `Achieved — the community earned: ${goal.rewardLabel}`
                  : `${goal.progressWeeks} of ${goal.targetWeeks} weeks together. Win: ${goal.rewardLabel}`}
              </Txt>
              {goal.achievedAt ? (
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.xs }}>
                  A steward will be in touch about redeeming it — nothing is issued automatically.
                </Txt>
              ) : null}
            </Card>
          </>
        ) : null}

        {history && history.recurring.length > 0 ? (
          <>
            <SectionTitle>Questions you&apos;ve come back to</SectionTitle>
            {history.recurring.map((group) => (
              <Card key={group.topicKey} style={{ marginBottom: space.sm }}>
                <Txt variant="body">{group.text}</Txt>
                {group.results.map((result) => (
                  <View key={result.weekKey} style={{ marginTop: space.md }}>
                    <Label>
                      {new Date(result.closedAt).toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })}
                    </Label>
                    <ResultBar
                      agree={result.agreePct}
                      mixed={result.mixedPct}
                      disagree={result.disagreePct}
                    />
                    <Txt variant="small" c={color.textFaint} style={{ marginTop: space.xs }}>
                      {result.agreePct}% agree · {result.mixedPct}% mixed · {result.disagreePct}%
                      disagree
                    </Txt>
                  </View>
                ))}
              </Card>
            ))}
          </>
        ) : null}

        <SectionTitle>Where the rooms landed</SectionTitle>
        {!loaded ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : !history || history.results.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No weeks closed yet"
            body="When one does, what the community thought stays here — the recordings don't."
          />
        ) : (
          history.results.map((result) => (
            <Card
              key={`${result.weekKey}-${result.topic.topicKey}`}
              style={{ marginBottom: space.sm }}
            >
              <Txt variant="body">{result.topic.text}</Txt>
              <Label>{result.weekKey}</Label>
              <ResultBar
                agree={result.agreePct}
                mixed={result.mixedPct}
                disagree={result.disagreePct}
              />
              <Txt variant="small" c={color.textFaint} style={{ marginTop: space.xs }}>
                {result.agreePct}% agree · {result.mixedPct}% mixed · {result.disagreePct}% disagree
                · {result.voices} {result.voices === 1 ? "voice" : "voices"}
              </Txt>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
