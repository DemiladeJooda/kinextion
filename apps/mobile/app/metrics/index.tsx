/**
 * Your connected data, made visible.
 *
 * `/api/integrations/metrics` has been returning real readings since the
 * wearable OAuth shipped, and nothing rendered them — so connecting a ring or
 * a watch changed the pattern engine's inputs and nothing the user could see.
 * This is the screen that closes that: every metric a connected provider has
 * sent, per day, with what it's actually doing over the window.
 *
 * Three things it deliberately doesn't do:
 *   - colour a metric good or bad when the direction genuinely depends on the
 *     person (see METRIC_META.higherIsBetter being null for resting heart rate);
 *   - report a trend from two readings;
 *   - draw through gaps, which would invent days the device never recorded.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { METRIC_META } from "@kinextion/shared";

import { MetricChart, type MetricPoint } from "../../components/MetricChart";
import {
  AuroraBackdrop,
  Button,
  Card,
  Chip,
  EmptyState,
  Label,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type { RemoteWearableMetric } from "../../services";
import { color, radius, space, tint } from "../../theme";

const WINDOWS = [
  { days: 14, label: "2 weeks" },
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
] as const;

/** Minimum readings before a change is described as a trend rather than shown. */
const MIN_TREND_POINTS = 5;

const PROVIDER_ACCENT: Record<string, string> = {
  strava: color.amber,
  whoop: color.red,
  oura: color.purple,
  google_calendar: color.blue,
  outlook_calendar: color.teal,
};

const PROVIDER_LABEL: Record<string, string> = {
  strava: "Strava",
  whoop: "Whoop",
  oura: "Oura",
  google_calendar: "Google Calendar",
  outlook_calendar: "Outlook",
};

/** Minutes-from-midnight rendered as a clock time. */
function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatValue(value: number, unit: string): string {
  if (unit === "clock") return clock(value);
  if (unit === "min" && value >= 60) {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return unit && unit !== "min"
    ? `${rounded} ${unit}`
    : unit === "min"
      ? `${rounded} min`
      : `${rounded}`;
}

interface Series {
  metricType: string;
  provider: string;
  points: MetricPoint[];
  latest: MetricPoint;
  average: number;
  /** Second-half mean minus first-half mean, or null when it's too thin to say. */
  change: number | null;
}

/**
 * Trend as the difference between the two halves of the window, rather than
 * first-vs-last. One unusual night's sleep shouldn't be able to report a
 * collapse — comparing halves needs a sustained move to shift the number.
 */
function buildSeries(metrics: RemoteWearableMetric[]): Series[] {
  const grouped = new Map<string, RemoteWearableMetric[]>();
  for (const m of metrics) {
    const key = `${m.provider}:${m.metricType}`;
    const list = grouped.get(key) ?? [];
    list.push(m);
    grouped.set(key, list);
  }

  const series: Series[] = [];
  for (const [key, list] of grouped) {
    const [provider, metricType] = key.split(":");
    const points = list
      .map((m) => ({ date: m.date.slice(0, 10), value: m.value }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) continue;

    const values = points.map((p) => p.value);
    const average = values.reduce((s, v) => s + v, 0) / values.length;

    let change: number | null = null;
    if (points.length >= MIN_TREND_POINTS) {
      const mid = Math.floor(points.length / 2);
      const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
      change = mean(values.slice(mid)) - mean(values.slice(0, mid));
    }

    series.push({
      metricType,
      provider,
      points,
      latest: points[points.length - 1],
      average,
      change,
    });
  }

  // Body metrics before calendar ones, then alphabetically, so the list order
  // doesn't shuffle as providers sync at different times.
  return series.sort((a, b) => {
    const groupA = METRIC_META[a.metricType]?.group ?? "body";
    const groupB = METRIC_META[b.metricType]?.group ?? "body";
    if (groupA !== groupB) return groupA === "body" ? -1 : 1;
    return a.metricType.localeCompare(b.metricType);
  });
}

export default function MetricsScreen() {
  const api = useApi();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [metrics, setMetrics] = useState<RemoteWearableMetric[] | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [days, setDays] = useState<number>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (windowDays: number) => {
    const from = new Date();
    from.setDate(from.getDate() - windowDays);

    try {
      const [rows, integrations] = await Promise.all([
        api.listMetrics({ from: from.toISOString().slice(0, 10) }),
        api.listIntegrations(),
      ]);
      setMetrics(rows);
      setConnected(
        integrations.integrations.filter((i) => i.status === "connected").map((i) => i.provider)
      );
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(days).finally(() => setRefreshing(false));
  }, [load, days]);

  const series = useMemo(() => buildSeries(metrics ?? []), [metrics]);
  // Card padding (space.xl each side) plus the card's own inner padding.
  const chartWidth = Math.max(200, width - space.xl * 2 - space.xl * 2);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Your data",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.teal} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.textFaint}
          />
        }
      >
        <ScreenHeader
          title="Your data"
          subtitle="Everything your connected apps have sent, day by day."
        />

        <View
          style={{
            flexDirection: "row",
            gap: space.sm,
            marginBottom: space.lg,
          }}
        >
          {WINDOWS.map((w) => (
            <Chip
              key={w.days}
              label={w.label}
              accent={color.teal}
              selected={days === w.days}
              onPress={() => setDays(w.days)}
            />
          ))}
        </View>

        {failed ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load your data"
            body="Pull down to try again."
            accent={color.amber}
          />
        ) : metrics === null ? null : connected.length === 0 ? (
          <View style={{ gap: space.lg }}>
            <EmptyState
              icon="watch-outline"
              title="Nothing connected yet"
              body="Connect Strava, Whoop, Oura or a calendar in Profile and their readings show up here."
              accent={color.teal}
            />
            <Button
              label="Go to connections"
              variant="secondary"
              accent={color.teal}
              onPress={() => router.push("/(tabs)/profile" as never)}
            />
          </View>
        ) : series.length === 0 ? (
          <EmptyState
            icon="hourglass-outline"
            title="Connected, but nothing synced yet"
            body="Hit sync on a provider in Profile, or give it a day — most providers only publish yesterday's numbers."
            accent={color.teal}
          />
        ) : (
          <View style={{ gap: space.md }}>
            {series.map((s, i) => (
              <Animated.View
                key={`${s.provider}-${s.metricType}`}
                entering={FadeInDown.duration(400).delay(Math.min(i, 8) * 60)}
              >
                <SeriesCard series={s} width={chartWidth} windowDays={days} />
              </Animated.View>
            ))}

            <View
              style={{
                flexDirection: "row",
                gap: space.sm,
                marginTop: space.md,
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={color.textFaint}
                style={{ marginTop: 2 }}
              />
              <Txt variant="small" c={color.textFaint} style={{ flex: 1, fontSize: 12 }}>
                Readings come straight from each provider. Days without a reading are left blank
                rather than filled in, and a change is only called out once there are at least{" "}
                {MIN_TREND_POINTS} readings to compare.
              </Txt>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeriesCard({
  series,
  width,
  windowDays,
}: {
  series: Series;
  width: number;
  windowDays: number;
}) {
  const meta = METRIC_META[series.metricType] ?? {
    label: series.metricType,
    unit: "",
    higherIsBetter: null as boolean | null,
    group: "body" as const,
  };
  const accent = PROVIDER_ACCENT[series.provider] ?? color.teal;

  /**
   * Direction is coloured only where direction has a meaning. For resting
   * heart rate — where `higherIsBetter` is null — the change is shown as a
   * neutral fact, because the app can't know which way is good for this body.
   */
  const changeTone =
    series.change === null || meta.higherIsBetter === null
      ? color.textMuted
      : series.change > 0 === meta.higherIsBetter
        ? color.green
        : color.amber;

  const changeLabel =
    series.change === null
      ? null
      : `${series.change > 0 ? "▲" : series.change < 0 ? "▼" : "–"} ${formatValue(
          Math.abs(series.change),
          meta.unit === "clock" ? "min" : meta.unit
        )}`;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Label>{meta.label}</Label>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: space.sm,
              marginTop: 4,
            }}
          >
            <Txt variant="title">{formatValue(series.latest.value, meta.unit)}</Txt>
            {changeLabel ? (
              <Txt variant="small" c={changeTone}>
                {changeLabel}
              </Txt>
            ) : null}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: space.sm,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: tint(accent, 0.12),
          }}
        >
          <Txt variant="label" c={accent} style={{ fontSize: 9 }}>
            {PROVIDER_LABEL[series.provider] ?? series.provider}
          </Txt>
        </View>
      </View>

      <View style={{ marginTop: space.md }}>
        <MetricChart points={series.points} accent={accent} width={width} />
      </View>

      <View style={{ flexDirection: "row", marginTop: space.sm }}>
        <Txt variant="small" c={color.textFaint} style={{ flex: 1, fontSize: 11 }}>
          {series.points.length} reading{series.points.length === 1 ? "" : "s"} in {windowDays} days
        </Txt>
        <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
          avg {formatValue(series.average, meta.unit)}
        </Txt>
      </View>

      {series.points.length < MIN_TREND_POINTS ? (
        <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm, fontSize: 11 }}>
          Not enough readings yet to say which way this is going.
        </Txt>
      ) : null}
    </Card>
  );
}
