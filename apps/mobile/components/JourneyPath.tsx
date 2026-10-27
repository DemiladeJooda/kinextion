/**
 * Onboarding's "this is a journey" moment.
 *
 * One path, theirs, drawn bright and winding: it climbs, falls back in a hard
 * week, flattens through a slow middle, and only then starts to feel like
 * them. Behind it, faint, other people's paths (from the habit simulator)
 * take their own routes to the same place. As the path reaches each moment,
 * the matching line below lights up, so the screen reads as a story rather
 * than a chart: everyone's way there is different, and up-and-down is how it
 * normally goes.
 */

import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { DEMO_HABITS, EXAMPLE_LIVES, localDateKey, simulateAll } from "@kinextion/shared";

import { Txt } from "./ui";
import { color, radius, space, tint } from "../theme";

const HEIGHT = 170;
const PAD = 12;
const SAMPLES = 120;
/** Where "it feels like you" starts, as a share of the height. */
const ARRIVED = 0.72;

/** Their path, as (progress, how far along) pairs; eased between. */
const KEYS: [number, number][] = [
  [0, 0.06],
  [0.13, 0.3],
  [0.22, 0.36],
  [0.32, 0.14],
  [0.43, 0.3],
  [0.54, 0.38],
  [0.66, 0.41],
  [0.74, 0.34],
  [0.87, 0.68],
  [1, 0.86],
];

const MOMENTS = [
  { at: 0, title: "Day one", body: "You start exactly as you are. That's enough." },
  { at: 0.32, title: "A hard week", body: "Life gets in the way. A missed day doesn't send you back to zero." },
  { at: 0.62, title: "The slow middle", body: "Progress you can't see yet is still progress." },
  { at: 0.95, title: "It becomes you", body: "One day it stops feeling like effort. It's just who you are." },
] as const;

/** Cosine-eased height of their path at progress t (0–1). */
function along(t: number): number {
  const i = Math.max(0, KEYS.findIndex(([k]) => k >= t) - 1);
  const [t0, a0] = KEYS[i];
  const [t1, a1] = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  return a0 + (a1 - a0) * ((1 - Math.cos(Math.PI * f)) / 2);
}

export function JourneyPath() {
  const [width, setWidth] = useState(0);
  const [progress, setProgress] = useState(0);

  const others = useMemo(() => {
    const runs = simulateAll({ habit: DEMO_HABITS[1], life: EXAMPLE_LIVES[2], start: localDateKey(), days: 90 });
    // Automaticity runs 1–7; drawn on the same scale as their path.
    return runs.map((r) => r.days.map((d) => [(d.day - 1) / 89, 0.06 + ((d.automaticity - 1) / 6) * 0.8] as const));
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setProgress((p) => (p >= 1 ? (clearInterval(timer), 1) : Math.min(1, p + 0.01))),
      40
    );
    return () => clearInterval(timer);
  }, []);

  const x = (t: number) => PAD + t * (width - PAD * 2);
  const y = (a: number) => HEIGHT - PAD - a * (HEIGHT - PAD * 2);
  const line = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([t, a], j) => `${j ? "L" : "M"}${x(t).toFixed(1)} ${y(a).toFixed(1)}`).join(" ");

  const mine = Array.from({ length: Math.round(progress * SAMPLES) + 1 }, (_, i) => {
    const t = i / SAMPLES;
    return [t, along(t)] as const;
  });
  const head = mine[mine.length - 1];
  const done = progress >= 1;

  return (
    <View style={{ gap: space.lg }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        accessible
        accessibilityLabel="A winding path that rises, dips in a hard week, flattens, then climbs until the habit feels like part of you. Fainter paths behind it show other people taking their own routes."
      >
        {width ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="journey" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={color.purple} />
                <Stop offset="1" stopColor={color.green} />
              </LinearGradient>
            </Defs>
            <Line
              x1={PAD}
              x2={width - PAD}
              y1={y(ARRIVED)}
              y2={y(ARRIVED)}
              stroke={color.borderStrong}
              strokeDasharray="3 6"
            />
            <SvgText x={width - PAD} y={y(ARRIVED) - 6} fill={color.textFaint} fontSize={10} textAnchor="end">
              Feels like you
            </SvgText>
            {others.map((pts, i) => (
              <Path
                key={i}
                d={line(pts.filter(([t]) => t <= progress))}
                stroke={tint(color.text, 0.12)}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
              />
            ))}
            <Path d={line(mine)} stroke="url(#journey)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {MOMENTS.map((m) =>
              m.at <= progress ? (
                <Circle key={m.title} cx={x(m.at)} cy={y(along(m.at))} r={4} fill={color.bg} stroke={color.text} strokeWidth={1.5} />
              ) : null
            )}
            <Circle cx={x(head[0])} cy={y(head[1])} r={10} fill={tint(color.green, 0.18)} />
            <Circle cx={x(head[0])} cy={y(head[1])} r={5} fill={color.green} />
          </Svg>
        ) : null}
      </View>

      <View style={{ gap: space.md }}>
        {MOMENTS.map((m, i) => {
          const reached = progress >= m.at;
          return (
            <View key={m.title} style={{ flexDirection: "row", gap: space.md, opacity: reached ? 1 : 0.3 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: reached ? color.text : color.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                <Txt variant="mono" c={color.text}>
                  {i + 1}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="bodyStrong">{m.title}</Txt>
                <Txt variant="small" c={color.textMuted}>
                  {m.body}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>

      <Txt variant="small" c={color.textMuted} style={{ opacity: done ? 1 : 0 }}>
        Your path won't look like anyone else's, and it doesn't need to. Your guides walk it with you, at your pace.
      </Txt>
    </View>
  );
}
