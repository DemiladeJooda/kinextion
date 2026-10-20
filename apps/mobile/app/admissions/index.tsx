/**
 * Admission decisions waiting on you.
 *
 * A seat on a panel deciding whether an applicant belongs. No tally, no
 * names of other panelists — just the applicant, their note, and a
 * deadline. One of the two answers is permanent per seat; there's no undo.
 */

import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { AdmissionSeatView } from "@kinextion/shared";

import {
  AuroraBackdrop,
  Button,
  Card,
  EmptyState,
  Label,
  SkeletonCard,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { color, space } from "../../theme";

export default function AdmissionsScreen() {
  const api = useApi();
  const [seats, setSeats] = useState<AdmissionSeatView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSeats(await api.listMyAdmissionSeats());
    } catch {
      setError("Couldn't load your pending decisions.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const vote = async (joinRequestId: string, verdict: "belongs" | "objects") => {
    setBusy(joinRequestId);
    setError(null);
    try {
      await api.castAdmissionVote(joinRequestId, verdict);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSeats((prev) => prev?.filter((s) => s.joinRequestId !== joinRequestId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Admissions",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.teal} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {seats === null ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : seats.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="Nothing waiting on you"
            body="When someone applies to a community you're in, your seat on the panel shows up here."
          />
        ) : (
          seats.map((seat) => (
            <Card key={seat.joinRequestId} style={{ marginBottom: space.lg }} accent={color.teal}>
              <Label c={color.teal}>{seat.community.name}</Label>
              <Txt variant="heading" style={{ marginTop: space.sm }}>
                {seat.applicant.displayName ?? "Someone"} wants to join
              </Txt>
              {seat.note ? (
                <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
                  &ldquo;{seat.note}&rdquo;
                </Txt>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  marginTop: space.md,
                }}
              >
                <Ionicons name="time-outline" size={13} color={color.textFaint} />
                <Txt variant="small" c={color.textFaint}>
                  Answer by{" "}
                  {new Date(seat.respondBy).toLocaleDateString(undefined, {
                    weekday: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Txt>
              </View>

              <View style={{ flexDirection: "row", gap: space.md, marginTop: space.lg }}>
                <Button
                  label="Belongs"
                  icon="checkmark"
                  accent={color.green}
                  loading={busy === seat.joinRequestId}
                  disabled={busy !== null}
                  style={{ flex: 1 }}
                  onPress={() => void vote(seat.joinRequestId, "belongs")}
                />
                <Button
                  label="Objects"
                  icon="close"
                  variant="secondary"
                  accent={color.red}
                  loading={busy === seat.joinRequestId}
                  disabled={busy !== null}
                  style={{ flex: 1 }}
                  onPress={() => void vote(seat.joinRequestId, "objects")}
                />
              </View>
            </Card>
          ))
        )}

        {error ? (
          <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
            {error}
          </Txt>
        ) : null}

        <Txt variant="small" c={color.textFaint} style={{ marginTop: space.lg, textAlign: "center" }}>
          Nobody sees who voted, or how — only whether the application was decided.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}
