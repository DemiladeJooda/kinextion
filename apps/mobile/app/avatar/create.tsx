/**
 * Scanning yourself.
 *
 * Says plainly what happens to the photos, asks for consent, then walks you
 * through seven quick shots. Faces first, then step back for the whole body,
 * then three expressions so the avatar can look like you when you're smiling
 * and when you're not.
 */

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AVATAR_MOODS, type AvatarMoodId } from "@kinextion/shared";

import { AuroraBackdrop, Button, Notice, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { readImage, saveImage, storeScan } from "../../lib/avatar";
import { color, radius, space, tint } from "../../theme";

type Shot = "front" | "left" | "right" | "body" | AvatarMoodId;

const SHOTS: readonly { id: Shot; title: string; hint: string; timer?: number }[] = [
  { id: "front", title: "Look straight at the camera", hint: "Hair off your face, in good light." },
  { id: "left", title: "Turn your head left", hint: "Keep your shoulders still." },
  { id: "right", title: "Now to the right", hint: "Just your head." },
  { id: "body", title: "Prop your phone up and step back", hint: "Everyday clothes, whole body in the frame. Six seconds.", timer: 6 },
  { id: "calm", title: "Back up close. Relaxed face.", hint: "Just how you look when nothing's happening." },
  { id: "happy", title: "A real smile", hint: "Think of someone you like." },
  { id: "sad", title: "And a low day", hint: "How your face looks when it's been a long one." },
];

type Stage = "consent" | "capture" | "making" | "failed";

export default function CreateAvatarScreen() {
  const api = useApi();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>("consent");
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const camera = useRef<CameraView>(null);
  const photos = useRef<Partial<Record<Shot, string>>>({});

  const shot = SHOTS[step];

  const header = (
    <Stack.Screen options={{ title: "Your avatar", headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false, headerTintColor: color.text, headerBackTitle: "Back" }} />
  );

  const begin = async () => {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result?.granted) {
      setError("Kinextion needs the camera for this. You can allow it in Settings.");
      return;
    }
    setError(null);
    setStage("capture");
  };

  const make = async () => {
    setStage("making");
    setError(null);
    try {
      const p = photos.current;
      setStatus("Making your avatar. This can take a minute.");
      const { image } = await api.generateAvatar({
        kind: "base",
        consent: true,
        images: [p.front, p.left, p.right, p.body].filter((x): x is string => Boolean(x)),
      });
      await storeScan(image);

      const avatar = await readImage("latest");
      setStatus("Teaching it your expressions.");
      await Promise.all(
        AVATAR_MOODS.map(async (m) => {
          const face = p[m.id];
          if (!face) return;
          const made = await api.generateAvatar({ kind: "mood", consent: true, mood: m.id, avatar, face });
          await saveImage(`mood-${m.id}`, made.image);
        })
      );
      photos.current = {};
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/avatar" as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that just now.");
      setStage("failed");
    }
  };

  const capture = async () => {
    try {
      const taken = await camera.current?.takePictureAsync({ base64: true, quality: 0.4, imageType: "jpg", shutterSound: false });
      if (!taken?.base64) throw new Error("no photo");
      photos.current[shot.id] = taken.base64;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (step === SHOTS.length - 1) void make();
      else setStep((s) => s + 1);
    } catch {
      setError("That didn't take. Try again?");
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void capture();
      return;
    }
    void Haptics.selectionAsync();
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // capture reads the current step; the countdown is what drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  if (stage === "consent") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        {header}
        <AuroraBackdrop accent={color.teal} />
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
          <Txt variant="display">See yourself doing it.</Txt>
          <Txt variant="body" c={color.textMuted} style={{ fontSize: 17, lineHeight: 25 }}>
            A quick scan makes a digital you, with your face, your expressions and your real body. Then you can watch yourself doing the things you're building.
          </Txt>

          <View style={{ gap: space.md, marginTop: space.sm }}>
            <Fact icon="cloud-upload-outline" text="Your seven photos go to OpenAI to make the avatar. They aren't saved by Kinextion." />
            <Fact icon="phone-portrait-outline" text="The finished avatar stays on this phone. Delete it whenever you like." />
            <Fact icon="body-outline" text="It keeps your real body. We'll never make a slimmer or bulkier version of you." />
          </View>

          <Check on={adult} onPress={() => setAdult((v) => !v)} label="I'm 18 or older" />
          <Check on={agreed} onPress={() => setAgreed((v) => !v)} label="These are photos of me, and I'm okay with them being used this way" />

          {error ? <Notice>{error}</Notice> : null}

          <Button label="Start the scan" accent={color.teal} disabled={!adult || !agreed} onPress={() => void begin()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (stage === "making" || stage === "failed") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        {header}
        <AuroraBackdrop accent={color.teal} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.xl }}>
          {stage === "making" ? (
            <>
              <ScanPulse />
              <Txt variant="heading" style={{ textAlign: "center" }}>
                {status}
              </Txt>
              <Txt variant="small" c={color.textFaint} style={{ textAlign: "center" }}>
                You can keep this screen open.
              </Txt>
            </>
          ) : (
            <>
              <Notice>{error ?? "Couldn't make that just now."}</Notice>
              <Button label="Try again" accent={color.teal} onPress={() => void make()} />
              <Button
                label="Retake the photos"
                variant="ghost"
                onPress={() => {
                  setStep(0);
                  setStage("capture");
                }}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={camera} facing="front" style={{ flex: 1 }} />

      <SafeAreaView style={{ position: "absolute", inset: 0, justifyContent: "space-between", padding: space.xl }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {SHOTS.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? color.teal : "rgba(255,255,255,0.3)" }} />
          ))}
        </View>

        <View style={{ alignItems: "center", gap: space.lg }}>
          <Animated.View key={shot.id} entering={FadeInDown.duration(300)} style={{ backgroundColor: "rgba(4,7,13,0.78)", padding: space.lg, borderRadius: radius.lg, width: "100%" }}>
            <Txt variant="heading" style={{ textAlign: "center" }}>
              {shot.title}
            </Txt>
            <Txt variant="small" c={color.textMuted} style={{ textAlign: "center", marginTop: 2 }}>
              {shot.hint}
            </Txt>
          </Animated.View>

          {countdown !== null ? (
            <Animated.View key={countdown} entering={FadeIn.duration(150)}>
              <Txt variant="display" style={{ fontSize: 64, lineHeight: 72 }}>
                {countdown}
              </Txt>
            </Animated.View>
          ) : (
            <Pressable
              onPress={() => (shot.timer ? setCountdown(shot.timer) : void capture())}
              accessibilityRole="button"
              accessibilityLabel={shot.timer ? "Start the timer" : "Take photo"}
              style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}
            >
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                {shot.timer ? <Ionicons name="timer-outline" size={28} color={color.bg} /> : null}
              </View>
            </Pressable>
          )}

          {error ? (
            <Txt variant="small" c={color.red}>
              {error}
            </Txt>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <Ionicons name={icon} size={20} color={color.teal} style={{ marginTop: 1 }} />
      <Txt variant="body" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: "row", gap: space.md, alignItems: "center", paddingVertical: space.xs }}>
      <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? color.teal : color.textFaint} />
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ScanPulse() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.25, { duration: 1100 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 1.6 - pulse.value }));

  return (
    <View style={{ width: 170, height: 170, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: tint(color.teal, 0.35) }, style]} />
      <ActivityIndicator color={color.teal} size="large" />
    </View>
  );
}
