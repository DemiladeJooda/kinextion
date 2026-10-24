/**
 * Privacy & data.
 *
 * Health apps make claims about privacy on a marketing page and then give the
 * user no way to check any of them. This screen is the opposite: every number
 * on it is a live count from the user's own rows, and every statement about
 * how data is handled describes something that is actually implemented and
 * can be pointed at in the codebase.
 *
 * Nothing here is aspirational. If a protection isn't built, it isn't listed.
 */

import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { Ionicons } from "@expo/vector-icons";

import {
  AuroraBackdrop,
  Button,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import type { DataSummary } from "../../services";
import { color, radius, space, tint } from "../../theme";
import { downloadMyData } from "../../lib/export";
import { DEMO_MODE } from "../../lib/demo/session";

/** Only protections that exist in the code today. */
const PROTECTIONS = [
  {
    icon: "eye-off-outline" as const,
    title: "Your journal never reaches a log",
    body: "Journal entries, gratitude notes, chat messages and your auth token are stripped from server logs before they're written.",
  },
  {
    icon: "lock-closed-outline" as const,
    title: "Connected accounts are encrypted",
    body: "Tokens for Strava, Whoop, Oura and your calendar are encrypted with AES-256-GCM before they're stored.",
  },
  {
    icon: "calendar-outline" as const,
    title: "Calendars are reduced to shape",
    body: "If you connect a calendar, only the timing of your days is kept — when you're booked and where the gaps are. Titles, people and locations are discarded before anything is saved.",
  },
  {
    icon: "person-outline" as const,
    title: "Nothing is shared by default",
    body: "The therapist starter pack is opt-in per category and revocable. Nothing leaves your account unless you switch it on.",
  },
  {
    icon: "videocam-off-outline" as const,
    title: "Camera frames aren't kept",
    body: "Smart Referee, Form Control and Environment Design read frames to answer and don't retain them.",
  },
];

const COUNT_LABELS: Array<{ key: keyof DataSummary["counts"]; label: string }> = [
  { key: "habits", label: "Habits" },
  { key: "habitLogs", label: "Habit check-offs" },
  { key: "checkIns", label: "Daily check-ins" },
  { key: "reflections", label: "Journal & gratitude entries" },
  { key: "conversations", label: "Guide conversations" },
  { key: "messages", label: "Messages" },
  { key: "memoryFacts", label: "Remembered facts" },
  { key: "recommendations", label: "Recommendations" },
  { key: "wearableMetrics", label: "Readings from connected apps" },
  { key: "scores", label: "Daily scores" },
];

export default function PrivacyScreen() {
  const api = useApi();
  const router = useRouter();
  const { signOut, getToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await api.getDataSummary());
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const confirmDelete = () => {
    Alert.alert(
      "Delete your account?",
      "Everything above is permanently deleted — habits, check-ins, journals, conversations and connected accounts. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await api.deleteAccount();
                await signOut();
              } catch {
                Alert.alert("Couldn't delete", "Something went wrong. Try again.");
              }
            })();
          },
        },
      ]
    );
  };

  const totalRows = summary ? Object.values(summary.counts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Privacy & data",
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.text,
          headerBackTitle: "Back",
        }}
      />
      <AuroraBackdrop accent={color.blue} />

      <ScrollView
        contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.textFaint}
          />
        }
      >
        <ScreenHeader
          title="Privacy & data"
          subtitle="What's stored, how it's handled, and how to get rid of it."
        />

        {/* ── What's actually here ─────────────────────────────────── */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Label>What Kinextion holds on you</Label>
            <View style={{ flex: 1 }} />
            {summary?.since ? (
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
                since{" "}
                {new Date(summary.since).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </Txt>
            ) : null}
          </View>

          {failed ? (
            <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
              Couldn&apos;t load your data summary. Pull down to try again.
            </Txt>
          ) : !summary ? (
            <Txt variant="small" c={color.textFaint} style={{ marginTop: space.md }}>
              Counting…
            </Txt>
          ) : totalRows === 0 ? (
            <Txt variant="small" c={color.textMuted} style={{ marginTop: space.md }}>
              Nothing yet. Kinextion stores what you log, and you haven&apos;t logged anything.
            </Txt>
          ) : (
            <View style={{ marginTop: space.md }}>
              {COUNT_LABELS.filter(({ key }) => summary.counts[key] > 0).map(({ key, label }) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: space.sm,
                    borderTopWidth: 1,
                    borderTopColor: color.border,
                  }}
                >
                  <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                    {label}
                  </Txt>
                  <Txt variant="bodyStrong" c={color.text}>
                    {summary.counts[key]}
                  </Txt>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── Sharing state ────────────────────────────────────────── */}
        {summary ? (
          <PressCard
            onPress={() => router.push("/therapist" as never)}
            accent={summary.therapistSharing.length ? color.purple : undefined}
            style={{ marginTop: space.md, padding: space.lg }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
              }}
            >
              <Ionicons
                name={summary.therapistSharing.length ? "share-social" : "share-social-outline"}
                size={18}
                color={summary.therapistSharing.length ? color.purple : color.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Therapist sharing</Txt>
                <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
                  {summary.therapistSharing.length
                    ? `On for ${summary.therapistSharing.length} categor${summary.therapistSharing.length === 1 ? "y" : "ies"}. Tap to review or revoke.`
                    : "Off. Nothing is shared with anyone."}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.textFaint} />
            </View>
          </PressCard>
        ) : null}

        {/* ── How it's handled ─────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl, marginBottom: space.md }}>
          <Label>How it&apos;s handled</Label>
        </View>
        <View style={{ gap: space.sm }}>
          {PROTECTIONS.map((p) => (
            <Card key={p.title} style={{ padding: space.lg }}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    backgroundColor: tint(color.blue, 0.12),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={p.icon} size={16} color={color.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{p.title}</Txt>
                  <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                    {p.body}
                  </Txt>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* ── Getting rid of it ────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl, marginBottom: space.md }}>
          <Label c={color.red}>Deleting your data</Label>
        </View>
        <Card>
          <Txt variant="small" c={color.textMuted}>
            Deleting your account removes every row counted above, disconnects any linked apps, and
            removes your sign-in identity. It happens immediately and can&apos;t be undone.
          </Txt>
          <Button
            label="Delete account"
            variant="secondary"
            accent={color.red}
            icon="trash-outline"
            style={{ marginTop: space.lg }}
            onPress={confirmDelete}
          />
        </Card>

        <Card style={{ marginTop: space.lg }}>
          <Txt variant="bodyStrong">Download your data</Txt>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
            Everything above as one file: habits, check-ins, journals, conversations, what your
            guides remember, and your community posts. Passwords and connection keys are never
            included.
          </Txt>
          <Button
            label="Download my data"
            variant="secondary"
            icon="download-outline"
            accent={color.blue}
            loading={exporting}
            style={{ marginTop: space.lg }}
            onPress={() => {
              if (DEMO_MODE) {
                Alert.alert("Demo", "In the real app this saves a file with all your data.");
                return;
              }
              setExporting(true);
              void (async () => {
                try {
                  await downloadMyData(await getToken());
                } catch (err) {
                  Alert.alert("Couldn't download", err instanceof Error ? err.message : "Try again.");
                } finally {
                  setExporting(false);
                }
              })();
            }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
