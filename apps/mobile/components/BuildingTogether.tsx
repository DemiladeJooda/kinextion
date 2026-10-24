/**
 * What a community is building together this week.
 *
 * Each shared habit with its owner's name, their plan, and seven dots for
 * this week. Nothing is counted up, ranked or compared — your own row comes
 * first, everyone else by name. The point is company, not competition.
 */

import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Card, SectionTitle, Txt } from "./ui";
import { useApi } from "../hooks/useApi";
import type { SharedHabitRow, WeekDot } from "../services";
import { color, space, tint } from "../theme";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function BuildingTogether({ communityId }: { communityId: string }) {
  const api = useApi();
  const [rows, setRows] = useState<SharedHabitRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .getSharedHabits(communityId)
        .then((r) => setRows(r.rows))
        .catch(() => setRows(null));
    }, [api, communityId])
  );

  if (rows === null) return null;
  return (
    <>
      <SectionTitle accent={color.teal}>Building together</SectionTitle>
      {rows.length === 0 ? (
        <Card>
          <Txt variant="small" c={color.textMuted}>
            Nobody&apos;s shared a habit here yet. Open one of yours and choose &quot;Build it with your
            community&quot; to be the first.
          </Txt>
        </Card>
      ) : (
        <Card>
          <View style={{ gap: space.lg }}>
            {rows.map((r) => (
              <View key={r.habitId} style={{ gap: space.xs }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
                  <Txt variant="bodyStrong">{r.habit}</Txt>
                  <Txt variant="small" c={color.textFaint}>
                    {r.mine ? "You" : r.member}
                    {r.paused ? " · away" : ""}
                  </Txt>
                </View>
                <Txt variant="small" c={color.textMuted} numberOfLines={1}>
                  {r.plan}
                </Txt>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                  {r.week.map((d, i) => (
                    <Dot key={i} dot={d} letter={DAY_LETTERS[i]} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

function Dot({ dot, letter }: { dot: WeekDot; letter: string }) {
  const fill =
    dot === "done" ? color.teal : dot === "minimum" ? tint(color.teal, 0.45) : dot === "rest" ? tint(color.blue, 0.3) : "transparent";
  const border = dot === "future" ? color.border : dot === "none" ? color.borderStrong : fill;
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: fill, borderWidth: 1, borderColor: border }} />
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 9, lineHeight: 11 }}>
        {letter}
      </Txt>
    </View>
  );
}
