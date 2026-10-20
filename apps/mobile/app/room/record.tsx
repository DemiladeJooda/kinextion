/**
 * Add your voice.
 *
 * Deliberately not an editor. Point, talk, listen back, send — the product
 * message is "say what you think", so there are no effects, no trimming and
 * no filters to hide behind. Two minutes is the floor; five to fifteen is the
 * shape we ask for, shown as encouragement rather than enforced.
 *
 * Audio is a first-class choice, not a downgrade, and it's the one we can
 * meter: the recorder reports how much of the take was audible, which is what
 * lets the server refuse a silent upload without ever downloading it.
 */

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
// SDK 54 moved getInfoAsync to /legacy.
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import {
  ENCOURAGED_RESPONSE_SECONDS,
  MAX_RESPONSE_SECONDS,
  MIN_RESPONSE_SECONDS as REAL_MIN_RESPONSE_SECONDS,
} from "@kinextion/shared";
import { DEMO_MODE } from "../../lib/auth";

/** A demo shouldn't need two minutes of talking on stage. */
const MIN_RESPONSE_SECONDS = DEMO_MODE ? 10 : REAL_MIN_RESPONSE_SECONDS;

import {
  AuroraBackdrop,
  BackButton,
  Button,
  Card,
  Chip,
  Label,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type { LocalRecording } from "../../services";
import { color, radius, space, tint } from "../../theme";

type Stage = "choose" | "recording" | "review" | "sending";

/** Below this metering level (dBFS) we treat a moment as silence. */
const SILENCE_DB = -45;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function RecordScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const api = useApi();
  const router = useRouter();

  const [kind, setKind] = useState<"video" | "audio">("video");
  const [stage, setStage] = useState<Stage>("choose");
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<LocalRecording | null>(null);
  const [makePublic, setMakePublic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReadyRef = useRef<(() => void) | null>(null);
  // Released by the hook when the screen unmounts.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recordingAudioRef = useRef(false);
  const meterRef = useRef<{ total: number; loud: number }>({
    total: 0,
    loud: 0,
  });
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * The take's length, read when it ends. A ref rather than the `elapsed`
   * state: `begin` is still suspended in `recordAsync` when a video take
   * finishes, so the state it closed over is the 0 it started with — which
   * would measure every video as zero seconds and refuse it as too short.
   */
  const elapsedRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meterTimerRef.current) clearInterval(meterTimerRef.current);
      // Leaving mid-take shouldn't leave the microphone held open.
      if (recordingAudioRef.current) void recorder.stop().catch(() => {});
    };
  }, [recorder]);

  function startTimer() {
    elapsedRef.current = 0;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopMetering() {
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
  }

  async function begin() {
    setError(null);
    try {
      if (kind === "video") {
        if (!cameraPermission?.granted && !(await requestCamera()).granted) return;
        if (!micPermission?.granted && !(await requestMic()).granted) return;
        // The camera only mounts once the stage flips, so the ref is empty
        // until it reports ready — recording before that silently no-ops.
        const ready = new Promise<void>((resolve) => {
          cameraReadyRef.current = resolve;
        });
        setStage("recording");
        await ready;
        startTimer();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Resolves when stopRecording() is called, or at the cap.
        const video = await cameraRef.current?.recordAsync({
          maxDuration: MAX_RESPONSE_SECONDS,
        });
        stopTimer();
        if (video?.uri) await review(video.uri, "video/mp4");
        else setStage("choose");
      } else {
        if (!(await requestRecordingPermissionsAsync()).granted) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        meterRef.current = { total: 0, loud: 0 };
        await recorder.prepareToRecordAsync();
        recorder.record();
        recordingAudioRef.current = true;
        // Sample the level four times a second; the ratio of loud samples is
        // what lets the server refuse a silent take without downloading it.
        meterTimerRef.current = setInterval(() => {
          const status = recorder.getStatus();
          if (!status.isRecording || status.metering === undefined) return;
          meterRef.current.total += 1;
          if (status.metering > SILENCE_DB) meterRef.current.loud += 1;
        }, 250);
        setStage("recording");
        startTimer();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      stopTimer();
      stopMetering();
      setStage("choose");
      setError(err instanceof Error ? err.message : "Couldn't start recording.");
    }
  }

  async function finish() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (kind === "video") {
      cameraRef.current?.stopRecording();
      return; // `begin` resumes when recordAsync resolves.
    }
    stopTimer();
    stopMetering();
    if (!recordingAudioRef.current) return;
    await recorder.stop();
    recordingAudioRef.current = false;
    // Hand the audio session back so playback isn't routed as a call.
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (recorder.uri) await review(recorder.uri, "audio/m4a");
  }

  async function review(uri: string, mimeType: string) {
    const info = await FileSystem.getInfoAsync(uri);
    const { total, loud } = meterRef.current;
    setRecording({
      uri,
      kind,
      mimeType,
      durationSec: elapsedRef.current,
      bytes: info.exists && "size" in info ? (info.size ?? 0) : 0,
      // Only audio takes are metered; video sends nothing rather than a guess.
      signalRatio: kind === "audio" && total > 0 ? loud / total : undefined,
    });
    setStage("review");
  }

  async function send() {
    if (!recording || !topicId) return;
    setStage("sending");
    setError(null);
    try {
      const mediaId = await api.uploadRecording(recording);
      await api.submitResponse(topicId, {
        mediaId,
        visibility: makePublic ? "public_after_close" : "community",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/room/${topicId}` as never);
    } catch (err) {
      setStage("review");
      setError(err instanceof Error ? err.message : "That didn't send.");
    }
  }

  const tooShort = elapsed < MIN_RESPONSE_SECONDS;
  const reviewTooShort = (recording?.durationSec ?? 0) < MIN_RESPONSE_SECONDS;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      {stage === "recording" && kind === "video" ? null : <AuroraBackdrop accent={color.teal} />}
      {stage === "recording" && kind === "video" ? (
        <View style={{ flex: 1 }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="front"
            mode="video"
            onCameraReady={() => {
              cameraReadyRef.current?.();
              cameraReadyRef.current = null;
            }}
          />
          <View
            style={{
              position: "absolute",
              top: space.xl,
              alignSelf: "center",
              alignItems: "center",
              paddingHorizontal: space.xl,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              backgroundColor: color.scrim,
            }}
          >
            <Txt variant="title" c={tooShort ? color.amber : color.green}>
              {clock(elapsed)}
            </Txt>
            <Label c={color.text}>
              {tooShort ? `${MIN_RESPONSE_SECONDS - elapsed}s to go` : "Long enough"}
            </Label>
          </View>
          <Pressable
            onPress={finish}
            style={{
              position: "absolute",
              bottom: space.xxl,
              alignSelf: "center",
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: color.red,
              borderWidth: 4,
              borderColor: "rgba(255,255,255,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="stop" size={26} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: space.xxxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {stage === "choose" ? <BackButton /> : null}
          <ScreenHeader title="Add your voice" subtitle="Say what you actually think." />

          {stage === "choose" ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  gap: space.sm,
                  marginBottom: space.lg,
                }}
              >
                <Chip
                  label="Video"
                  icon="videocam"
                  accent={color.teal}
                  selected={kind === "video"}
                  onPress={() => setKind("video")}
                />
                <Chip
                  label="Audio"
                  icon="mic"
                  accent={color.purple}
                  selected={kind === "audio"}
                  onPress={() => setKind("audio")}
                />
              </View>

              <Card>
                <Txt variant="heading">Before you start</Txt>
                <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
                  Talk for at least {REAL_MIN_RESPONSE_SECONDS / 60} minutes. Most real answers run{" "}
                  {ENCOURAGED_RESPONSE_SECONDS.min / 60}–{ENCOURAGED_RESPONSE_SECONDS.max / 60}{" "}
                  minutes. There&apos;s no editing — that&apos;s the point.
                </Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.md }}>
                  Your community hears this once you send it. Nothing becomes public while the week
                  is still running.
                </Txt>
              </Card>

              <Button
                label={kind === "video" ? "Start recording" : "Start talking"}
                icon={kind === "video" ? "videocam" : "mic"}
                accent={color.teal}
                style={{ marginTop: space.xl }}
                onPress={begin}
              />
            </>
          ) : null}

          {stage === "recording" && kind === "audio" ? (
            <Card accent={color.purple}>
              <Txt variant="display" c={tooShort ? color.amber : color.green}>
                {clock(elapsed)}
              </Txt>
              <Label>
                {tooShort ? `${MIN_RESPONSE_SECONDS - elapsed}s to go` : "Long enough — keep going"}
              </Label>
              <Button
                label="Finish"
                icon="stop"
                accent={color.red}
                style={{ marginTop: space.xl }}
                onPress={finish}
              />
            </Card>
          ) : null}

          {stage === "review" || stage === "sending" ? (
            <>
              <Card>
                <Label>Your take</Label>
                <Txt variant="title" style={{ marginTop: space.xs }}>
                  {clock(recording?.durationSec ?? 0)}
                </Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.xs }}>
                  {kind === "video" ? "Video" : "Audio"} ·{" "}
                  {Math.max(1, Math.round((recording?.bytes ?? 0) / 1_000_000))} MB
                </Txt>
                {reviewTooShort ? (
                  <View
                    style={{
                      marginTop: space.md,
                      padding: space.sm,
                      borderRadius: radius.sm,
                      backgroundColor: tint(color.amber, 0.12),
                    }}
                  >
                    <Txt variant="small" c={color.amber}>
                      That&apos;s under {MIN_RESPONSE_SECONDS / 60} minutes. Record again and give
                      it a bit more.
                    </Txt>
                  </View>
                ) : null}
              </Card>

              <Card style={{ marginTop: space.md }}>
                <Txt variant="heading">Who can hear this?</Txt>
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.sm,
                    marginTop: space.md,
                  }}
                >
                  <Chip
                    label="Community only"
                    accent={color.teal}
                    selected={!makePublic}
                    onPress={() => setMakePublic(false)}
                  />
                  <Chip
                    label="Public after the week"
                    accent={color.blue}
                    selected={makePublic}
                    onPress={() => setMakePublic(true)}
                  />
                </View>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: space.md }}>
                  {makePublic
                    ? "Stays inside your community this week, then appears on Discover for 30 days."
                    : "Only your circle hears it, and it's deleted when the week closes."}
                </Txt>
              </Card>

              {error ? (
                <Txt variant="small" c={color.amber} style={{ marginTop: space.md }}>
                  {error}
                </Txt>
              ) : null}

              <Button
                label={stage === "sending" ? "Sending…" : "Share with your community"}
                icon="send"
                accent={color.green}
                loading={stage === "sending"}
                disabled={stage === "sending" || reviewTooShort}
                style={{ marginTop: space.xl }}
                onPress={send}
              />
              <Button
                label="Record it again"
                variant="ghost"
                style={{ marginTop: space.sm }}
                onPress={() => {
                  if (stage === "sending") return;
                  Alert.alert("Start over?", "Your current take will be discarded.", [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Record again",
                      style: "destructive",
                      onPress: () => {
                        setRecording(null);
                        setStage("choose");
                      },
                    },
                  ]);
                }}
              />
            </>
          ) : null}

          {error && stage === "choose" ? (
            <Txt variant="small" c={color.amber} style={{ marginTop: space.md }}>
              {error}
            </Txt>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
