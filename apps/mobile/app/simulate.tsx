/**
 * How a habit forms — a simulation you can scrub through.
 *
 * One habit, one life, six people. Drag across the chart (or press play) and
 * watch each day's morning and night: the reminder, the Thanksgiving that
 * got in the way, the tiny-version weeks, the curve rising behind it all.
 * Some people get there in three weeks, some take most of a year, and some
 * lose a fortnight and come back. That spread is the research's finding, not
 * a flourish, and it's the encouragement: there is more than one way there,
 * and a bad week doesn't send you back to zero.
 *
 * Demo first: example lives, clearly labelled. If the viewer has filled in
 * "About you", their own life appears as an option too.
 *
 * The engine lives in packages/shared/src/simulation — this screen only
 * draws it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import {
  DEMO_HABITS,
  EXAMPLE_LIVES,
  SIM_AUTOMATIC_AT,
  SIM_LENGTHS,
  SIM_RESEARCH,
  backgroundLines,
  lifeFromBackground,
  localDateKey,
  simulateAll,
  type SimDay,
  type SimLength,
  type SimLife,
  type SimRun,
} from "@kinextion/shared";

import { AuroraBackdrop, Card, Chip, Label, ScreenHeader, Txt } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { color, radius, space, tint } from "../theme";

const PATH_COLORS = [color.green, color.teal, color.blue, color.purple, color.amber, color.pink];
const CHART_HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };
const MIN_A = 1;
const MAX_A = 7;

const formatDate = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function SimulateScreen() {
  const api = useApi();
  const [habitId, setHabitId] = useState(DEMO_HABITS[1].id);
  const [ownLife, setOwnLife] = useState<SimLife | null>(null);
  const [lifeId, setLifeId] = useState(EXAMPLE_LIVES[0].id);
  const [length, setLength] = useState<SimLength>("90d");
  const [selected, setSelected] = useState(1);
  const [day, setDay] = useState(1);
  const [playing, setPlaying] = useState(false);

  // Their own life, if they've told us about it.
  useEffect(() => {
    let cancelled = false;
    api
      .getMyProfile()
      .then((user) => {
        const bg = user.profile?.background;
        if (!cancelled && bg && backgroundLines(bg).length) setOwnLife(lifeFromBackground(bg));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lives = useMemo(() => (ownLife ? [ownLife, ...EXAMPLE_LIVES] : [...EXAMPLE_LIVES]), [ownLife]);
  const life = lives.find((l) => l.id === lifeId) ?? lives[0];
  const habit = DEMO_HABITS.find((h) => h.id === habitId) ?? DEMO_HABITS[0];
  const days = SIM_LENGTHS[length];
  const start = useMemo(() => localDateKey(), []);

  const runs = useMemo(() => simulateAll({ habit, life, start, days }), [habit, life, start, days]);
  const run = runs[selected];
  const today = run.days[Math.min(day, days) - 1];

  // Keep the scrubber in range when the length changes.
  useEffect(() => setDay((d) => Math.min(d, days)), [days]);

  // Play: the whole stretch in about ten seconds.
  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.round(days / 150));
    const timer = setInterval(() => {
      setDay((d) => {
        if (d >= days) {
          setPlaying(false);
          return d;
        }
        return Math.min(days, d + step);
      });
    }, 66);
    return () => clearInterval(timer);
  }, [playing, days]);

  const automaticNow = runs.filter((r) => r.automaticDay !== null && r.automaticDay <= day).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "How habits form",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={PATH_COLORS[selected]} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="More than one way there"
          subtitle="Same life, same habit, six different people. Drag through the days."
        />

        {/* ── Habit, life, length ───────────────────────────────────────── */}
        <View style={{ gap: space.md }}>
          <ChipRow>
            {DEMO_HABITS.map((h) => (
              <Chip
                key={h.id}
                label={h.name}
                accent={color.amber}
                selected={h.id === habit.id}
                onPress={() => setHabitId(h.id)}
              />
            ))}
          </ChipRow>
          <ChipRow>
            {lives.map((l) => (
              <Chip
                key={l.id}
                label={l.own ? "Your life" : l.label}
                icon={l.own ? "person-outline" : undefined}
                accent={color.blue}
                selected={l.id === life.id}
                onPress={() => setLifeId(l.id)}
              />
            ))}
          </ChipRow>
          <Txt variant="small" c={color.textFaint}>
            {life.own ? "From what you shared in About you. " : "An example life, not a real person. "}
            {life.summary.join(" · ")}
          </Txt>
        </View>

        {/* ── The fan ───────────────────────────────────────────────────── */}
        <Card padded={false} style={{ paddingVertical: space.lg, paddingHorizontal: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm }}>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!playing && day >= days) setDay(1);
                setPlaying((p) => !p);
              }}
              hitSlop={10}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tint(PATH_COLORS[selected], 0.16),
              }}
            >
              <Ionicons name={playing ? "pause" : "play"} size={16} color={PATH_COLORS[selected]} />
            </Pressable>
            <View style={{ marginLeft: space.md, flex: 1 }}>
              <Txt variant="bodyStrong">Day {day}</Txt>
              <Txt variant="small" c={color.textMuted}>
                {automaticNow === 0
                  ? "Nobody's automatic yet. Everyone's still going."
                  : `${automaticNow} of ${runs.length} feel automatic. The rest are still going.`}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {(Object.keys(SIM_LENGTHS) as SimLength[]).map((k) => (
                <Chip
                  key={k}
                  label={k === "90d" ? "90 days" : "9 months"}
                  accent={color.text}
                  selected={k === length}
                  onPress={() => {
                    setPlaying(false);
                    setLength(k);
                  }}
                />
              ))}
            </View>
          </View>

          <FanChart
            runs={runs}
            selected={selected}
            day={day}
            days={days}
            onScrub={(d) => {
              setPlaying(false);
              setDay(d);
            }}
          />
        </Card>

        {/* ── The six people ───────────────────────────────────────────── */}
        <ChipRow>
          {runs.map((r, i) => (
            <Chip
              key={r.path.id}
              label={r.path.name}
              accent={PATH_COLORS[i]}
              selected={i === selected}
              onPress={() => setSelected(i)}
            />
          ))}
        </ChipRow>
        <PathSummary run={run} day={day} accent={PATH_COLORS[selected]} />

        {/* ── This day ─────────────────────────────────────────────────── */}
        <DayCard
          day={today}
          accent={PATH_COLORS[selected]}
          onStep={(delta) => {
            setPlaying(false);
            setDay((d) => Math.max(1, Math.min(days, d + delta)));
          }}
        />

        {/* ── Where this comes from ────────────────────────────────────── */}
        <Card>
          <Label>What the research found</Label>
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Txt variant="small" c={color.textMuted}>
              In a study of people building a new daily habit, the middle person took about{" "}
              {SIM_RESEARCH.medianDays} days for it to feel automatic. The fastest took {SIM_RESEARCH.minDays}, the
              slowest about {SIM_RESEARCH.maxDays}. Simple habits tended to get there faster, and missing one day
              made no real difference.
            </Txt>
            <Txt variant="small" c={color.textFaint}>
              This is an illustration built on those ranges, not a prediction for you or anyone. {SIM_RESEARCH.note}{" "}
              Source: {SIM_RESEARCH.source}.
            </Txt>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {children}
    </ScrollView>
  );
}

/** Every path as a line; the selected one bold; drag anywhere to pick a day. */
function FanChart({
  runs,
  selected,
  day,
  days,
  onScrub,
}: {
  runs: SimRun[];
  selected: number;
  day: number;
  days: number;
  onScrub: (day: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const x = (d: number) => PAD.left + ((d - 1) / Math.max(1, days - 1)) * innerW;
  const y = (a: number) => PAD.top + ((MAX_A - a) / (MAX_A - MIN_A)) * innerH;

  // The latest values, read by the gesture handler without rebuilding it.
  const live = useRef({ width, days, onScrub, last: day });
  live.current = { width, days, onScrub, last: live.current.last };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => scrub(e.nativeEvent.locationX),
        onPanResponderMove: (e) => scrub(e.nativeEvent.locationX),
      }),
    []
  );
  function scrub(px: number) {
    const { width: w, days: n, onScrub: cb } = live.current;
    const inner = Math.max(1, w - PAD.left - PAD.right);
    const d = Math.max(1, Math.min(n, Math.round(((px - PAD.left) / inner) * (n - 1)) + 1));
    if (d !== live.current.last) {
      live.current.last = d;
      if (d % 7 === 0) void Haptics.selectionAsync();
      cb(d);
    }
  }

  const paths = useMemo(
    () =>
      width
        ? runs.map((r) =>
            r.days.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.automaticity).toFixed(1)}`).join(" ")
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, width, days]
  );

  const median = SIM_RESEARCH.medianDays;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: CHART_HEIGHT, marginTop: space.md }}
      {...pan.panHandlers}
    >
      {width ? (
        <Svg width={width} height={CHART_HEIGHT}>
          {/* Feels automatic */}
          <Line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(SIM_AUTOMATIC_AT)}
            y2={y(SIM_AUTOMATIC_AT)}
            stroke={color.borderStrong}
            strokeDasharray="4 5"
          />
          <SvgText x={PAD.left + 2} y={y(SIM_AUTOMATIC_AT) - 5} fill={color.textFaint} fontSize={10}>
            Feels automatic
          </SvgText>
          {/* The study's middle person */}
          {median <= days ? (
            <>
              <Line x1={x(median)} x2={x(median)} y1={PAD.top} y2={CHART_HEIGHT - PAD.bottom} stroke={color.border} />
              <SvgText x={x(median)} y={CHART_HEIGHT - 6} fill={color.textFaint} fontSize={10} textAnchor="middle">
                Day {median}: study median
              </SvgText>
            </>
          ) : null}

          {paths.map((d, i) =>
            i === selected ? null : (
              <Path key={i} d={d} stroke={tint(PATH_COLORS[i], 0.35)} strokeWidth={1.5} fill="none" />
            )
          )}
          {paths[selected] ? (
            <Path d={paths[selected]} stroke={PATH_COLORS[selected]} strokeWidth={3} fill="none" strokeLinecap="round" />
          ) : null}

          {/* Today */}
          <Line x1={x(day)} x2={x(day)} y1={PAD.top} y2={CHART_HEIGHT - PAD.bottom} stroke={color.textMuted} strokeWidth={1} />
          {runs.map((r, i) => {
            const p = r.days[Math.min(day, r.days.length) - 1];
            return (
              <Circle
                key={r.path.id}
                cx={x(day)}
                cy={y(p.automaticity)}
                r={i === selected ? 6 : 3}
                fill={i === selected ? PATH_COLORS[i] : tint(PATH_COLORS[i], 0.7)}
                stroke={i === selected ? color.bg : "none"}
                strokeWidth={2}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

function PathSummary({ run, day, accent }: { run: SimRun; day: number; accent: string }) {
  const p = run.days[Math.min(day, run.days.length) - 1];
  const reached = run.automaticDay !== null && run.automaticDay <= day;
  const status = reached
    ? `Felt automatic on day ${run.automaticDay}.`
    : run.automaticDay !== null
      ? "Still building. That's normal at this point."
      : `Still building at day ${run.days.length}, and still going. Some people take longer than this.`;
  const sofar = run.days.slice(0, day);
  const count = (o: SimDay["outcome"]) => sofar.filter((d) => d.outcome === o).length;
  return (
    <Card accent={accent}>
      <Txt variant="bodyStrong">{run.path.name}</Txt>
      <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
        {run.path.blurb}
      </Txt>
      <Txt variant="body" style={{ marginTop: space.md }}>
        {status}
      </Txt>
      <View style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}>
        <Stat label="Feels" value={`${p.automaticity.toFixed(1)} / 7`} />
        <Stat label="Full" value={String(count("full"))} />
        <Stat label="Tiny" value={String(count("tiny"))} />
        <Stat label="Missed" value={String(count("missed"))} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt variant="label" c={color.textFaint}>
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}

const OUTCOME = {
  full: { label: "Did it", icon: "checkmark-circle" },
  tiny: { label: "Tiny version", icon: "ellipse-outline" },
  missed: { label: "Missed", icon: "remove-circle-outline" },
} as const;

function DayCard({ day, accent, onStep }: { day: SimDay; accent: string; onStep: (delta: number) => void }) {
  const outcome = OUTCOME[day.outcome];
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <StepButton icon="chevron-back" onPress={() => onStep(-1)} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Txt variant="bodyStrong">Day {day.day}</Txt>
          <Txt variant="small" c={color.textFaint}>
            {formatDate(day.date)}
          </Txt>
        </View>
        <StepButton icon="chevron-forward" onPress={() => onStep(1)} />
      </View>

      {day.milestone ? (
        <Animated.View
          key={`${day.date}-m`}
          entering={FadeIn.duration(200)}
          style={{
            marginTop: space.md,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: tint(accent, 0.12),
          }}
        >
          <Txt variant="small" c={accent}>
            {day.milestone}
          </Txt>
        </Animated.View>
      ) : null}

      {day.events.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md }}>
          {day.events.map((e) => (
            <View
              key={e.label}
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                borderRadius: radius.sm,
                backgroundColor: tint(color.blue, 0.12),
              }}
            >
              <Txt variant="small" c={color.blue} style={{ fontSize: 11 }}>
                {e.label}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Moment icon="sunny-outline" tint={color.amber} label="Morning" text={day.morning} />
        <Moment icon="moon-outline" tint={color.purple} label="Night" text={day.night} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.lg }}>
        <Ionicons name={outcome.icon} size={14} color={day.outcome === "missed" ? color.textFaint : accent} />
        <Txt variant="small" c={color.textMuted}>
          {outcome.label}
        </Txt>
      </View>
    </Card>
  );
}

function Moment({
  icon,
  tint: c,
  label,
  text,
}: {
  icon: "sunny-outline" | "moon-outline";
  tint: string;
  label: string;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      <Ionicons name={icon} size={18} color={c} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Txt variant="label" c={color.textFaint}>
          {label}
        </Txt>
        <Txt variant="body">{text}</Txt>
      </View>
    </View>
  );
}

function StepButton({ icon, onPress }: { icon: "chevron-back" | "chevron-forward"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: color.surfaceAlt }}
    >
      <Ionicons name={icon} size={18} color={color.text} />
    </Pressable>
  );
}
