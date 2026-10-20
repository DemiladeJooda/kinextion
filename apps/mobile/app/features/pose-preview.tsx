/**
 * Live Pose Preview — beta.
 *
 * A real-time skeleton overlay on the camera feed, via PoseTracker
 * (posetracker.com). Two modes, same screen:
 *
 *   - No EXPO_PUBLIC_POSETRACKER_API_KEY set: "keypoints-only" — free,
 *     offline, no account needed. Shows the live skeleton and how many
 *     keypoints are tracked. This is what's running by default.
 *   - A free-tier key set: "full-engine" — adds rep counting and a form
 *     score against PoseTracker's reference movement for the exercise
 *     (started below as "squat" to prove the idea on one movement).
 *
 * This is deliberately separate from Form Control (features/form.tsx), which
 * asks Claude to read single frames and explain what it sees — a different,
 * already-shipped approach. This screen is the live-tracking half of what
 * was asked for (an AR-style overlay); body-scan-to-avatar is a separate,
 * unscoped problem — see memory project_nearby_discovery_feature-adjacent
 * notes from this session for why.
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import {
  PoseTrackerProvider,
  WebViewPoseView,
  usePoseTracker,
} from "@pose-tracker/react-native-pose-estimation";

import { Badge, Button, Card, Label, Txt } from "../../components/ui";
import { color, radius, space, tint } from "../../theme";

const API_KEY = process.env.EXPO_PUBLIC_POSETRACKER_API_KEY || undefined;

export default function PosePreviewScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Live Pose Preview",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.teal,
          headerTitleStyle: { color: color.text, fontWeight: "700" },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        <View style={{ padding: space.xl, paddingBottom: 0 }}>
          <Badge label="Beta" accent={color.teal} />
          <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
            {API_KEY
              ? "Full tracking — reps and form score against a reference squat."
              : "Keypoints only. Add a free PoseTracker key in apps/mobile/.env to unlock rep counting and form scoring."}
          </Txt>
        </View>

        {!permission?.granted ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl }}>
            <Ionicons name="videocam-off-outline" size={30} color={color.textFaint} />
            <Txt variant="body" c={color.textMuted} style={{ marginTop: space.md, textAlign: "center" }}>
              Camera access is needed for the live preview.
            </Txt>
            <Button
              label="Allow camera"
              onPress={() => void requestPermission()}
              variant="secondary"
              accent={color.teal}
              style={{ marginTop: space.lg }}
            />
          </View>
        ) : (
          <PoseTrackerProvider apiToken={API_KEY}>
            <PosePreview />
          </PoseTrackerProvider>
        )}
      </SafeAreaView>
    </>
  );
}

function PosePreview() {
  const [keypointCount, setKeypointCount] = useState<number | null>(null);
  const [poseScore, setPoseScore] = useState<number | null>(null);
  const [reps, setReps] = useState(0);
  const [formGrade, setFormGrade] = useState<string | null>(null);
  const [formAverage, setFormAverage] = useState<number | null>(null);
  const [started, setStarted] = useState(false);

  const { mode, status, startExercise } = usePoseTracker({
    onKeypoints: (e) => {
      setKeypointCount(e.keypoints.length);
      setPoseScore(Math.round(e.score * 100));
    },
    onCounter: (e) => {
      setReps(e.count);
      if (e.formScore) {
        setFormGrade(e.formScore.grade);
        setFormAverage(Math.round(e.formScore.average));
      }
    },
  });

  const canTrackExercise = mode === "full-engine" && status === "ready";

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, margin: space.xl, borderRadius: radius.lg, overflow: "hidden" }}>
        <WebViewPoseView style={StyleSheet.absoluteFill} drawSkeleton loadingText="Loading pose model…" />
      </View>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md }}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Metric label="Keypoints" value={keypointCount === null ? "—" : String(keypointCount)} accent={color.teal} />
          <Metric label="Confidence" value={poseScore === null ? "—" : `${poseScore}%`} accent={color.blue} />
          {mode === "full-engine" ? (
            <Metric label="Reps" value={String(reps)} accent={color.amber} />
          ) : null}
        </View>

        {mode === "full-engine" ? (
          <Card accent={color.purple}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Label c={color.purple}>Squat — form vs. reference</Label>
                <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                  {formGrade
                    ? `Grade ${formGrade} · ${formAverage}% average`
                    : started
                      ? "Get in frame and start squatting."
                      : "Start tracking to compare against PoseTracker's reference squat."}
                </Txt>
              </View>
            </View>
            {!started ? (
              <Button
                label="Start tracking squat"
                icon="play"
                accent={color.purple}
                disabled={!canTrackExercise}
                style={{ marginTop: space.md }}
                onPress={() => {
                  startExercise("squat");
                  setStarted(true);
                }}
              />
            ) : null}
          </Card>
        ) : (
          <View
            style={{
              padding: space.lg,
              borderRadius: radius.md,
              backgroundColor: tint(color.textFaint, 0.06),
            }}
          >
            <Txt variant="small" c={color.textFaint}>
              Rep counting and form scoring against a reference position need a PoseTracker API
              key — sign up free at posetracker.com, then add it to apps/mobile/.env.
            </Txt>
          </View>
        )}
      </View>
    </View>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint(accent, 0.07),
        borderWidth: 1,
        borderColor: tint(accent, 0.16),
        borderRadius: radius.md,
        paddingVertical: space.md,
        alignItems: "center",
      }}
    >
      <Txt variant="heading" c={accent}>
        {value}
      </Txt>
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
        {label}
      </Txt>
    </View>
  );
}
