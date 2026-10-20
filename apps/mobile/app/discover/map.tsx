/**
 * Map of real, nearby fitness groups — Dallas only today.
 *
 * react-native-maps renders in Expo Go (Apple Maps on iOS, Google Maps on
 * Android, no API key needed for that). A production Android build needs a
 * Google Maps API key added to app.json's android.config.googleMaps.apiKey —
 * out of scope here since that's a Google Cloud account action.
 */

import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Notice, Txt } from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type { RemoteNearbyGroup } from "../../services";
import { color, space } from "../../theme";

const CATEGORY_COLOR: Record<string, string> = {
  running: color.green,
  hiit: color.amber,
  yoga: color.purple,
  cycling: color.teal,
  strength: color.blue,
  other: color.textMuted,
};

/** Dallas, as a sane default center before location resolves (or is denied). */
const DALLAS_CENTER = { latitude: 32.7767, longitude: -96.797 };

export default function DiscoverMapScreen() {
  const api = useApi();
  const router = useRouter();
  const [groups, setGroups] = useState<RemoteNearbyGroup[]>([]);
  const [selected, setSelected] = useState<RemoteNearbyGroup | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  useEffect(() => {
    void (async () => {
      let coords: { lat: number; lng: number } | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          const pos = await Location.getCurrentPositionAsync({});
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        } else {
          setLocationDenied(true);
        }
      } catch {
        setLocationDenied(true);
      }

      try {
        setGroups(await api.getNearbyGroups(coords));
      } catch {
        setGroups([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Nearby",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />

      {locationDenied ? (
        <View style={{ padding: space.lg, paddingBottom: 0 }}>
          <Notice>
            Location is off, so the map centers on Dallas instead of you. Distances won't show
            until you allow it in Settings.
          </Notice>
        </View>
      ) : null}

      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: userCoords?.latitude ?? DALLAS_CENTER.latitude,
          longitude: userCoords?.longitude ?? DALLAS_CENTER.longitude,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        showsUserLocation={!locationDenied}
      >
        {groups.map((g) => (
          <Marker
            key={g.id}
            coordinate={{ latitude: g.lat, longitude: g.lng }}
            pinColor={CATEGORY_COLOR[g.category] ?? color.textMuted}
            onPress={() => setSelected(g)}
          />
        ))}
      </MapView>

      {selected ? (
        <View style={{ position: "absolute", bottom: space.xl, left: space.xl, right: space.xl }}>
          <Card accent={CATEGORY_COLOR[selected.category] ?? color.textMuted}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{selected.name}</Txt>
                <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                  {selected.address}
                  {selected.distanceKm !== null ? ` · ${selected.distanceKm} km away` : ""}
                </Txt>
              </View>
              <Ionicons
                name="close"
                size={18}
                color={color.textFaint}
                onPress={() => setSelected(null)}
              />
            </View>
            <Button
              label="View details"
              icon="arrow-forward"
              accent={CATEGORY_COLOR[selected.category] ?? color.green}
              style={{ marginTop: space.md }}
              onPress={() => router.push(`/discover/group/${selected.id}` as never)}
            />
          </Card>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
