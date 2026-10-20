/**
 * Your week.
 *
 * One community, one question, one response. The screen's job is to show the
 * single next thing — choose where you're sitting, say what's on your mind,
 * vote, speak, or listen — and to make sitting the week out feel like a real
 * option rather than a failure state.
 */

import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { BallotView, CycleView, MyWeekView, WeekView } from "@kinextion/shared";

import {
  TAB_BAR_CLEARANCE,
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Label,
  PressCard,
  ScreenHeader,
  SectionTitle,
  SkeletonCard,
  Txt,
} from "../../components/ui";
import { CommunityDiscover } from "../../components/CommunityDiscover";
import { NearbyDiscover } from "../../components/NearbyDiscover";
import { useApi } from "../../hooks/useApi";
import { color, radius, space, tint } from "../../theme";

const STAGE_LABEL: Record<CycleView["stage"], string> = {
  scheduled: "Opens soon",
  gathering: "What's on your mind?",
  voting: "Choosing the question",
  open: "The room is open",
  closed: "Closed — results coming",
  settled: "Where the room landed",
};

const STAGE_COLOR: Record<CycleView["stage"], string> = {
  scheduled: color.textFaint,
  gathering: color.purple,
  voting: color.blue,
  open: color.teal,
  closed: color.amber,
  settled: color.green,
};

function StagePill({ stage }: { stage: CycleView["stage"] }) {
  const c = STAGE_COLOR[stage];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Label c={c}>{STAGE_LABEL[stage]}</Label>
    </View>
  );
}

function IconBubble({ icon, accent }: { icon: keyof typeof Ionicons.glyphMap; accent: string }) {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: tint(accent, 0.14),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={19} color={accent} />
    </View>
  );
}

function closesCopy(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommunityScreen() {
  const api = useApi();
  const router = useRouter();
  const [week, setWeek] = useState<MyWeekView | null>(null);
  const [ballots, setBallots] = useState<Record<string, BallotView>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [pendingAdmissions, setPendingAdmissions] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.getMyWeek();
      setWeek(data);
      const ids = [...data.current.cycles, ...data.next.cycles]
        .map((c) => c.ballotId)
        .filter((id): id is string => !!id);
      const loaded = await Promise.all(ids.map((id) => api.getBallot(id).catch(() => null)));
      setBallots(
        Object.fromEntries(loaded.filter((b): b is BallotView => !!b).map((b) => [b.id, b]))
      );
    } catch {
      setWeek(null);
    } finally {
      setLoading(false);
    }
    api
      .listMyAdmissionSeats()
      .then((seats) => setPendingAdmissions(seats.length))
      .catch(() => setPendingAdmissions(0));
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    setNote(null);
    try {
      await run();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNote(done);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const current = week?.current;
  const active = current?.cycles.find((c) => c.community.id === current.choice?.communityId);
  const activeBallot = active?.ballotId ? ballots[active.ballotId] : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={color.textFaint} />
        }
      >
        <ScreenHeader title="Community" subtitle="Your people, one question a week." />

        {pendingAdmissions > 0 ? (
          <PressCard
            accent={color.teal}
            onPress={() => router.push("/admissions" as never)}
            style={{ marginBottom: space.lg, padding: space.lg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Ionicons name="people-circle-outline" size={22} color={color.teal} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>
                {pendingAdmissions} admission decision{pendingAdmissions === 1 ? "" : "s"} waiting on
                you
              </Txt>
              <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
            </View>
          </PressCard>
        ) : null}

        {loading && !week ? (
          <>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
          </>
        ) : null}

        {!loading && (!week || current?.cycles.length === 0) ? (
          <EmptyState
            icon="people-outline"
            title={week ? "No community yet" : "Can't reach your communities"}
            body={
              week
                ? "Communities start with people who already know each other. Six of them have to agree it's real before it exists."
                : "Pull to try again."
            }
          />
        ) : null}

        {current && current.cycles.length > 0 ? (
          <>
            <SectionTitle>Where are you sitting?</SectionTitle>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: space.sm,
                marginBottom: space.lg,
              }}
            >
              {current.cycles.map((cycle) => (
                <Chip
                  key={cycle.id}
                  label={cycle.community.name}
                  selected={current.choice?.communityId === cycle.community.id}
                  accent={color.teal}
                  onPress={() =>
                    busy || current.choice?.locked
                      ? undefined
                      : act(
                          () => api.chooseActiveCommunity(current.weekKey, cycle.community.id),
                          `Sitting with ${cycle.community.name} this week.`
                        )
                  }
                />
              ))}
              <Chip
                label="Sit this one out"
                selected={current.choice?.communityId === null}
                onPress={() =>
                  busy || current.choice?.locked
                    ? undefined
                    : act(
                        () => api.chooseActiveCommunity(current.weekKey, null),
                        "Sitting this one out. Nothing counts against you."
                      )
                }
              />
            </View>
            {current.choice?.locked ? (
              <Label>You've spoken, so this week's community is set.</Label>
            ) : null}
            {note ? <Label c={color.teal}>{note}</Label> : null}

            {active?.stage === "gathering" ? (
              <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: space.lg }}>
                <Card accent={color.purple} style={{ gap: space.lg }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.md,
                    }}
                  >
                    <IconBubble icon="sparkles" accent={color.purple} />
                    <Txt variant="heading" style={{ flex: 1 }}>
                      What&apos;s been on your mind?
                    </Txt>
                  </View>
                  <Txt variant="body" c={color.textMuted}>
                    Private. Kairo turns what the room raises into four questions to vote on — never
                    with your name on it.
                  </Txt>
                  <Field
                    label="Your thought"
                    value={suggestion}
                    onChangeText={setSuggestion}
                    placeholder="Something you'd want to hear people talk about"
                    multiline
                    maxLength={280}
                    accent={color.purple}
                  />
                  <Button
                    label="Send to Kairo"
                    icon="paper-plane"
                    accent={color.purple}
                    loading={busy}
                    disabled={busy || suggestion.trim().length < 5}
                    onPress={() =>
                      act(async () => {
                        await api.suggestTopic(active.id, suggestion.trim());
                        setSuggestion("");
                      }, "Sent, privately.")
                    }
                  />
                </Card>
              </Animated.View>
            ) : null}

            {active?.stage === "voting" && activeBallot ? (
              <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: space.lg }}>
                <SectionTitle>Choose this week's question</SectionTitle>
                {activeBallot.options.map((option) => {
                  const mine = activeBallot.myVote === option.id;
                  return (
                    <PressCard
                      key={option.id}
                      accent={mine ? color.teal : undefined}
                      disabled={busy}
                      haptic="medium"
                      onPress={() =>
                        act(() => api.voteOnBallot(activeBallot.id, option.id), "Vote counted.")
                      }
                      style={{
                        marginBottom: space.sm,
                        borderColor: mine ? color.teal : color.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          gap: space.md,
                          alignItems: "flex-start",
                        }}
                      >
                        <Ionicons
                          name={mine ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={mine ? color.teal : color.textFaint}
                        />
                        <View style={{ flex: 1 }}>
                          <Txt variant="bodyStrong">{option.text}</Txt>
                          {option.rationale ? (
                            <Txt
                              variant="small"
                              c={color.textFaint}
                              style={{ marginTop: space.xs }}
                            >
                              {option.rationale}
                            </Txt>
                          ) : null}
                        </View>
                      </View>
                    </PressCard>
                  );
                })}
                <Label>Nobody sees the count — only which question opens on Monday.</Label>
              </Animated.View>
            ) : null}

            <SectionTitle style={{ marginTop: space.xl }}>This week</SectionTitle>
            {current.cycles.map((cycle, i) => (
              <Animated.View key={cycle.id} entering={FadeInDown.duration(320).delay(i * 60)}>
                <PressCard
                  accent={
                    cycle.community.id === current.choice?.communityId
                      ? STAGE_COLOR[cycle.stage]
                      : undefined
                  }
                  onPress={() =>
                    cycle.topic
                      ? router.push(`/room/${cycle.topic.id}` as never)
                      : router.push(`/group/${cycle.community.id}` as never)
                  }
                  style={{ marginBottom: space.sm }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.md,
                    }}
                  >
                    <IconBubble icon="people" accent={STAGE_COLOR[cycle.stage]} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading" numberOfLines={1}>
                        {cycle.community.name}
                      </Txt>
                      <StagePill stage={cycle.stage} />
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
                  </View>
                  {cycle.topic ? (
                    <Txt variant="body" style={{ marginTop: space.sm }}>
                      {cycle.topic.text}
                    </Txt>
                  ) : null}
                  {cycle.stage === "open" ? (
                    <View
                      style={{
                        marginTop: space.md,
                        padding: space.sm,
                        borderRadius: radius.sm,
                        backgroundColor: color.surfaceAlt,
                      }}
                    >
                      <Txt
                        variant="small"
                        c={cycle.you.response === "submitted" ? color.green : color.amber}
                      >
                        {cycle.you.response === "submitted"
                          ? `You've spoken — the room is open. Closes ${closesCopy(cycle.closesAt)}.`
                          : `Your community wants to hear from you. Closes ${closesCopy(cycle.closesAt)}.`}
                      </Txt>
                    </View>
                  ) : null}
                </PressCard>
              </Animated.View>
            ))}

            {week.next.cycles.length > 0 ? (
              <>
                <SectionTitle style={{ marginTop: space.xl }}>Next week</SectionTitle>
                {week.next.cycles.map((cycle) => (
                  <Card key={cycle.id} style={{ marginBottom: space.sm, opacity: 0.85 }}>
                    <Txt variant="heading">{cycle.community.name}</Txt>
                    <StagePill stage={cycle.stage} />
                  </Card>
                ))}
                <NextWeekChoice
                  week={week.next}
                  busy={busy}
                  onChoose={(communityId) =>
                    act(
                      () => api.chooseActiveCommunity(week.next.weekKey, communityId),
                      communityId ? "Set for next week." : "Sitting next week out."
                    )
                  }
                />
              </>
            ) : null}
          </>
        ) : null}

        <CommunityDiscover />
        <NearbyDiscover />
      </ScrollView>
    </SafeAreaView>
  );
}

function NextWeekChoice({
  week,
  busy,
  onChoose,
}: {
  week: WeekView;
  busy: boolean;
  onChoose: (communityId: string | null) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
        marginTop: space.sm,
      }}
    >
      {week.cycles.map((cycle) => (
        <Chip
          key={cycle.id}
          label={cycle.community.name}
          selected={week.choice?.communityId === cycle.community.id}
          accent={color.teal}
          onPress={() => (busy ? undefined : onChoose(cycle.community.id))}
        />
      ))}
      <Chip
        label="Sit it out"
        selected={week.choice?.communityId === null}
        onPress={() => (busy ? undefined : onChoose(null))}
      />
    </View>
  );
}
