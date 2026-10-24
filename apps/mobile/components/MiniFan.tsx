/**
 * Six people, one habit, 90 days — drawn in about four seconds.
 *
 * The onboarding version of the simulator: no controls, it just plays once.
 * The lines spread out as they go, some reaching "feels automatic" in a few
 * weeks and some still climbing at the end, which is the whole message:
 * there's more than one way there, and slow isn't failing.
 */

import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import { DEMO_HABITS, EXAMPLE_LIVES, SIM_AUTOMATIC_AT, localDateKey, simulateAll } from "@kinextion/shared";

import { Txt } from "./ui";
import { color, space, tint } from "../theme";

const COLORS = [color.green, color.teal, color.blue, color.purple, color.amber, color.pink];
const DAYS = 90;
const HEIGHT = 150;
const PAD = 8;

export function MiniFan() {
  const [width, setWidth] = useState(0);
  const [day, setDay] = useState(1);
  const runs = useMemo(
    () => simulateAll({ habit: DEMO_HABITS[1], life: EXAMPLE_LIVES[2], start: localDateKey(), days: DAYS }),
    []
  );

  useEffect(() => {
    const t = setInterval(() => setDay((d) => (d >= DAYS ? (clearInterval(t), d) : d + 2)), 45);
    return () => clearInterval(t);
  }, []);

  const x = (d: number) => PAD + ((d - 1) / (DAYS - 1)) * (width - PAD * 2);
  const y = (a: number) => PAD + ((7 - a) / 6) * (HEIGHT - PAD * 2);
  const shown = Math.min(day, DAYS);
  const automatic = runs.filter((r) => r.automaticDay !== null && r.automaticDay <= shown).length;

  return (
    <View style={{ gap: space.md }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width ? (
          <Svg width={width} height={HEIGHT}>
            <Line x1={PAD} x2={width - PAD} y1={y(SIM_AUTOMATIC_AT)} y2={y(SIM_AUTOMATIC_AT)} stroke={color.borderStrong} strokeDasharray="4 5" />
            <SvgText x={PAD + 2} y={y(SIM_AUTOMATIC_AT) - 5} fill={color.textFaint} fontSize={10}>
              Feels automatic
            </SvgText>
            {runs.map((r, i) => (
              <Path
                key={r.path.id}
                d={r.days
                  .slice(0, shown)
                  .map((p, j) => `${j ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.automaticity).toFixed(1)}`)
                  .join(" ")}
                stroke={tint(COLORS[i], 0.85)}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <Txt variant="small" c={color.textMuted}>
        {shown < DAYS
          ? `Day ${shown}`
          : `Day 90: ${automatic} of ${runs.length} feel automatic. The rest are still going, and that's normal.`}
      </Txt>
    </View>
  );
}
