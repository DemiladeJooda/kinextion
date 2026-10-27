/**
 * "Your numbers": the past seven days of body data at a glance, and what's
 * worth noticing about it.
 *
 * Every connected source feeds the same tiles (Oura, WHOOP, Strava, Apple
 * Health, Health Connect), plus what the user logs themselves: workouts and
 * mood. Each tile shows the week's figure, the change on the week before
 * (only when both weeks have enough readings), and the seven days as bars,
 * with missing days left visibly empty rather than drawn as zero.
 *
 * Below the tiles, plain-language insights: week-on-week changes worked out
 * here (`weekInsights`) and the server's longer-range patterns. Metrics
 * nobody has sent yet are listed once, as what connecting would add, rather
 * than as a wall of empty tiles.
 */

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  METRIC_META,
  MIN_WEEK_READINGS,
  addDays,
  formatMinutes,
  localDateKey,
  summarizeWeeks,
  weekInsights,
  type DailyReading,
  type WeekStat,
} from "@kinextion/shared";

import { Card, Txt } from "./ui";
import { useApi } from "../hooks/useApi";
import { sampleHealth, showsSampleHealth } from "../lib/sample-health";
import { color, radius, space, tint } from "../theme";

type Icon = keyof typeof Ionicons.glyphMap;

interface Tile {
  key: string;
  label: string;
  icon: Icon;
  accent: string;
  /** The stat behind the tile, and its partner for blood pressure. */
  stat: WeekStat;
  pair?: WeekStat;
  value: string;
  /** What the figure is: "a day", "a night", "this week". */
  per: string;
}

const thousands = (n: number) => Math.round(n).toLocaleString("en-US");

/** The tiles in the order shown, each with how its figure reads. */
const TILES: {
  key: string;
  label: string;
  icon: Icon;
  accent: string;
  per: string;
  format: (v: number, pair?: number) => string;
  pairWith?: string;
}[] = [
  { key: "resting_heart_rate", label: "Resting heart rate", icon: "heart", accent: color.red, per: "avg", format: (v) => `${Math.round(v)} bpm` },
  {
    key: "blood_pressure_systolic",
    label: "Blood pressure",
    icon: "pulse",
    accent: color.pink,
    per: "avg",
    pairWith: "blood_pressure_diastolic",
    format: (v, d) => `${Math.round(v)}/${Math.round(d ?? 0)}`,
  },
  { key: "steps", label: "Steps", icon: "footsteps", accent: color.green, per: "a day", format: (v) => thousands(v) },
  { key: "sleep_duration", label: "Sleep", icon: "moon", accent: color.blue, per: "a night", format: (v) => formatMinutes(v) },
  { key: "hrv", label: "HRV", icon: "analytics", accent: color.purple, per: "avg", format: (v) => `${Math.round(v)} ms` },
  { key: "readiness", label: "Readiness", icon: "battery-charging", accent: color.teal, per: "avg", format: (v) => `${Math.round(v)}` },
  { key: "recovery", label: "Recovery", icon: "battery-charging", accent: color.teal, per: "avg", format: (v) => `${Math.round(v)}%` },
  { key: "sleep_score", label: "Sleep score", icon: "bed", accent: color.blue, per: "avg", format: (v) => `${Math.round(v)}` },
  { key: "active_calories", label: "Active calories", icon: "flame", accent: color.amber, per: "a day", format: (v) => thousands(v) },
  { key: "weight", label: "Weight", icon: "body", accent: color.textMuted, per: "avg", format: (v) => `${v.toFixed(1)} kg` },
  { key: "mood", label: "Mood", icon: "happy", accent: color.pink, per: "avg", format: (v) => `${v.toFixed(1)}/10` },
];

/** What connecting a source would add, named the way people say it. */
const WANTED: { keys: string[]; label: string }[] = [
  { keys: ["resting_heart_rate", "hrv"], label: "Heart rate" },
  { keys: ["blood_pressure_systolic"], label: "Blood pressure" },
  { keys: ["sleep_duration", "sleep_score"], label: "Sleep" },
  { keys: ["steps"], label: "Steps" },
];

const INSIGHT_ICON: Record<string, { icon: Icon; accent: string }> = {
  sleep_duration: { icon: "moon", accent: color.blue },
  steps: { icon: "footsteps", accent: color.green },
  resting_heart_rate: { icon: "heart", accent: color.red },
  hrv: { icon: "analytics", accent: color.purple },
  blood_pressure_systolic: { icon: "pulse", accent: color.pink },
  weight: { icon: "body", accent: color.textMuted },
  mood: { icon: "happy", accent: color.pink },
  workout: { icon: "barbell", accent: color.amber },
};

interface Loaded {
  stats: Record<string, WeekStat>;
  workouts: { days: number[]; count: number; previousCount: number; minutes: number };
  insights: { key: string; text: string; icon: Icon; accent: string }[];
  /** Showing sample numbers because nothing is connected yet (development only). */
  sample: boolean;
}

export function YourNumbers({ onSeeAll, onConnect }: { onSeeAll: () => void; onConnect: () => void }) {
  const api = useApi();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    const todayKey = localDateKey();
    const from = addDays(todayKey, -14);
    void (async () => {
      const integrations = await api.listIntegrations().catch(() => null);
      const sample = integrations ? showsSampleHealth(integrations.integrations) : false;
      const [metrics, realWorkouts, realMoods, patterns] = await Promise.all([
        (sample ? sampleHealth.metrics({ from }) : api.listMetrics({ from })).catch(() => []),
        api.listWorkouts(40).catch(() => []),
        api.listMoodEntries(30).catch(() => []),
        (sample ? sampleHealth.patterns() : api.listPatterns()).catch(() => []),
      ]);
      // What they've really logged always wins; samples only fill a blank.
      const logged = sample && realWorkouts.length === 0 ? await sampleHealth.workouts(40) : realWorkouts;
      const moods = sample && realMoods.length === 0 ? await sampleHealth.moods(30) : realMoods;

      const readings: DailyReading[] = [
        ...metrics.map((m) => ({ metricType: m.metricType, date: m.date.slice(0, 10), value: m.value })),
        ...moods.map((m) => ({ metricType: "mood", date: localDateKey(new Date(m.createdAt)), value: m.mood })),
      ];
      const stats = summarizeWeeks(readings, todayKey);

      // Sessions per day: what they logged, plus a tracked workout on a day
      // with no log (so a synced run counts once, not twice).
      const perDay = new Map<string, number>();
      for (const w of logged) {
        const key = localDateKey(new Date(w.createdAt));
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }
      const tracked = metrics.filter((m) => m.metricType === "workout" && m.value > 0);
      for (const m of tracked) {
        const key = m.date.slice(0, 10);
        if (!perDay.has(key)) perDay.set(key, 1);
      }
      const count = (offsets: number[]) => offsets.reduce((s, o) => s + (perDay.get(addDays(todayKey, o)) ?? 0), 0);
      const thisWeek = Array.from({ length: 7 }, (_, i) => i - 6);
      const minutes =
        logged
          .filter((w) => localDateKey(new Date(w.createdAt)) >= addDays(todayKey, -6))
          .reduce((s, w) => s + (w.duration ?? 0), 0) || (stats.workout?.value ?? 0) * (stats.workout?.readings ?? 0);
      const workouts = {
        days: thisWeek.map((o) => perDay.get(addDays(todayKey, o)) ?? 0),
        count: count(thisWeek),
        previousCount: count(thisWeek.map((o) => o - 7)),
        minutes,
      };

      const local = weekInsights(stats, workouts, todayKey).map((i) => ({
        key: i.text,
        text: i.text,
        ...(INSIGHT_ICON[i.metricType] ?? { icon: "sparkles" as Icon, accent: color.teal }),
      }));
      const longer = patterns.map((p) => ({ key: p.summary, text: p.summary, icon: "git-compare" as Icon, accent: color.pink }));
      setData({ stats, workouts, insights: [...local.slice(0, 4), ...longer.slice(0, 2)], sample });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;

  const tiles: Tile[] = TILES.flatMap((t) => {
    const stat = data.stats[t.key];
    const pair = t.pairWith ? data.stats[t.pairWith] : undefined;
    if (!stat || stat.value === null || (t.pairWith && pair?.value == null)) return [];
    return [{ ...t, stat, pair, value: t.format(stat.value, pair?.value ?? undefined) }];
  });
  const missing = WANTED.filter((w) => !w.keys.some((k) => data.stats[k]?.value != null));
  const { workouts } = data;
  const hasWorkouts = workouts.count > 0 || workouts.previousCount > 0;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Txt variant="small" c={color.textFaint}>
            Past 7 days
          </Txt>
          {data.sample ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: tint(color.amber, 0.16) }}>
              <Txt variant="small" c={color.amber} style={{ fontSize: 11, fontWeight: "700" }}>
                Sample data
              </Txt>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
          <Txt variant="small" c={color.blue} style={{ fontWeight: "700" }}>
            All your data →
          </Txt>
        </Pressable>
      </View>

      {tiles.length > 0 || hasWorkouts ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
          {hasWorkouts ? (
            <TileCard
              label="Workouts"
              icon="barbell"
              accent={color.amber}
              value={String(workouts.count)}
              per={workouts.minutes > 0 ? `this week · ${formatMinutes(workouts.minutes)}` : "this week"}
              change={changeText(workouts.count, workouts.previousCount, true, (d) => `${Math.abs(d)} ${d > 0 ? "more" : "fewer"} than last week`)}
              bars={workouts.days}
            />
          ) : null}
          {tiles.map((t) => (
            <TileCard
              key={t.key}
              label={t.label}
              icon={t.icon}
              accent={t.accent}
              value={t.value}
              per={t.per}
              change={statChange(t.key, t.stat)}
              bars={t.stat.days}
            />
          ))}
        </View>
      ) : null}

      {data.sample || missing.length > 0 ? (
        <Pressable onPress={onConnect} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <Ionicons name="link" size={18} color={color.teal} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="bodyStrong">
                {data.sample
                  ? "These are sample numbers"
                  : tiles.length === 0 && !hasWorkouts
                    ? "Bring your numbers in"
                    : `Add ${listOf(missing.map((m) => m.label.toLowerCase()))}`}
              </Txt>
              <Txt variant="small" c={color.textMuted}>
                {data.sample
                  ? "Connect Apple Health, Oura, WHOOP or another source in Profile and your own replace them."
                  : "Connect Apple Health, Health Connect, Oura or WHOOP in Profile, and they show up here."}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
          </Card>
        </Pressable>
      ) : null}

      {data.insights.length > 0 ? (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Txt variant="bodyStrong">What we&apos;re noticing</Txt>
          <Card>
            <View style={{ gap: space.lg }}>
              {data.insights.map((i) => (
                <View key={i.key} style={{ flexDirection: "row", gap: space.md }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.pill,
                      backgroundColor: tint(i.accent, 0.14),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={i.icon} size={14} color={i.accent} />
                  </View>
                  <Txt variant="small" c={color.text} style={{ flex: 1, marginTop: 4 }}>
                    {i.text}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
          <Txt variant="small" c={color.textFaint}>
            Patterns in your own data, not medical advice.
          </Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** "a, b and c" */
function listOf(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

interface Change {
  text: string;
  /** Null where up or down isn't good or bad, so it isn't coloured. */
  good: boolean | null;
  up: boolean;
}

function changeText(value: number, previous: number, higherIsBetter: boolean | null, say: (diff: number) => string): Change | null {
  const diff = value - previous;
  if (diff === 0) return null;
  return { text: say(diff), good: higherIsBetter === null ? null : diff > 0 === higherIsBetter, up: diff > 0 };
}

/** The week-on-week change for a tile, or null when either week is too thin. */
function statChange(key: string, s: WeekStat): Change | null {
  if (s.value === null || s.previous === null || s.readings < MIN_WEEK_READINGS || s.previousReadings < MIN_WEEK_READINGS) {
    return null;
  }
  const better = key === "mood" ? true : (METRIC_META[key]?.higherIsBetter ?? null);
  const pct = s.previous ? ((s.value - s.previous) / s.previous) * 100 : 0;
  if (Math.abs(pct) < 2) return { text: "steady", good: null, up: false };
  return changeText(s.value, s.previous, better, () => `${Math.round(Math.abs(pct))}% vs last week`);
}

function TileCard({
  label,
  icon,
  accent,
  value,
  per,
  change,
  bars,
}: {
  label: string;
  icon: Icon;
  accent: string;
  value: string;
  per: string;
  change: Change | null;
  bars: (number | null)[];
}) {
  const max = Math.max(...bars.map((b) => b ?? 0), 0);
  const changeColor = !change || change.good === null ? color.textMuted : change.good ? color.green : color.amber;
  return (
    <Card style={{ flexBasis: "46%", flexGrow: 1, gap: space.sm, padding: space.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={14} color={accent} />
        <Txt variant="small" c={color.textMuted} style={{ fontSize: 12 }} numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <View>
        <Txt variant="heading">{value}</Txt>
        <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
          {per}
        </Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 28 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {bars.map((b, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: b === null || max === 0 ? 3 : Math.max(4, (b / max) * 28),
              borderRadius: 2,
              backgroundColor: b === null ? color.border : i === bars.length - 1 ? accent : tint(accent, 0.45),
            }}
          />
        ))}
      </View>
      {change ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {change.text !== "steady" ? <Ionicons name={change.up ? "arrow-up" : "arrow-down"} size={11} color={changeColor} /> : null}
          <Txt variant="small" c={changeColor} style={{ fontSize: 12 }} numberOfLines={1}>
            {change.text}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}
