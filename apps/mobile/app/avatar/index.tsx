/**
 * You, in motion.
 *
 * Your avatar's expressions, you doing the things you're building, and a
 * before and after that only ever compares real scans.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, withDelay } from "react-native-reanimated";
import { AVATAR_ACTIVITIES, AVATAR_MOODS, type AvatarMoodId } from "@kinextion/shared";

import { AuroraBackdrop, Button, Card, Chip, Label, Notice, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { deleteAvatar, imageIfExists, loadManifest, readImage, saveImage, type AvatarManifest } from "../../lib/avatar";
import { color, radius, space, tint } from "../../theme";

export default function AvatarScreen() {
  const api = useApi();
  const router = useRouter();
  const params = useLocalSearchParams<{ activity?: string }>();
  const { width } = useWindowDimensions();

  const [manifest, setManifest] = useState<AvatarManifest | null | undefined>(undefined);
  const [mood, setMood] = useState<AvatarMoodId>("calm");
  const [moodUris, setMoodUris] = useState<Partial<Record<AvatarMoodId, string>>>({});
  const [latest, setLatest] = useState<string | null>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(params.activity ?? null);
  const [frames, setFrames] = useState<[string, string] | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const m = await loadManifest();
    setManifest(m);
    if (!m) return;
    const [l, f, ...moods] = await Promise.all([imageIfExists("latest"), imageIfExists("first"), ...AVATAR_MOODS.map((x) => imageIfExists(`mood-${x.id}`))]);
    setLatest(l);
    setFirst(f);
    setMoodUris(Object.fromEntries(AVATAR_MOODS.map((x, i) => [x.id, moods[i] ?? undefined])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const show = useCallback(
    async (id: string) => {
      setActivityId(id);
      setFrames(null);
      setError(null);
      const [a, b] = await Promise.all([imageIfExists(`scene-${id}-start`), imageIfExists(`scene-${id}-end`)]);
      if (a && b) return setFrames([a, b]);

      setMaking(true);
      try {
        const avatar = await readImage("latest");
        const made = await Promise.all(
          (["start", "end"] as const).map(async (frame) => {
            const { image } = await api.generateAvatar({ kind: "scene", consent: true, activity: id, frame, avatar });
            return saveImage(`scene-${id}-${frame}`, image);
          })
        );
        setFrames([made[0], made[1]]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't make that just now.");
      } finally {
        setMaking(false);
      }
    },
    [api]
  );

  const opened = useRef(false);
  useEffect(() => {
    if (manifest && params.activity && !opened.current) {
      opened.current = true;
      void show(params.activity);
    }
  }, [manifest, params.activity, show]);

  const remove = () =>
    Alert.alert("Delete your avatar?", "This removes your avatar, expressions and activities from this phone. It can't be undone.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteAvatar().then(() => {
            setManifest(null);
            setLatest(null);
            setFirst(null);
          });
        },
      },
    ]);

  const header = <Stack.Screen options={{ title: "You", headerStyle: { backgroundColor: color.bg }, headerShadowVisible: false, headerTintColor: color.text, headerBackTitle: "Back" }} />;

  if (manifest === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}>
        {header}
        <ActivityIndicator color={color.teal} />
      </SafeAreaView>
    );
  }

  if (!manifest) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
        {header}
        <AuroraBackdrop accent={color.teal} />
        <View style={{ flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}>
          <Txt variant="display">See yourself doing it.</Txt>
          <Txt variant="body" c={color.textMuted} style={{ fontSize: 17, lineHeight: 25 }}>
            A two-minute scan makes a digital you. Then you can watch yourself lifting, reading, or doing whatever you're building.
          </Txt>
          <Button label="Create my avatar" icon="scan-outline" accent={color.teal} onPress={() => router.push("/avatar/create" as never)} />
        </View>
      </SafeAreaView>
    );
  }

  const stageWidth = width - space.xl * 2;
  const stageHeight = stageWidth * 1.25;
  const moodUri = moodUris[mood];
  const activity = AVATAR_ACTIVITIES.find((a) => a.id === activityId);
  const sameScan = manifest.firstScan === manifest.latestScan;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      {header}
      <AuroraBackdrop accent={color.teal} />

      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={{ height: stageHeight, borderRadius: radius.xl, overflow: "hidden", backgroundColor: color.surface }}>
          {activity && frames ? (
            <MotionLoop frames={frames} />
          ) : making ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md }}>
              <ActivityIndicator color={color.teal} size="large" />
              <Txt variant="small" c={color.textMuted}>
                Making you {activity?.label.toLowerCase()}. About a minute, once.
              </Txt>
            </View>
          ) : latest ? (
            <Image source={{ uri: `${latest}?v=${manifest.version}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : null}
          {activity ? (
            <Pressable onPress={() => { setActivityId(null); setFrames(null); }} hitSlop={10} accessibilityLabel="Back to your avatar" style={{ position: "absolute", top: space.md, right: space.md, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(4,7,13,0.7)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={color.text} />
            </Pressable>
          ) : null}
        </View>

        {error ? <Notice>{error}</Notice> : null}

        <View style={{ gap: space.sm }}>
          <Label c={color.teal}>See yourself</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {AVATAR_ACTIVITIES.map((a) => (
              <Chip key={a.id} label={a.label} accent={color.teal} selected={activityId === a.id} onPress={() => void show(a.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Label c={color.purple}>Your faces</Label>
          <View style={{ flexDirection: "row", gap: space.md }}>
            {AVATAR_MOODS.map((m) => (
              <Pressable key={m.id} onPress={() => setMood(m.id)} style={{ flex: 1, gap: space.xs, alignItems: "center" }} accessibilityLabel={m.label}>
                <View style={{ aspectRatio: 1, width: "100%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: color.surface, borderWidth: 2, borderColor: mood === m.id ? color.purple : "transparent" }}>
                  {moodUris[m.id] ? <Image source={{ uri: `${moodUris[m.id]}?v=${manifest.version}` }} style={{ width: "100%", height: "100%" }} /> : null}
                </View>
                <Txt variant="small" c={mood === m.id ? color.text : color.textMuted}>
                  {m.label}
                </Txt>
              </Pressable>
            ))}
          </View>
          {moodUri ? null : (
            <Txt variant="small" c={color.textFaint}>
              Rescan to add this expression.
            </Txt>
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <Label c={color.green}>Before and after</Label>
          {sameScan || !first || !latest ? (
            <Card accent={color.green}>
              <Txt variant="body">Day one is saved.</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: space.xs }}>
                Scan again in a few weeks and drag between the two. It only ever compares real scans of you.
              </Txt>
            </Card>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)}>
              <BeforeAfter before={first} after={latest} version={manifest.version} width={stageWidth} height={stageHeight} beforeDate={manifest.firstScan} afterDate={manifest.latestScan} />
            </Animated.View>
          )}
          <Button label="Scan again" variant="secondary" icon="scan-outline" accent={color.green} onPress={() => router.push("/avatar/create" as never)} />
        </View>

        <Pressable onPress={remove} hitSlop={10} style={{ alignSelf: "center" }}>
          <Txt variant="small" c={color.textFaint}>
            Delete my avatar
          </Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const HOLD = 850;
const FADE = 260;

/** Two poses, trading places: enough to read as movement. */
function MotionLoop({ frames }: { frames: [string, string] }) {
  const second = useSharedValue(0);

  useEffect(() => {
    second.value = withRepeat(withSequence(withDelay(HOLD, withTiming(1, { duration: FADE })), withDelay(HOLD, withTiming(0, { duration: FADE }))), -1);
  }, [second]);

  const style = useAnimatedStyle(() => ({ opacity: second.value }));

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
      <Image source={{ uri: frames[0] }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
      <Animated.Image source={{ uri: frames[1] }} style={[{ position: "absolute", width: "100%", height: "100%" }, style]} resizeMode="cover" />
    </Animated.View>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Drag across to compare day one with today. */
function BeforeAfter({
  before,
  after,
  version,
  width,
  height,
  beforeDate,
  afterDate,
}: {
  before: string;
  after: string;
  version: number;
  width: number;
  height: number;
  beforeDate: string;
  afterDate: string;
}) {
  const [split, setSplit] = useState(width / 2);
  const current = useRef(width / 2);
  const startedAt = useRef(width / 2);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        startedAt.current = current.current;
      },
      onPanResponderMove: (_e, g) => {
        current.current = Math.max(0, Math.min(width, startedAt.current + g.dx));
        setSplit(current.current);
      },
    })
  ).current;

  return (
    <View
      style={{ width, height, borderRadius: radius.xl, overflow: "hidden", backgroundColor: color.surface }}
      {...pan.panHandlers}
    >
      <Image source={{ uri: `${after}?v=${version}` }} style={{ position: "absolute", width, height }} resizeMode="cover" />
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: split, overflow: "hidden" }}>
        <Image source={{ uri: before }} style={{ position: "absolute", width, height }} resizeMode="cover" />
      </View>
      <View style={{ position: "absolute", top: 0, bottom: 0, left: split - 1, width: 2, backgroundColor: color.text }} />
      <View style={{ position: "absolute", top: height / 2 - 18, left: split - 18, width: 36, height: 36, borderRadius: 18, backgroundColor: color.text, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="swap-horizontal" size={18} color={color.bg} />
      </View>
      <Stamp text={`Day one · ${shortDate(beforeDate)}`} side="left" />
      <Stamp text={shortDate(afterDate)} side="right" />
    </View>
  );
}

function Stamp({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <View style={{ position: "absolute", bottom: space.md, [side]: space.md, backgroundColor: tint(color.bg, 0.8), paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill }}>
      <Txt variant="small">{text}</Txt>
    </View>
  );
}
