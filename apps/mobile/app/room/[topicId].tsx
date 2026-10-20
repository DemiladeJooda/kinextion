/**
 * The week's question: locked, open, or revealed.
 *
 * Locked is the important state. It says what to do and nothing about who has
 * already spoken — the whole point is that you answer before you're
 * influenced.
 */

import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CycleResultView, RoomView, TopicView } from "@kinextion/shared";

import {
  AuroraBackdrop,
  BackButton,
  SkeletonCard,
  Button,
  Card,
  EmptyState,
  Label,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { color, radius, space, tint } from "../../theme";

function minutes(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

export default function RoomScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const api = useApi();
  const router = useRouter();
  const [topic, setTopic] = useState<TopicView | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [result, setResult] = useState<CycleResultView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!topicId) return;
    try {
      const view = await api.getTopic(topicId);
      setTopic(view);
      setError(null);
      if (view.cycle.stage === "settled") {
        setResult(await api.getTopicResult(topicId).catch(() => null));
        setRoom(null);
      } else if (view.you.room === "open") {
        setRoom(await api.getRoom(topicId));
      } else {
        setRoom(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this.");
    }
  }, [api, topicId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <BackButton label="Community" />
        <ScreenHeader
          title={topic?.community.name ?? "This week"}
          subtitle={topic ? topic.text : undefined}
        />

        {!topic && !error ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard />
          </>
        ) : null}

        {error ? (
          <EmptyState icon="alert-circle-outline" title="Can't open this" body={error} />
        ) : null}

        {topic && topic.cycle.stage === "settled" ? (
          <Card accent={color.teal}>
            {result ? (
              <>
                <Txt variant="heading">{result.headline}</Txt>
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.sm,
                    marginTop: space.lg,
                  }}
                >
                  {[
                    { label: "Agree", value: result.agreePct, c: color.green },
                    { label: "Mixed", value: result.mixedPct, c: color.blue },
                    {
                      label: "Disagree",
                      value: result.disagreePct,
                      c: color.purple,
                    },
                  ].map((slice) => (
                    <View
                      key={slice.label}
                      style={{
                        flex: 1,
                        padding: space.md,
                        borderRadius: radius.md,
                        backgroundColor: tint(slice.c, 0.12),
                      }}
                    >
                      <Txt variant="title" c={slice.c}>
                        {slice.value}%
                      </Txt>
                      <Label>{slice.label}</Label>
                    </View>
                  ))}
                </View>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.lg }}>
                  {result.voices} {result.voices === 1 ? "member" : "members"} spoke ·{" "}
                  {result.comments} comments. The recordings are gone; this is what the community
                  keeps.
                </Txt>
              </>
            ) : (
              <Txt variant="body" c={color.textMuted}>
                Nobody spoke this week, so there&apos;s nothing to reveal.
              </Txt>
            )}
          </Card>
        ) : null}

        {topic && topic.cycle.stage !== "settled" && !room ? (
          <Card accent={color.amber}>
            <Txt variant="heading">Your community wants to hear from you.</Txt>
            {topic.you.choseElsewhere ? (
              <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
                You&apos;re sitting with a different community this week, so this room stays closed.
              </Txt>
            ) : (
              <>
                <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
                  Share your own answer first and the room opens. You hear what everyone else thinks
                  after you&apos;ve said what you think — not before.
                </Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.md }}>
                  Two minutes minimum. Five to fifteen is the shape of a real answer.
                </Txt>
                {topic.cycle.stage === "open" ? (
                  <>
                    <Button
                      label="Add your voice"
                      icon="mic"
                      accent={color.teal}
                      style={{ marginTop: space.lg }}
                      onPress={() => router.push(`/room/record?topicId=${topic.id}` as never)}
                    />
                    {/* Kairo can help you think it through — never write it for you. */}
                    <Button
                      label="Think it through with Kairo"
                      icon="chatbubble-ellipses-outline"
                      variant="ghost"
                      style={{ marginTop: space.sm }}
                      onPress={() => router.push(`/chat/kairo?topicId=${topic.id}` as never)}
                    />
                  </>
                ) : null}
              </>
            )}
          </Card>
        ) : null}

        {room ? (
          <>
            <Card>
              <Label>Your response</Label>
              <Txt variant="body" style={{ marginTop: space.xs }}>
                {minutes(room.mine.durationSec)} ·{" "}
                {room.mine.visibility === "public_after_close"
                  ? "Public after the week ends"
                  : "Community only"}
              </Txt>
            </Card>

            <SectionTitle>
              {room.circle.voices} {room.circle.voices === 1 ? "voice" : "voices"} from{" "}
              {room.community.name}
            </SectionTitle>

            {room.responses.length === 0 ? (
              <EmptyState
                icon="ear-outline"
                title="You're first"
                body="When others in your circle share theirs, they'll appear here."
              />
            ) : (
              room.responses.map((item) => (
                <PressCard
                  key={item.id}
                  onPress={() => router.push(`/room/response/${item.id}` as never)}
                  style={{ marginBottom: space.sm }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading">{item.speaker.displayName ?? "A member"}</Txt>
                      <Label>
                        {minutes(item.durationSec)} · {item.kind === "audio" ? "Audio" : "Video"}
                        {item.commentCount > 0 ? ` · ${item.commentCount} comments` : ""}
                        {item.myReaction ? ` · you said ${item.myReaction}` : ""}
                      </Label>
                    </View>
                    <Ionicons name="play-circle" size={28} color={color.teal} />
                  </View>
                </PressCard>
              ))
            )}
            <Label>Everyone hears this room in a different order. Nobody is first.</Label>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
