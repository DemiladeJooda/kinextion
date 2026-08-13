/**
 * The Kinextion Score ring.
 *
 * This is the app's signature object and the thing the website can't do: a
 * live, breathing dial that animates from empty on every open, counts the
 * number up in step with the arc, and shifts hue with the score itself. The
 * arc and the count are driven from the same shared value so they can never
 * drift apart.
 */

import { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import { color, space, tint } from "../theme";
import { Txt } from "./ui";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Score bands. Colour communicates state before the number is even read. */
function bandFor(score: number): { from: string; to: string; label: string } {
  if (score >= 80) return { from: color.green, to: color.teal, label: "Dialled in" };
  if (score >= 60) return { from: color.teal, to: color.blue, label: "Holding steady" };
  if (score >= 35) return { from: color.amber, to: color.green, label: "Finding rhythm" };
  return { from: color.purple, to: color.blue, label: "Early days" };
}

export function ScoreRing({
  score,
  caption,
}: {
  /** 0–100, or null before the first habit is logged. */
  score: number | null;
  caption?: string;
}) {
  const target = score ?? 0;
  const band = bandFor(target);

  // Drives both the arc and the counter.
  const progress = useSharedValue(0);
  // Slow pulse on the outer halo so the dial reads as alive, not static.
  const breath = useSharedValue(0);

  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.value = withTiming(target, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
  }, [target, progress]);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [breath]);

  // Mirror the animated value into React state so the number can be rendered
  // as text. Rounded first, so this only crosses the bridge ~100 times.
  const rounded = useDerivedValue(() => Math.round(progress.value));
  useAnimatedReaction(
    () => rounded.value,
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplay)(current);
    }
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value / 100),
  }));

  const haloStyle = useAnimatedProps(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.16, 0.36]),
    r: interpolate(breath.value, [0, 1], [RADIUS + 8, RADIUS + 14]),
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgGradient id="scoreArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={band.from} />
            <Stop offset="1" stopColor={band.to} />
          </SvgGradient>
        </Defs>

        {/* Breathing halo */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          fill="none"
          stroke={band.from}
          strokeWidth={2}
          animatedProps={haloStyle}
        />

        {/* Track */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
          fill="none"
        />

        {/* Progress arc — starts at 12 o'clock */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="url(#scoreArc)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={arcProps}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      {/* Centre readout, absolutely positioned over the SVG */}
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {score === null ? (
          <>
            <Txt variant="display" c={color.textFaint} style={{ fontSize: 44 }}>
              —
            </Txt>
            <Txt variant="small" c={color.textFaint} style={{ marginTop: 2 }}>
              no score yet
            </Txt>
          </>
        ) : (
          <>
            <Txt
              variant="display"
              c={band.from}
              style={{ fontSize: 56, lineHeight: 62, letterSpacing: -2 }}
            >
              {display}
            </Txt>
            <View
              style={{
                paddingHorizontal: space.md,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: tint(band.from, 0.12),
                marginTop: 2,
              }}
            >
              <Txt variant="label" c={band.from}>
                {caption ?? band.label}
              </Txt>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
