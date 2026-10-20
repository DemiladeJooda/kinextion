/**
 * Form Control — point the phone at yourself and get live movement cues.
 *
 * Frames go to `/api/vision`, which scores each checkpoint out of ten and
 * returns the visual observation that earns the score. That pairing is the
 * whole feature: a 10 and a 3 have to be distinguishable by reading what was
 * seen, without looking at the number. A bare score nobody can argue with is
 * a score nobody can learn from.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { Badge, Button, Card, Chip, Label, Txt } from "../../components/ui";
import { analyseFrame, type FormCheckpoint, type FormResult } from "../../lib/vision";
import { ChatError } from "../../lib/api";
import { color, radius, space, tint } from "../../theme";

const EXERCISES = [
  {
    id: "squat",
    label: "Back squat",
    icon: "barbell-outline",
    watch: ["Knee tracking", "Depth", "Neutral spine"],
  },
  {
    id: "deadlift",
    label: "Deadlift",
    icon: "barbell-outline",
    watch: ["Lumbar position", "Bar path", "Lockout"],
  },
  {
    id: "pushup",
    label: "Push-up",
    icon: "body-outline",
    watch: ["Elbow angle", "Hip line", "Range"],
  },
  {
    id: "stretch",
    label: "Hamstring stretch",
    icon: "accessibility-outline",
    watch: ["Range of motion", "Back position", "Hold quality"],
  },
] as const;

type ExerciseId = (typeof EXERCISES)[number]["id"];

/** Frames go out roughly once a rep. Faster costs battery and buys nothing. */
const FRAME_INTERVAL_MS = 3200;

interface Reading extends FormResult {
  id: string;
}

export default function FormScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [exercise, setExercise] = useState<ExerciseId>("squat");
  const [running, setRunning] = useState(false);

  const [readings, setReadings] = useState<Reading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const countRef = useRef(0);

  const def = EXERCISES.find((e) => e.id === exercise)!;
  const latest = readings[0] ?? null;

  const reset = useCallback(() => {
    setReadings([]);
    setError(null);
    countRef.current = 0;
  }, []);

  const captureAndAnalyse = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || inFlight.current) return;

    inFlight.current = true;
    setAnalysing(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await analyseFrame({
        camera,
        mode: "form",
        signal: controller.signal,
        state: {
          exercise: def.label,
          reps: countRef.current,
          checkpoints: def.watch,
        },
      });

      setError(null);
      if (!result.personVisible) {
        setReadings((prev) => [{ ...result, id: `r-${Date.now()}` }, ...prev].slice(0, 12));
        return;
      }

      countRef.current += 1;
      setReadings((prev) => [{ ...result, id: `r-${Date.now()}` }, ...prev].slice(0, 12));

      // A correction has to be felt without looking up mid-rep; a confirmation
      // should not compete with it.
      void Haptics.impactAsync(
        result.cueOk ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ChatError ? err.message : "Couldn't read that frame.");
    } finally {
      inFlight.current = false;
      setAnalysing(false);
    }
  }, [def]);

  useEffect(() => {
    if (!running) return;
    void captureAndAnalyse();
    const id = setInterval(() => void captureAndAnalyse(), FRAME_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [running, captureAndAnalyse]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const scored = latest?.checkpoints ?? [];
  const flagged = scored.filter((c) => c.verdict === "fix").length;
  const clean = scored.filter((c) => c.verdict === "good").length;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Form Control",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.amber,
          headerTitleStyle: { color: color.text, fontWeight: "700" },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{
            padding: space.xl,
            paddingBottom: space.xxxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              height: 260,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: color.surfaceAlt,
              borderWidth: 1,
              borderColor: running ? tint(color.amber, 0.4) : color.border,
            }}
          >
            {permission?.granted ? (
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front">
                <View
                  style={{
                    flex: 1,
                    padding: space.md,
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Badge
                      label={running ? (analysing ? "● Reading" : "● Watching") : "Ready"}
                      accent={color.amber}
                    />
                    {latest?.phase && running ? (
                      <Badge label={latest.phase} accent={color.blue} />
                    ) : null}
                  </View>

                  <View
                    style={{
                      alignSelf: "center",
                      width: 110,
                      height: 180,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: tint(color.amber, 0.5),
                      borderRadius: 55,
                    }}
                  />

                  {/* Live cue, over the frame — the only thing worth reading mid-set. */}
                  {running && latest?.cue ? (
                    <Animated.View
                      key={latest.id}
                      entering={FadeIn}
                      style={{ alignItems: "center" }}
                    >
                      <View
                        style={{
                          paddingHorizontal: space.lg,
                          paddingVertical: space.sm,
                          borderRadius: radius.pill,
                          backgroundColor: "rgba(4,7,13,0.8)",
                          borderWidth: 1,
                          borderColor: tint(latest.cueOk ? color.green : color.red, 0.5),
                          maxWidth: "94%",
                        }}
                      >
                        <Txt
                          variant="bodyStrong"
                          c={latest.cueOk ? color.green : color.red}
                          numberOfLines={2}
                        >
                          {latest.cue}
                        </Txt>
                      </View>
                    </Animated.View>
                  ) : (
                    <View />
                  )}
                </View>
              </CameraView>
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: space.xl,
                }}
              >
                <Ionicons name="videocam-off-outline" size={30} color={color.textFaint} />
                <Txt
                  variant="body"
                  c={color.textMuted}
                  style={{ marginTop: space.md, textAlign: "center" }}
                >
                  Camera access is needed to check your form.
                </Txt>
                <Button
                  label="Allow camera"
                  onPress={() => void requestPermission()}
                  variant="secondary"
                  accent={color.amber}
                  style={{ marginTop: space.lg }}
                />
              </View>
            )}
          </View>

          {latest?.framing ? (
            <Card style={{ marginTop: space.md }} accent={color.amber}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Ionicons name="scan-outline" size={16} color={color.amber} />
                <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                  {latest.framing}
                </Txt>
              </View>
            </Card>
          ) : null}

          {error ? (
            <Card style={{ marginTop: space.md }} accent={color.red}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Ionicons name="alert-circle-outline" size={16} color={color.red} />
                <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                  {error}
                </Txt>
              </View>
            </Card>
          ) : null}

          <View style={{ flexDirection: "row", gap: space.md, marginTop: space.lg }}>
            <Metric label="Reads" value={String(countRef.current)} accent={color.amber} />
            <Metric label="Clean" value={String(clean)} accent={color.green} />
            <Metric label="Flagged" value={String(flagged)} accent={color.red} />
          </View>

          <Label>Exercise</Label>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: space.sm,
              marginTop: space.md,
            }}
          >
            {EXERCISES.map((e) => (
              <Chip
                key={e.id}
                label={e.label}
                icon={e.icon}
                accent={color.amber}
                selected={exercise === e.id}
                onPress={() => {
                  if (running) return;
                  setExercise(e.id);
                  reset();
                }}
              />
            ))}
          </View>

          <Button
            label={running ? "End set" : "Start watching"}
            icon={running ? "stop" : "play"}
            accent={running ? color.red : color.amber}
            variant={running ? "secondary" : "primary"}
            onPress={() => {
              if (running) {
                setRunning(false);
              } else {
                reset();
                setRunning(true);
              }
            }}
            disabled={!permission?.granted}
            style={{ marginTop: space.xl }}
          />

          {/* Scores — the point of the screen. */}
          <View style={{ marginTop: space.xxl }}>
            <Label>This rep, scored</Label>
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {!latest ? (
                <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
                  <Ionicons name="body-outline" size={26} color={color.textFaint} />
                  <Txt
                    variant="small"
                    c={color.textMuted}
                    style={{ marginTop: space.sm, textAlign: "center" }}
                  >
                    Each checkpoint gets a score out of ten — and the reason it earned that score,
                    not just the number.
                  </Txt>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: space.sm,
                      marginTop: space.lg,
                      justifyContent: "center",
                    }}
                  >
                    {def.watch.map((w) => (
                      <Chip key={w} label={w} accent={color.textMuted} />
                    ))}
                  </View>
                </Card>
              ) : !latest.personVisible ? (
                <Card accent={color.amber}>
                  <Txt variant="small" c={color.textMuted}>
                    {latest.framing ?? "Can't see you clearly enough to score this one."}
                  </Txt>
                </Card>
              ) : (
                latest.checkpoints.map((c) => <CheckpointCard key={c.name} checkpoint={c} />)
              )}
            </View>
          </View>

          {/* Recent history, so a set can be reviewed after the fact. */}
          {readings.length > 1 ? (
            <View style={{ marginTop: space.xxl }}>
              <Label>Earlier in this set</Label>
              <View style={{ marginTop: space.md, gap: space.sm }}>
                {readings.slice(1, 6).map((r) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInDown.duration(220)}
                    layout={Layout.springify()}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.md,
                        backgroundColor: color.surface,
                        borderWidth: 1,
                        borderColor: tint(r.cueOk ? color.green : color.red, 0.22),
                        borderRadius: radius.md,
                        paddingHorizontal: space.lg,
                        paddingVertical: space.md,
                      }}
                    >
                      <Ionicons
                        name={r.cueOk ? "checkmark-circle" : "alert-circle"}
                        size={16}
                        color={r.cueOk ? color.green : color.red}
                      />
                      <Txt variant="small" style={{ flex: 1 }} numberOfLines={2}>
                        {r.cue}
                      </Txt>
                      <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                        {r.phase}
                      </Txt>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          <Card style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <Ionicons name="shield-checkmark-outline" size={17} color={color.textMuted} />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong" c={color.textMuted}>
                  A second pair of eyes, not a spotter
                </Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: 3 }}>
                  Form Control reads single frames from one angle. It catches the common faults well
                  and can miss what the camera can&apos;t see — keep a human nearby for genuinely
                  heavy work.
                </Txt>
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ─── One checkpoint: the score, and what earned it ────────────────────────────
function CheckpointCard({ checkpoint }: { checkpoint: FormCheckpoint }) {
  const [open, setOpen] = useState(false);
  const accent =
    checkpoint.verdict === "good"
      ? color.green
      : checkpoint.verdict === "watch"
        ? color.amber
        : color.red;
  const score = Math.max(0, Math.min(10, Math.round(checkpoint.score)));

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        setOpen((v) => !v);
      }}
      style={{
        backgroundColor: tint(accent, 0.06),
        borderWidth: 1,
        borderColor: tint(accent, 0.24),
        borderRadius: radius.md,
        padding: space.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {/* The score, large enough that the number and the reason read together. */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.sm,
            backgroundColor: tint(accent, 0.14),
            borderWidth: 1,
            borderColor: tint(accent, 0.3),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt variant="heading" c={accent} style={{ fontSize: 18 }}>
            {score}
          </Txt>
        </View>

        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{checkpoint.name}</Txt>
          <Txt
            variant="small"
            c={color.textMuted}
            style={{ marginTop: 2, fontSize: 12 }}
            numberOfLines={open ? undefined : 2}
          >
            {checkpoint.observed}
          </Txt>
        </View>

        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={color.textFaint} />
      </View>

      {/* Ten segments, so the score is comparable at a glance across checkpoints. */}
      <View style={{ flexDirection: "row", gap: 3, marginTop: space.md }}>
        {Array.from({ length: 10 }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < score ? accent : tint(color.text, 0.08),
            }}
          />
        ))}
      </View>

      {open ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: space.md }}>
          <Label c={accent}>Why {score} and not higher</Label>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm, fontSize: 12 }}>
            {checkpoint.why}
          </Txt>

          {checkpoint.fix ? (
            <>
              <Label c={accent}>The fix</Label>
              <Txt variant="small" style={{ marginTop: space.sm, fontSize: 12 }}>
                {checkpoint.fix}
              </Txt>
            </>
          ) : null}
        </Animated.View>
      ) : null}
    </Pressable>
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
