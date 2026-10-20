/**
 * A daily metric, drawn.
 *
 * Deliberately plain: an area under a line, a faint baseline, and an
 * emphasised final point. No axes furniture, no legend, no gridlines fighting
 * the data — at phone width the chart's whole job is to answer "is this going
 * up or down, and where am I today", and everything else is noise competing
 * with the number printed above it.
 *
 * Two rules it holds to:
 *   - Gaps are gaps. A day with no reading breaks the line rather than being
 *     interpolated into a value the device never recorded.
 *   - A single point isn't a trend, so it renders as a dot and the caller is
 *     expected to say so rather than drawing a flat line through one reading.
 */

import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from "react-native-svg";

import { color, tint } from "../theme";

export interface MetricPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

const HEIGHT = 72;
const PADDING = 4;

/**
 * Lay points out on a fixed day grid so a week with three readings shows three
 * readings spread across a week, not three evenly-spaced points implying daily
 * data. The x position is the day, not the index.
 */
function layout(points: MetricPoint[], width: number) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((p) => new Date(`${p.date}T00:00:00Z`).getTime());
  const minT = times[0];
  const maxT = times[times.length - 1];
  const spanT = Math.max(1, maxT - minT);

  const values = sorted.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would otherwise divide by zero and collapse to the top edge.
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);

  const innerW = width - PADDING * 2;
  const innerH = HEIGHT - PADDING * 2;

  return sorted.map((p, i) => ({
    ...p,
    x: PADDING + ((times[i] - minT) / spanT) * innerW,
    y: PADDING + innerH - ((p.value - min) / span) * innerH,
  }));
}

export function MetricChart({
  points,
  accent,
  width,
}: {
  points: MetricPoint[];
  accent: string;
  width: number;
}) {
  if (points.length === 0) return null;

  const laid = layout(points, width);
  const last = laid[laid.length - 1];
  const gradientId = `metric-${accent.replace(/[^a-z0-9]/gi, "")}`;

  // One reading is a fact, not a trajectory.
  if (laid.length === 1) {
    return (
      <Svg width={width} height={HEIGHT}>
        <Line
          x1={PADDING}
          y1={HEIGHT / 2}
          x2={width - PADDING}
          y2={HEIGHT / 2}
          stroke={color.border}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <Circle cx={width / 2} cy={HEIGHT / 2} r={4} fill={accent} />
      </Svg>
    );
  }

  const linePath = laid.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${last.x},${HEIGHT - PADDING} L${laid[0].x},${HEIGHT - PADDING} Z`;

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Baseline, so a rising line reads as rising from something. */}
        <Line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={width - PADDING}
          y2={HEIGHT - PADDING}
          stroke={color.border}
          strokeWidth={1}
        />

        <Path d={areaPath} fill={`url(#${gradientId})`} />
        <Path
          d={linePath}
          stroke={accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Today's reading, emphasised — the one point anyone looks for. */}
        <Circle cx={last.x} cy={last.y} r={5} fill={tint(accent, 0.25)} />
        <Circle cx={last.x} cy={last.y} r={3} fill={accent} />
      </Svg>
    </View>
  );
}
