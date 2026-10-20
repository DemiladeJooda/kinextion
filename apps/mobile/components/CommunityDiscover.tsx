/**
 * Community Discover — Netflix-style rows of what communities made public.
 *
 * Public, no-session data (same /api/discover a signed-out browser hits), so
 * this never shows anything from a room you're not in or a response someone
 * didn't choose to publish. One row per conversation: the question first,
 * the community it came from second — the point is the thought, not who's
 * popular.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";

import { useApi } from "../hooks/useApi";
import type { DiscoverRow } from "../services";
import { Label, PressCard, SectionTitle, Txt } from "./ui";
import { color, radius, space, tint } from "../theme";

export function CommunityDiscover() {
  const api = useApi();
  const router = useRouter();
  const [rows, setRows] = useState<DiscoverRow[] | null>(null);
  // Stable for the life of the screen, so re-fetching doesn't reshuffle voices
  // mid-browse — same contract as the public web Discover page.
  const seed = useRef(Crypto.randomUUID());

  const load = useCallback(async () => {
    try {
      const data = await api.getDiscover(seed.current);
      setRows(data.rows);
    } catch {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (rows === null || rows.length === 0) return null;

  return (
    <View style={{ marginTop: space.xl }}>
      <SectionTitle accent={color.purple}>From other communities</SectionTitle>
      <Txt variant="small" c={color.textFaint} style={{ marginTop: -space.sm, marginBottom: space.md }}>
        Public, after their week closed — nothing from a room you're not in.
      </Txt>

      {rows.map((row) => (
        <View key={`${row.community.slug}-${row.topic.topicKey}`} style={{ marginBottom: space.lg }}>
          <Txt variant="bodyStrong" numberOfLines={2} style={{ marginBottom: 2 }}>
            {row.topic.text}
          </Txt>
          <Label c={color.purple}>{row.community.name}</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md, paddingRight: space.xl, marginTop: space.sm }}
          >
            {row.responses.map((item) => (
              <PressCard
                key={item.id}
                accent={color.purple}
                onPress={() => router.push(`/discover/response/${item.id}` as never)}
                style={{ width: 150, padding: space.lg }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: tint(color.purple, 0.14),
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: space.md,
                  }}
                >
                  <Ionicons name={item.kind === "video" ? "play" : "musical-notes"} size={18} color={color.purple} />
                </View>
                <Txt variant="small" c={color.textMuted} numberOfLines={1}>
                  {item.speaker.displayName ?? "A member"}
                </Txt>
                <Txt variant="small" c={color.textFaint} style={{ marginTop: 2, fontSize: 11 }}>
                  {Math.round(item.durationSec / 60)} min
                </Txt>
              </PressCard>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}
