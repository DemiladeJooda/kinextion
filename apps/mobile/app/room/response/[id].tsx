/**
 * One response, in landscape.
 *
 * Turning the phone sideways is the signal: you've stopped scrolling and
 * you're in a conversation. The screen locks to landscape while you're here
 * and restores portrait on the way out — including when the phone's own
 * rotation lock is on, which is why this is done explicitly rather than left
 * to the device.
 *
 * Your reaction is private and stays that way. There are no totals to show
 * until the week closes, so there's nothing here that could nudge you toward
 * the room's answer before you've formed your own.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  REACTION_VERDICTS,
  type CommentView,
  type PlaybackView,
  type ReactionVerdict,
} from "@kinextion/shared";

import { Button, Card, Field, Label, Txt } from "../../../components/ui";
import { useApi } from "../../../hooks/useApi";
import { color, radius, space, tint } from "../../../theme";

const VERDICT_LABEL: Record<ReactionVerdict, string> = {
  agree: "Agree",
  mixed: "Mixed",
  disagree: "Disagree",
};

export default function ResponseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();
  // One player for both kinds: expo-video plays audio files too, and its
  // native controls work the same either way.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  const [playback, setPlayback] = useState<PlaybackView | null>(null);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [reaction, setReaction] = useState<ReactionVerdict | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Landscape while listening; portrait is for navigating.
    void ScreenOrientation.unlockAsync().then(() =>
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
    );
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [play, thread] = await Promise.all([api.getResponsePlayback(id), api.listComments(id)]);
      setPlayback(play);
      setComments(thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this response.");
    }
  }, [api, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Swap the signed URL in once it arrives, then start playing.
  useEffect(() => {
    if (!playback) return;
    void player
      .replaceAsync({ uri: playback.url })
      .then(() => player.play())
      .catch(() => setError("This recording couldn't be played."));
  }, [playback, player]);

  async function react(verdict: ReactionVerdict) {
    if (!id) return;
    const previous = reaction;
    setReaction(verdict);
    void Haptics.selectionAsync();
    try {
      await api.reactToResponse(id, verdict);
    } catch (err) {
      setReaction(previous);
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  async function post() {
    if (!id || draft.trim().length === 0) return;
    setBusy(true);
    try {
      const created = await api.addComment(id, { body: draft.trim() });
      setComments((c) => [...c, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["left", "right"]}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 2, backgroundColor: "#000" }}>
          {playback ? (
            playback.kind === "video" ? (
              <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tint(color.purple, 0.18),
                }}
              >
                <Ionicons name="musical-notes" size={48} color={color.purple} />
                <Label c={color.text}>Audio response</Label>
                <VideoView
                  player={player}
                  style={{ width: "80%", height: 56, marginTop: space.lg }}
                  nativeControls
                />
              </View>
            )
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {error ? (
                <Txt variant="body" c={color.textMuted}>
                  {error}
                </Txt>
              ) : (
                <ActivityIndicator color={color.teal} />
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

        <ScrollView
          style={{ flex: 1, backgroundColor: color.bg }}
          contentContainerStyle={{ padding: space.lg }}
        >
          <Label>What do you make of it?</Label>
          <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.sm }}>
            {REACTION_VERDICTS.map((verdict) => (
              <Pressable
                key={verdict}
                onPress={() => react(verdict)}
                style={{
                  flex: 1,
                  paddingVertical: space.sm,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: reaction === verdict ? color.green : color.border,
                  backgroundColor: reaction === verdict ? tint(color.green, 0.16) : "transparent",
                }}
              >
                <Txt variant="small" c={reaction === verdict ? color.green : color.textMuted}>
                  {VERDICT_LABEL[verdict]}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
            Private until the week closes — nobody sees the totals, including you.
          </Txt>

          <Label c={color.textFaint}>Comments</Label>
          {comments.map((comment) => (
            <Card key={comment.id} style={{ marginBottom: space.xs }} padded={false}>
              <View style={{ padding: space.sm }}>
                <Txt variant="small" c={color.textMuted}>
                  {comment.author.displayName ?? "A member"}
                </Txt>
                <Txt variant="body">{comment.body ?? "comment deleted"}</Txt>
              </View>
            </Card>
          ))}

          <Field
            label="Say something"
            value={draft}
            onChangeText={setDraft}
            placeholder="Reply to them"
            multiline
          />
          <Button label="Post" onPress={post} loading={busy} disabled={draft.trim().length === 0} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
