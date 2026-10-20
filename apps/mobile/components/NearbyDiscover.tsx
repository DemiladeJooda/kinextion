/**
 * Real-world fitness groups near the user, browsed Netflix-style — one
 * horizontally-scrolling row per category rather than one long list.
 *
 * No photos: every entry here is a real, hand-verified organisation (see
 * apps/api/src/jobs/seed-nearby-groups.ts), and a licensed photo of the
 * actual place is the bar for showing one — a stock or generated image would
 * misrepresent it. Cards use an icon and the category colour instead.
 */

import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { useApi } from "../hooks/useApi";
import type { RemoteNearbyGroup } from "../services";
import { Card, Label, PressCard, SectionTitle, Txt } from "./ui";
import { color, radius, space, tint } from "../theme";

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  running: { label: "Run clubs", icon: "walk-outline", accent: color.green },
  hiit: { label: "HIIT studios", icon: "flash-outline", accent: color.amber },
  yoga: { label: "Yoga & recovery", icon: "leaf-outline", accent: color.purple },
  cycling: { label: "Cycling", icon: "bicycle-outline", accent: color.teal },
  strength: { label: "Strength", icon: "barbell-outline", accent: color.blue },
  other: { label: "More nearby", icon: "location-outline", accent: color.textMuted },
};

export function NearbyDiscover() {
  const api = useApi();
  const router = useRouter();
  const [groups, setGroups] = useState<RemoteNearbyGroup[] | null>(null);

  const load = useCallback(async () => {
    let coords: { lat: number; lng: number } | undefined;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      // Distance is a nice-to-have — the list still works without it.
    }
    try {
      const data = await api.getNearbyGroups(coords);
      setGroups(data);
    } catch {
      setGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (groups === null) return null; // Silent while loading — no skeleton flash for a below-the-fold section.
  if (groups.length === 0) return null;

  const byCategory = groups.reduce<Record<string, RemoteNearbyGroup[]>>((acc, g) => {
    (acc[g.category] ??= []).push(g);
    return acc;
  }, {});

  return (
    <View style={{ marginTop: space.xl }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <SectionTitle accent={color.green} style={{ marginBottom: 0 }}>
          Dallas, in motion
        </SectionTitle>
        <PressCard
          haptic="light"
          onPress={() => router.push("/discover/map" as never)}
          style={{
            paddingVertical: space.xs,
            paddingHorizontal: space.md,
            shadowOpacity: 0,
            elevation: 0,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="map-outline" size={14} color={color.green} />
            <Txt variant="small" c={color.green}>
              Map
            </Txt>
          </View>
        </PressCard>
      </View>
      <Txt variant="small" c={color.textFaint} style={{ marginTop: -space.sm, marginBottom: space.md }}>
        Real, verified groups — not affiliated with Kinextion.
      </Txt>

      {Object.entries(byCategory).map(([category, items]) => {
        const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
        return (
          <View key={category} style={{ marginBottom: space.lg }}>
            <View style={{ marginBottom: space.sm }}>
              <Label c={meta.accent}>{meta.label}</Label>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md, paddingRight: space.xl }}
            >
              {items.map((group) => (
                <PressCard
                  key={group.id}
                  accent={meta.accent}
                  onPress={() => router.push(`/discover/group/${group.id}` as never)}
                  style={{ width: 200, padding: space.lg }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.md,
                      backgroundColor: tint(meta.accent, 0.14),
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: space.md,
                    }}
                  >
                    <Ionicons name={meta.icon} size={20} color={meta.accent} />
                  </View>
                  <Txt variant="bodyStrong" numberOfLines={2}>
                    {group.name}
                  </Txt>
                  <Txt variant="small" c={color.textMuted} numberOfLines={1} style={{ marginTop: 4 }}>
                    {group.isFree ? "Free" : "Studio"}
                    {group.distanceKm !== null ? ` · ${group.distanceKm} km away` : ""}
                  </Txt>
                </PressCard>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
