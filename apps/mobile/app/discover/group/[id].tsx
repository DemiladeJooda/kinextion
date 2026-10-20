/**
 * One nearby group's detail — what it is, how far, and how to get plugged in.
 *
 * Fetches the whole (small) list and finds the match rather than adding a
 * second endpoint for nine rows; worth a dedicated GET /api/nearby/groups/:id
 * once the dataset grows past "fits in one request."
 */

import { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { AuroraBackdrop, Badge, Button, Card, Label, ScreenHeader, Txt } from "../../../components/ui";
import { useApi } from "../../../hooks/useApi";
import type { RemoteNearbyGroup } from "../../../services";
import { color, radius, space, tint } from "../../../theme";

const CATEGORY_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  running: { label: "Run club", icon: "walk-outline", accent: color.green },
  hiit: { label: "HIIT studio", icon: "flash-outline", accent: color.amber },
  yoga: { label: "Yoga studio", icon: "leaf-outline", accent: color.purple },
  cycling: { label: "Cycling", icon: "bicycle-outline", accent: color.teal },
  strength: { label: "Strength", icon: "barbell-outline", accent: color.blue },
  other: { label: "Nearby group", icon: "location-outline", accent: color.textMuted },
};

function directionsUrl(lat: number, lng: number, label: string): string {
  const encodedLabel = encodeURIComponent(label);
  return Platform.OS === "ios"
    ? `maps://?daddr=${lat},${lng}&q=${encodedLabel}`
    : `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
}

export default function NearbyGroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [group, setGroup] = useState<RemoteNearbyGroup | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getNearbyGroups()
      .then((groups) => {
        if (cancelled) return;
        const match = groups.find((g) => g.id === id) ?? null;
        setGroup(match);
        if (!match) setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const meta = group ? CATEGORY_META[group.category] ?? CATEGORY_META.other : CATEGORY_META.other;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: group?.name ?? "Nearby",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={meta.accent} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {notFound ? (
          <Card>
            <Txt variant="body" c={color.textMuted}>
              Couldn't find that one — it may have been removed from the list.
            </Txt>
          </Card>
        ) : !group ? (
          <Card>
            <Txt variant="small" c={color.textFaint}>
              Loading…
            </Txt>
          </Card>
        ) : (
          <>
            <ScreenHeader title={group.name} subtitle={group.address} />

            <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.lg }}>
              <Badge label={meta.label} accent={meta.accent} />
              {group.isFree ? <Badge label="Free" accent={color.green} /> : null}
              {group.distanceKm !== null ? (
                <Badge label={`${group.distanceKm} km away`} accent={color.textMuted} />
              ) : null}
            </View>

            <Card>
              <Txt variant="body" c={color.textMuted}>
                {group.description}
              </Txt>
              {group.schedule ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.sm,
                    marginTop: space.lg,
                    paddingTop: space.lg,
                    borderTopWidth: 1,
                    borderTopColor: color.border,
                  }}
                >
                  <Ionicons name="time-outline" size={16} color={meta.accent} style={{ marginTop: 1 }} />
                  <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                    {group.schedule}
                  </Txt>
                </View>
              ) : null}
            </Card>

            <View style={{ gap: space.md, marginTop: space.lg }}>
              <Button
                label="Get directions"
                icon="navigate"
                accent={meta.accent}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void Linking.openURL(directionsUrl(group.lat, group.lng, group.name)).catch(() => {
                    void Linking.openURL(
                      `https://maps.google.com/?q=${group.lat},${group.lng}`
                    );
                  });
                }}
              />
              {group.website ? (
                <Button
                  label="Visit website"
                  icon="globe-outline"
                  variant="secondary"
                  accent={meta.accent}
                  onPress={() => void Linking.openURL(group.website!)}
                />
              ) : null}
              {group.phone ? (
                <Button
                  label={`Call ${group.phone}`}
                  icon="call-outline"
                  variant="secondary"
                  accent={meta.accent}
                  onPress={() => void Linking.openURL(`tel:${group.phone}`)}
                />
              ) : null}
            </View>

            <View
              style={{
                marginTop: space.xl,
                padding: space.lg,
                borderRadius: radius.md,
                backgroundColor: tint(color.textFaint, 0.06),
              }}
            >
              <Label>Independent — not a partner or sponsor</Label>
              <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
                Listed because it's real and nearby, not because of any relationship with
                Kinextion. Schedules change — the website or phone above is the source of truth,
                not this app.
              </Txt>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
