/**
 * Apple Health / Health Connect on Profile.
 *
 * One row for this phone's health store. With a build that can read it:
 * connect (the phone asks for permission), then it syncs whenever the
 * Habits tab opens. Without one yet, it says so plainly rather than showing
 * a button that does nothing.
 */

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button, Card, Txt } from "./ui";
import { useApi } from "../hooks/useApi";
import { PHONE_HEALTH, healthSource, readRecentDays } from "../lib/health";
import { color, space } from "../theme";

export function PhoneHealthCard() {
  const api = useApi();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const readable = healthSource() !== null;

  useEffect(() => {
    if (!PHONE_HEALTH) return;
    api
      .listIntegrations()
      .then((l) =>
        setConnected(l.integrations.some((i) => i.provider === PHONE_HEALTH!.provider && i.status !== "disconnected"))
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!PHONE_HEALTH) return null;
  const { provider, label } = PHONE_HEALTH;

  const connect = async () => {
    const source = healthSource();
    if (!source) return;
    setBusy(true);
    setNote(null);
    try {
      if (!(await source.requestAccess())) {
        setNote(`${label} access is off. You can turn it on in your phone's settings.`);
        return;
      }
      await api.connectDeviceHealth(provider);
      const days = await readRecentDays();
      if (days.length) await api.ingestDeviceHealth(provider, days);
      setConnected(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setNote("Couldn't connect just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Ionicons name="heart-outline" size={20} color={color.red} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{label}</Txt>
          <Txt variant="small" c={color.textMuted}>
            {connected && readable
              ? "Connected. Steps and workouts sync when you open Habits."
              : readable
                ? "Steps and workouts, read on your phone. No extra account needed."
                : "Coming in the next app update."}
          </Txt>
        </View>
      </View>
      {readable && !connected ? (
        <Button label={`Connect ${label}`} variant="secondary" accent={color.red} loading={busy} onPress={connect} style={{ marginTop: space.md }} />
      ) : null}
      {note ? (
        <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
          {note}
        </Txt>
      ) : null}
    </Card>
  );
}
