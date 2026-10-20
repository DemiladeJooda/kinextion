/**
 * Environment Design — your space, calibrated to your current state.
 *
 * The three modes mirror ENV_MODES on the website's How It Works page, so the
 * copy a user reads before downloading matches what they find inside.
 *
 * The substance of the feature is the room scan: point the camera at where you
 * actually are, and `/api/vision` reads the light, the daylight, the screens,
 * and the clutter, scores how well the room suits the state you're aiming for,
 * and returns the specific changes that would move it most — each naming an
 * object in your photo and the mechanism behind it. Generic advice ("dim the
 * lights") is what this feature exists to replace.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Badge, Button, Card, Label, Txt } from "../../components/ui";
import { analyseFrame, type EnvResult } from "../../lib/vision";
import { ChatError } from "../../lib/api";
import { color, radius, space, tint } from "../../theme";

const MODES = [
  {
    id: "recovery",
    label: "Recovery",
    icon: "moon-outline",
    accent: color.amber,
    trigger: "HRV low · elevated cortisol",
    music: "Low Light — Sub Focus",
    musicSub: "72 BPM · ambient",
    light: "Warm 2700K · 30%",
    rationale:
      "Your nervous system is already working. Warm, dim light and slow tempo tell it the day is over.",
  },
  {
    id: "focus",
    label: "Deep Focus",
    icon: "eye-outline",
    accent: color.blue,
    trigger: "Deep work block on your calendar",
    music: "Music For Airports — Brian Eno",
    musicSub: "Ambient · no lyrics",
    light: "Cool white 4500K · 65%",
    rationale:
      "Lyrics compete for the same language circuits you're about to use. Cooler light holds alertness without the jitter.",
  },
  {
    id: "preworkout",
    label: "Pre-Workout",
    icon: "flash-outline",
    accent: color.green,
    trigger: "HRV 74ms · sleep quality high",
    music: "Power Hour — workout mix",
    musicSub: "128 BPM · high energy",
    light: "Daylight 6500K · 100%",
    rationale:
      "You've got the recovery to spend. Bright light and tempo above your resting cadence pull effort up with them.",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export default function EnvironmentScreen() {
  const [mode, setMode] = useState<ModeId>("recovery");
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [reading, setReading] = useState<EnvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const active = MODES.find((m) => m.id === mode)!;

  // Slow wash so the preview reads as ambient light, not a loading spinner.
  const wash = useSharedValue(0);
  useEffect(() => {
    wash.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [wash]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + wash.value * 0.4,
    transform: [{ scale: 0.95 + wash.value * 0.12 }],
  }));

  useEffect(() => () => abortRef.current?.abort(), []);

  const scanRoom = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || scanning) return;

    setScanning(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await analyseFrame({
        camera,
        mode: "environment",
        signal: controller.signal,
        state: {
          modeLabel: active.label,
          trigger: active.trigger,
          lightTarget: active.light,
          audioTarget: `${active.music} — ${active.musicSub}`,
        },
      });
      setReading(result);
      setCameraOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ChatError ? err.message : "Couldn't read the room.");
    } finally {
      setScanning(false);
    }
  }, [active, scanning]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Environment Design",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.teal,
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
          {/* Camera when scanning, room-tone preview otherwise. */}
          <View
            style={{
              height: 200,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: color.surfaceAlt,
              borderWidth: 1,
              borderColor: tint(active.accent, 0.25),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cameraOpen && permission?.granted ? (
              <CameraView ref={cameraRef} style={{ flex: 1, width: "100%" }} facing="back">
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
                      label={scanning ? "● Reading the room" : "Ready"}
                      accent={active.accent}
                    />
                    <Badge label={active.label} accent={active.accent} />
                  </View>
                  <Txt
                    variant="small"
                    c="#FFFFFF"
                    style={{ textAlign: "center", marginBottom: space.sm }}
                  >
                    Point at where you&apos;ll actually be — desk, sofa, floor space
                  </Txt>
                </View>
              </CameraView>
            ) : (
              <>
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      width: 320,
                      height: 320,
                      borderRadius: 160,
                    },
                    washStyle,
                  ]}
                >
                  <LinearGradient
                    colors={[tint(active.accent, 0.55), "transparent"]}
                    style={{ flex: 1, borderRadius: 160 }}
                  />
                </Animated.View>

                <Animated.View
                  key={active.id}
                  entering={FadeIn.duration(420)}
                  style={{ alignItems: "center" }}
                >
                  <Ionicons name={active.icon} size={34} color={active.accent} />
                  <Txt variant="title" c={active.accent} style={{ marginTop: space.sm }}>
                    {active.label}
                  </Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                    {active.trigger}
                  </Txt>
                </Animated.View>
              </>
            )}
          </View>

          {/* Mode picker */}
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
            {MODES.map((m) => (
              <Button
                key={m.id}
                label={m.label}
                accent={m.accent}
                variant={m.id === mode ? "primary" : "ghost"}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setMode(m.id);
                  // A reading is only valid for the state it was taken for.
                  setReading(null);
                }}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          {/* Why this mode */}
          <Card style={{ marginTop: space.xl }} accent={active.accent}>
            <Label c={active.accent}>Why this</Label>
            <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
              {active.rationale}
            </Txt>
          </Card>

          {/* The scan */}
          {!permission?.granted ? (
            <Card style={{ marginTop: space.lg }}>
              <Txt variant="body" c={color.textMuted}>
                Camera access lets Kinextion read your actual room instead of guessing at a generic
                one.
              </Txt>
              <Button
                label="Allow camera"
                onPress={() => void requestPermission()}
                variant="secondary"
                accent={active.accent}
                style={{ marginTop: space.lg }}
              />
            </Card>
          ) : cameraOpen ? (
            <View
              style={{
                flexDirection: "row",
                gap: space.sm,
                marginTop: space.lg,
              }}
            >
              <Button
                label={scanning ? "Reading…" : "Scan this room"}
                icon="scan-outline"
                accent={active.accent}
                loading={scanning}
                onPress={() => void scanRoom()}
                style={{ flex: 1 }}
              />
              <Button
                label="Cancel"
                variant="ghost"
                accent={color.textMuted}
                onPress={() => setCameraOpen(false)}
              />
            </View>
          ) : (
            <Button
              label={reading ? "Scan again" : "Scan my room"}
              icon="camera-outline"
              accent={active.accent}
              onPress={() => {
                setError(null);
                setCameraOpen(true);
              }}
              style={{ marginTop: space.lg }}
            />
          )}

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

          {/* What it found */}
          {reading ? (
            <RoomReading reading={reading} accent={active.accent} modeLabel={active.label} />
          ) : (
            <Card style={{ marginTop: space.lg }}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <Ionicons name="bulb-outline" size={17} color={color.textMuted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" c={color.textMuted}>
                    Targets for {active.label}
                  </Txt>
                  <Txt variant="small" c={color.textFaint} style={{ marginTop: 4 }}>
                    Light: {active.light}
                  </Txt>
                  <Txt variant="small" c={color.textFaint}>
                    Audio: {active.music} · {active.musicSub}
                  </Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
                    Scan the room to find out how far it is from these — and what to change first.
                  </Txt>
                </View>
              </View>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ─── The reading ──────────────────────────────────────────────────────────────
function RoomReading({
  reading,
  accent,
  modeLabel,
}: {
  reading: EnvResult;
  accent: string;
  modeLabel: string;
}) {
  if (!reading.roomVisible) {
    return (
      <Card style={{ marginTop: space.lg }} accent={color.amber}>
        <Txt variant="small" c={color.textMuted}>
          {reading.framing ??
            "Couldn't read the room from that shot — try more of the space in frame."}
        </Txt>
      </Card>
    );
  }

  const score = Math.max(0, Math.min(10, Math.round(reading.fitScore)));
  const scoreColor = score >= 7 ? color.green : score >= 4 ? color.amber : color.red;

  const rows: Array<[string, string, keyof typeof Ionicons.glyphMap]> = [
    ["Brightness", reading.reading.brightness, "sunny-outline"],
    ["Colour temp", reading.reading.colourTemp, "thermometer-outline"],
    ["Daylight", reading.reading.daylight, "partly-sunny-outline"],
    ["Screens", reading.reading.screens, "tv-outline"],
    ["In your sightline", reading.reading.clutter, "eye-outline"],
  ];

  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      {/* Fit score */}
      <Card style={{ marginTop: space.lg }} accent={scoreColor}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <View style={{ alignItems: "center", width: 58 }}>
            <Txt variant="display" c={scoreColor} style={{ fontSize: 38 }}>
              {score}
            </Txt>
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 10 }}>
              out of 10
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Label c={scoreColor}>This room for {modeLabel}</Label>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
              {reading.fitWhy}
            </Txt>
          </View>
        </View>
      </Card>

      {/* What it actually saw */}
      <Label>What the camera read</Label>
      <Card padded={false} style={{ paddingVertical: space.xs, marginTop: space.md }}>
        {rows.map(([label, value, icon], i) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: color.border,
            }}
          >
            <Ionicons name={icon} size={15} color={color.textFaint} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                {label}
              </Txt>
              <Txt variant="small" style={{ marginTop: 1 }}>
                {value}
              </Txt>
            </View>
          </View>
        ))}
      </Card>

      {/* The changes */}
      <Label>Change these, in this order</Label>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {reading.changes.length === 0 ? (
          <Card accent={color.green}>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <Ionicons name="checkmark-circle" size={17} color={color.green} />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                Nothing worth changing. This room already suits {modeLabel.toLowerCase()} — start.
              </Txt>
            </View>
          </Card>
        ) : (
          reading.changes.map((c, i) => (
            <ChangeRow key={c.action} change={c} index={i} accent={accent} />
          ))
        )}
      </View>

      <Txt variant="small" c={color.textFaint} style={{ marginTop: space.lg, fontSize: 11 }}>
        Read from one photo, which is dropped immediately — nothing from your camera is stored.
      </Txt>
    </Animated.View>
  );
}

function ChangeRow({
  change,
  index,
  accent,
}: {
  change: EnvResult["changes"][number];
  index: number;
  accent: string;
}) {
  const [done, setDone] = useState(false);
  const impactColor =
    change.impact === "high"
      ? color.green
      : change.impact === "medium"
        ? color.amber
        : color.textFaint;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDone((v) => !v);
      }}
      style={{
        backgroundColor: color.surface,
        borderWidth: 1,
        borderColor: done ? tint(color.green, 0.3) : color.border,
        borderRadius: radius.md,
        padding: space.lg,
        opacity: done ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: tint(done ? color.green : accent, 0.14),
            borderWidth: 1,
            borderColor: tint(done ? color.green : accent, 0.3),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? (
            <Ionicons name="checkmark" size={13} color={color.green} />
          ) : (
            <Txt variant="small" c={accent} style={{ fontSize: 11, fontWeight: "700" }}>
              {index + 1}
            </Txt>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" style={{ textDecorationLine: done ? "line-through" : "none" }}>
            {change.action}
          </Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 3, fontSize: 12 }}>
            {change.why}
          </Txt>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <Badge label={`${change.impact} impact`} accent={impactColor} />
            {change.seconds ? (
              <Badge label={`${change.seconds}s`} accent={color.textFaint} />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
