/**
 * One Discover response — public, no reactions or comments (those are
 * community-only). Playing through "Up next" stays inside the same
 * conversation, same as the public web Discover page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import type { DiscoverResponseView } from "@kinextion/shared";

import { AuroraBackdrop, Label, PressCard, ScreenHeader, Txt } from "../../../components/ui";
import { useApi } from "../../../hooks/useApi";
import { color, radius, space, tint } from "../../../theme";

export default function DiscoverResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();
  const seed = useRef(Crypto.randomUUID());

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const [view, setView] = useState<DiscoverResponseView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setView(null);
    setError(null);
    try {
      const data = await api.getDiscoverResponse(id, seed.current);
      setView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this response.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!view) return;
    void player
      .replaceAsync({ uri: view.playback.url })
      .then(() => player.play())
      .catch(() => setError("This recording couldn't be played."));
  }, [view, player]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <AuroraBackdrop accent={color.purple} />
      <View
        style={{
          height: 280,
          margin: space.xl,
          marginBottom: 0,
          borderRadius: radius.lg,
          overflow: "hidden",
          backgroundColor: color.surfaceAlt,
        }}
      >
        {view ? (
          view.playback.kind === "video" ? (
            <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="musical-notes" size={40} color={color.purple} />
              <VideoView player={player} style={{ width: "80%", height: 56, marginTop: space.lg }} nativeControls />
            </View>
          )
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {error ? (
              <Txt variant="body" c={color.textMuted}>
                {error}
              </Txt>
            ) : (
              <ActivityIndicator color={color.purple} />
            )}
          </View>
        )}
        <Pressable
          onPress={() => router.back()}
          style={{
            position: "absolute",
            top: space.md,
            left: space.md,
            padding: space.sm,
            borderRadius: radius.pill,
            backgroundColor: color.scrim,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={color.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.xl }} showsVerticalScrollIndicator={false}>
        {view ? (
          <>
            <ScreenHeader title={view.topic.text} subtitle={view.community.name} />
            <Txt variant="small" c={color.textFaint}>
              {view.item.speaker.displayName ?? "A member"} · not affiliated outside their own
              community
            </Txt>

            {view.next.length > 0 ? (
              <View style={{ marginTop: space.xl }}>
                <Label c={color.purple}>Up next in this conversation</Label>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.md, marginTop: space.md }}
                >
                  {view.next.map((item) => (
                    <PressCard
                      key={item.id}
                      accent={color.purple}
                      onPress={() => router.replace(`/discover/response/${item.id}` as never)}
                      style={{ width: 140, padding: space.lg }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: radius.md,
                          backgroundColor: tint(color.purple, 0.14),
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: space.md,
                        }}
                      >
                        <Ionicons
                          name={item.kind === "video" ? "play" : "musical-notes"}
                          size={16}
                          color={color.purple}
                        />
                      </View>
                      <Txt variant="small" numberOfLines={1}>
                        {item.speaker.displayName ?? "A member"}
                      </Txt>
                    </PressCard>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
