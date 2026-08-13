/**
 * Smart Referee — prop your phone up and it officiates the game.
 *
 * The camera frame is genuinely analysed: while a game is running the screen
 * captures a still every few seconds and sends it to `/api/vision`, which
 * returns a call plus the visual evidence behind it. Every point on the
 * scoreboard is tappable, and opens the frame-by-frame reasoning for how the
 * score got where it is — the "why is it 11–3" view.
 *
 * The model is instructed to return `kind: "none"` for the many frames that
 * catch nothing decisive, which is most of them. Silence is the common case.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { Badge, Button, Card, Chip, EmptyState, Label, Txt } from "../../components/ui";
import { analyseFrame, confidenceLabel, type RefereeCall } from "../../lib/vision";
import { ChatError } from "../../lib/api";
import { color, radius, space, tint } from "../../theme";

const SPORTS = [
  { id: "pickleball", label: "Pickleball", icon: "tennisball-outline", target: 11 },
  { id: "tennis", label: "Tennis", icon: "tennisball-outline", target: 4 },
  { id: "basketball", label: "3-Point Shootout", icon: "basketball-outline", target: 25 },
  { id: "pickup", label: "Pick-up Game", icon: "people-outline", target: 21 },
] as const;

type SportId = (typeof SPORTS)[number]["id"];

/** How often a frame goes out while the game is running. */
const FRAME_INTERVAL_MS = 4000;

interface Call extends RefereeCall {
  id: string;
  at: string;
  /** Score immediately after this call — what makes the breakdown readable. */
  runningScore: [number, number];
  /** Set when the player overrules the call. */
  overturned?: boolean;
}

export default function RefereeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [sport, setSport] = useState<SportId>("pickleball");
  const [running, setRunning] = useState(false);

  const [calls, setCalls] = useState<Call[]>([]);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [framing, setFraming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Read inside the interval callback so the loop never restarts mid-game and
  // never sends a stale score to the model.
  const scoreRef = useRef<[number, number]>([0, 0]);
  const callsRef = useRef<Call[]>([]);
  const inFlight = useRef(false);

  scoreRef.current = score;
  callsRef.current = calls;

  const target = SPORTS.find((s) => s.id === sport)?.target ?? 11;

  const reset = useCallback(() => {
    setCalls([]);
    setScore([0, 0]);
    setFraming(null);
    setError(null);
  }, []);

  const captureAndAnalyse = useCallback(async () => {
    const camera = cameraRef.current;
    // One frame in the air at a time. A slow response should skip a beat, not
    // queue up a backlog of stale frames that all land at once.
    if (!camera || inFlight.current) return;

    inFlight.current = true;
    setAnalysing(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await analyseFrame({
        camera,
        mode: "referee",
        signal: controller.signal,
        state: {
          sport: SPORTS.find((s) => s.id === sport)?.label ?? sport,
          target,
          you: scoreRef.current[0],
          them: scoreRef.current[1],
          recentCalls: callsRef.current.slice(0, 4).map((c) => c.text),
        },
      });

      setFraming(result.framing);
      setError(null);

      const call = result.call;
      if (call.kind === "none") return;

      const scores = call.confidence >= 0.55;
      const next: [number, number] = [...scoreRef.current] as [number, number];
      if (call.kind === "point" && call.side && scores) {
        next[call.side === "you" ? 0 : 1] += 1;
        setScore(next);
      }

      setCalls((prev) =>
        [
          {
            ...call,
            id: `c-${Date.now()}`,
            at: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
            runningScore: next,
          },
          ...prev,
        ].slice(0, 24)
      );

      if (call.kind === "point") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ChatError ? err.message : "Couldn't read that frame.");
    } finally {
      inFlight.current = false;
      setAnalysing(false);
    }
  }, [sport, target]);

  useEffect(() => {
    if (!running) return;
    // Fire once immediately so the first call doesn't take four seconds.
    void captureAndAnalyse();
    const id = setInterval(() => void captureAndAnalyse(), FRAME_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [running, captureAndAnalyse]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Overturn a call — the score moves back and the reason is kept on record. */
  const overturn = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalls((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target || target.overturned || target.kind !== "point" || !target.side) return prev;
      setScore((s) => {
        const next: [number, number] = [...s] as [number, number];
        const i = target.side === "you" ? 0 : 1;
        next[i] = Math.max(0, next[i] - 1);
        return next;
      });
      return prev.map((c) => (c.id === id ? { ...c, overturned: true } : c));
    });
  }, []);

  const scoringCalls = calls.filter((c) => c.kind === "point" && !c.overturned);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Smart Referee",
          headerStyle: { backgroundColor: color.surface },
          headerTintColor: color.green,
          headerTitleStyle: { color: color.text, fontWeight: "700" },
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Camera */}
          <View
            style={{
              height: 220,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: color.surfaceAlt,
              borderWidth: 1,
              borderColor: running ? tint(color.green, 0.4) : color.border,
            }}
          >
            {permission?.granted ? (
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
                <View style={{ flex: 1, padding: space.md, justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Badge
                      label={running ? (analysing ? "● Reading frame" : "● Officiating") : "Ready"}
                      accent={color.green}
                    />
                    {framing ? <Badge label="Check framing" accent={color.amber} /> : null}
                  </View>

                  <View
                    style={{
                      alignSelf: "center",
                      width: "78%",
                      height: 96,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: tint(color.green, 0.55),
                      borderRadius: radius.md,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Txt variant="small" c={tint(color.green, 0.9)}>
                      Fit the full court in frame
                    </Txt>
                  </View>
                  <View />
                </View>
              </CameraView>
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl }}>
                <Ionicons name="videocam-off-outline" size={30} color={color.textFaint} />
                <Txt variant="body" c={color.textMuted} style={{ marginTop: space.md, textAlign: "center" }}>
                  Camera access is needed to watch the game.
                </Txt>
                <Button
                  label="Allow camera"
                  onPress={() => void requestPermission()}
                  variant="secondary"
                  accent={color.green}
                  style={{ marginTop: space.lg }}
                />
              </View>
            )}
          </View>

          {/* What the camera says it can't see — surfaced rather than swallowed. */}
          {framing ? (
            <Animated.View entering={FadeIn}>
              <Card style={{ marginTop: space.md }} accent={color.amber}>
                <View style={{ flexDirection: "row", gap: space.md }}>
                  <Ionicons name="scan-outline" size={16} color={color.amber} />
                  <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                    {framing}
                  </Txt>
                </View>
              </Card>
            </Animated.View>
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

          {/* Scoreboard — tap it to open the breakdown. */}
          <Pressable
            onPress={() => {
              if (!scoringCalls.length) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBreakdownOpen(true);
            }}
          >
            <Card style={{ marginTop: space.lg }} accent={running ? color.green : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Side label="You" value={score[0]} accent={color.green} />
                <View style={{ alignItems: "center", paddingHorizontal: space.lg }}>
                  <Label>First to {target}</Label>
                  <Txt variant="heading" c={color.textFaint} style={{ marginTop: 2 }}>
                    —
                  </Txt>
                </View>
                <Side label="Them" value={score[1]} accent={color.purple} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  marginTop: space.md,
                  paddingTop: space.md,
                  borderTopWidth: 1,
                  borderTopColor: color.border,
                }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={14}
                  color={scoringCalls.length ? color.green : color.textFaint}
                />
                <Txt variant="small" c={scoringCalls.length ? color.green : color.textFaint}>
                  {scoringCalls.length
                    ? `Why it's ${score[0]}–${score[1]}`
                    : "Every point will show its reasoning here"}
                </Txt>
              </View>
            </Card>
          </Pressable>

          {/* Sport picker */}
          <Label>Sport</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {SPORTS.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                icon={s.icon}
                accent={color.green}
                selected={sport === s.id}
                onPress={() => {
                  if (running) return;
                  setSport(s.id);
                  reset();
                }}
              />
            ))}
          </View>

          <Button
            label={running ? "Stop the game" : "Start officiating"}
            icon={running ? "stop" : "play"}
            accent={running ? color.red : color.green}
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

          {/* Call feed */}
          <View style={{ marginTop: space.xxl }}>
            <Label>Calls</Label>
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {calls.length === 0 ? (
                <EmptyState
                  icon="megaphone-outline"
                  title="No calls yet"
                  body="Start the game. Every point and fault lands here with the reason behind it — tap one to see what the camera saw."
                  accent={color.green}
                />
              ) : (
                calls.map((c) => <CallRow key={c.id} call={c} onOverturn={() => overturn(c.id)} />)
              )}
            </View>
          </View>

          <Pressable onPress={() => router.back()} style={{ marginTop: space.xl, alignItems: "center" }}>
            <Txt variant="small" c={color.textFaint}>
              Back to Today
            </Txt>
          </Pressable>
        </ScrollView>

        <ScoreBreakdown
          open={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          score={score}
          calls={scoringCalls}
        />
      </SafeAreaView>
    </>
  );
}

// ─── A single call, expandable into its evidence ──────────────────────────────
function CallRow({ call, onOverturn }: { call: Call; onOverturn: () => void }) {
  const [open, setOpen] = useState(false);
  const accent =
    call.overturned ? color.textFaint : call.kind === "point" ? color.green : color.amber;

  return (
    <Animated.View entering={FadeInDown.duration(260)} layout={Layout.springify().damping(20)}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        style={{
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: call.overturned ? color.border : tint(accent, 0.25),
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Ionicons
            name={
              call.overturned
                ? "close-circle-outline"
                : call.kind === "point"
                  ? "checkmark-circle"
                  : "warning"
            }
            size={17}
            color={accent}
          />
          <Txt
            variant="small"
            style={{ flex: 1, textDecorationLine: call.overturned ? "line-through" : "none" }}
            c={call.overturned ? color.textFaint : color.text}
          >
            {call.text}
          </Txt>
          <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
            {call.at}
          </Txt>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={color.textFaint} />
        </View>

        {call.confidence < 0.55 && !call.overturned ? (
          <Txt variant="small" c={color.amber} style={{ fontSize: 11, marginTop: 4, marginLeft: 29 }}>
            {confidenceLabel(call.confidence)} — this one didn&apos;t score
          </Txt>
        ) : null}

        {open ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: space.md, marginLeft: 29 }}>
            <Label c={accent}>What the camera saw</Label>
            <View style={{ gap: 5, marginTop: space.sm }}>
              {call.observed.map((o) => (
                <View key={o} style={{ flexDirection: "row", gap: space.sm }}>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: accent,
                      marginTop: 7,
                    }}
                  />
                  <Txt variant="small" c={color.textMuted} style={{ flex: 1, fontSize: 12 }}>
                    {o}
                  </Txt>
                </View>
              ))}
            </View>

            <Label c={accent}>Why this call</Label>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm, fontSize: 12 }}>
              {call.reasoning}
            </Txt>

            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md }}>
              <Badge label={confidenceLabel(call.confidence)} accent={accent} />
              {call.kind === "point" && !call.overturned ? (
                <Pressable
                  onPress={onOverturn}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: space.md,
                    paddingVertical: 5,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: tint(color.red, 0.3),
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={13} color={color.red} />
                  <Txt variant="small" c={color.red} style={{ fontSize: 11 }}>
                    Overturn
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ─── "Why it's 11–3" ──────────────────────────────────────────────────────────
// The scoreboard is only trustworthy if the arithmetic behind it is legible.
// This lists every point that survived, oldest first, with the running score
// beside it — so a disputed number can be traced to the exact frame.
function ScoreBreakdown({
  open,
  onClose,
  score,
  calls,
}: {
  open: boolean;
  onClose: () => void;
  score: [number, number];
  calls: Call[];
}) {
  const chronological = [...calls].reverse();

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: "flex-end" }}>
        <View
          style={{
            maxHeight: "84%",
            backgroundColor: color.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 1,
            borderColor: color.borderStrong,
            padding: space.xl,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: space.lg }}>
            <View style={{ flex: 1 }}>
              <Label c={color.green}>How it got to</Label>
              <Txt variant="title" style={{ marginTop: 2 }}>
                {score[0]} – {score[1]}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color.surface,
                borderWidth: 1,
                borderColor: color.border,
              }}
            >
              <Ionicons name="close" size={16} color={color.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: space.sm }}>
              {chronological.map((c, i) => {
                const accent = c.side === "you" ? color.green : color.purple;
                return (
                  <View
                    key={c.id}
                    style={{
                      flexDirection: "row",
                      gap: space.md,
                      backgroundColor: color.surface,
                      borderWidth: 1,
                      borderColor: tint(accent, 0.2),
                      borderRadius: radius.md,
                      padding: space.lg,
                    }}
                  >
                    <View style={{ alignItems: "center", width: 44 }}>
                      <Txt variant="small" c={color.textFaint} style={{ fontSize: 10 }}>
                        #{i + 1}
                      </Txt>
                      <Txt variant="bodyStrong" c={accent} style={{ marginTop: 2 }}>
                        {c.runningScore[0]}–{c.runningScore[1]}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="small" style={{ fontWeight: "600" }}>
                        {c.text}
                      </Txt>
                      <Txt variant="small" c={color.textMuted} style={{ marginTop: 3, fontSize: 12 }}>
                        {c.reasoning}
                      </Txt>
                      {c.observed.length ? (
                        <Txt variant="small" c={color.textFaint} style={{ marginTop: 5, fontSize: 11 }}>
                          Saw: {c.observed.join(" · ")}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <Txt variant="small" c={color.textFaint} style={{ marginTop: space.lg, fontSize: 11 }}>
              Overturned calls are removed from this list and from the score.
            </Txt>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Side({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Label c={accent}>{label}</Label>
      <Txt variant="display" c={accent} style={{ fontSize: 46, marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}
