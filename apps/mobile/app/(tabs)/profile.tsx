import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useCallback, useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { DEMO_MODE, useAuth, useUser } from "../../lib/auth";

import {
  TAB_BAR_CLEARANCE,
  AuroraBackdrop,
  Badge,
  Card,
  Notice,
  PressCard,
  ScreenHeader,
  SectionTitle,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import { avatarImageUrl } from "../../lib/avatar";
import { useAppState } from "../../lib/store";
import type { IntegrationProvider, IntegrationsList } from "../../services";
import { color, radius, space, tint } from "../../theme";

/**
 * Data sources not covered by the real Integrations feature below — still
 * UI-only until each one ships, labelled as such rather than implying a
 * connection that isn't there.
 */
const SOURCES = [
  {
    id: "health",
    icon: "heart-outline",
    label: "Apple Health",
    detail: "Steps, heart rate, sleep",
    accent: color.green,
  },
] as const;

interface ProviderMeta {
  id: IntegrationProvider;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  accent: string;
}

const WEARABLE_PROVIDERS: ReadonlyArray<ProviderMeta> = [
  {
    id: "strava",
    icon: "bicycle-outline",
    label: "Strava",
    detail: "Workouts and activity",
    accent: color.amber,
  },
  {
    id: "whoop",
    icon: "pulse-outline",
    label: "Whoop",
    detail: "Recovery, HRV, resting heart rate",
    accent: color.red,
  },
  {
    id: "oura",
    icon: "ellipse-outline",
    label: "Oura Ring",
    detail: "Sleep score",
    accent: color.purple,
  },
];

/** Calendars are listed apart from wearables because the disclosure differs —
 *  see the note under the card about what is and isn't read. */
const CALENDAR_PROVIDER_META: ReadonlyArray<ProviderMeta> = [
  {
    id: "google_calendar",
    icon: "calendar-outline",
    label: "Google Calendar",
    detail: "When your day is booked, and where it isn't",
    accent: color.blue,
  },
  {
    id: "outlook_calendar",
    icon: "calendar-number-outline",
    label: "Outlook Calendar",
    detail: "When your day is booked, and where it isn't",
    accent: color.teal,
  },
];

/** Life-context, not fitness or a calendar — its own small card. */
const MUSIC_PROVIDER_META: ReadonlyArray<ProviderMeta> = [
  {
    id: "spotify",
    icon: "musical-notes-outline",
    label: "Spotify",
    detail: "Recently played, for Environment Design's mood reading",
    accent: color.pink,
  },
];

/**
 * Settings rows.
 *
 * Every row that renders a chevron now goes somewhere — the four at the top
 * used to look tappable and do nothing, which is a worse experience than not
 * offering them at all. `route` is the screen it opens; the two destructive
 * rows are handled inline instead.
 */
const SETTINGS: ReadonlyArray<{
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
  route?: string;
}> = [
  {
    key: "edit",
    icon: "person-outline",
    label: "Edit profile",
    accent: color.text,
    route: "/settings/edit",
  },
  {
    key: "notifications",
    icon: "notifications-outline",
    label: "Notifications",
    accent: color.text,
    route: "/settings/notifications",
  },
  {
    key: "privacy",
    icon: "shield-checkmark-outline",
    label: "Privacy & data",
    accent: color.text,
    route: "/settings/privacy",
  },
  {
    key: "help",
    icon: "help-circle-outline",
    label: "Help & support",
    accent: color.text,
    route: "/settings/help",
  },
  {
    key: "sign-out",
    icon: "log-out-outline",
    label: "Sign out",
    accent: color.red,
  },
  {
    key: "delete-account",
    icon: "trash-outline",
    label: "Delete account",
    accent: color.red,
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const api = useApi();
  const { habits, periodScore } = useAppState();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [avatarId, setAvatarId] = useState<string | null>(null);

  // Best run in the loaded history, not today's, so a 40-day best doesn't
  // read as 0 the morning after one miss.
  const longestStreak = habits.reduce((m, h) => Math.max(m, h.bestStreak), 0);
  const displayName =
    user?.firstName || user?.primaryEmailAddress?.emailAddress || "";
  const initial = displayName ? displayName[0]!.toUpperCase() : "K";

  useEffect(() => {
    let cancelled = false;
    api
      .getMyProfile()
      .then((u) => {
        if (!cancelled) setAvatarId(u.profile?.avatarId ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Two-step confirmation before an irreversible delete. Both stores require
   * the option to exist; the second prompt is so it can't be hit by accident.
   */
  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your habits, mood history, conversations, connected apps, and any therapist reports. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you sure?",
              "There is no way to recover this data.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete everything",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api.deleteAccount();
                      // Sign-out clears the local session; the AuthGate then
                      // routes back to sign-in on its own.
                      await signOut();
                    } catch {
                      Alert.alert(
                        "Couldn't delete your account",
                        "Something went wrong. Your account is unchanged — please try again.",
                      );
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top"]}
    >
      <AuroraBackdrop accent={color.teal} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Profile" />

        {/* Identity card */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.lg,
              }}
            >
              <Pressable onPress={() => router.push("/avatar/create" as never)}>
                <LinearGradient
                  colors={[color.green, color.teal, color.purple]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 34,
                    padding: 2.5,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 32,
                      backgroundColor: color.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {avatarId ? (
                      <Image
                        source={{
                          uri: avatarImageUrl(avatarId, { camera: "portrait" }),
                        }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : user?.hasImage && user.imageUrl ? (
                      <Image
                        source={{ uri: user.imageUrl }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <Txt variant="title" c={color.green}>
                        {initial}
                      </Txt>
                    )}
                  </View>
                </LinearGradient>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Txt variant="heading">{displayName || "Kinextion"}</Txt>
                <Txt
                  variant="small"
                  c={color.textMuted}
                  style={{ marginTop: 2 }}
                >
                  {user?.primaryEmailAddress?.emailAddress ??
                    "Synced across devices"}
                </Txt>
                <Pressable
                  onPress={() => router.push("/avatar/create" as never)}
                  hitSlop={8}
                >
                  <Txt
                    variant="small"
                    c={color.green}
                    style={{ marginTop: 4, fontWeight: "700" }}
                  >
                    {avatarId ? "Edit avatar" : "Create your avatar"}
                  </Txt>
                </Pressable>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                marginTop: space.xl,
                gap: space.md,
              }}
            >
              <Stat
                label="Score"
                value={
                  periodScore?.average === null ||
                  periodScore?.average === undefined
                    ? "—"
                    : String(periodScore.average)
                }
                accent={color.teal}
              />
              <Stat
                label="Best streak"
                value={`${longestStreak}d`}
                accent={color.amber}
              />
              <Stat
                label="Habits"
                value={String(habits.length)}
                accent={color.green}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Wearables & fitness — the real Integrations feature */}
        <SectionTitle accent={color.amber}>Wearables & fitness</SectionTitle>
        <WearablesCard />
        <Txt
          variant="small"
          c={color.textFaint}
          style={{ marginTop: space.sm }}
        >
          Kinextion reads what's already tracking you, and connects the dots — a
          missed Strava sync gets caught, and sleep from your ring gets read
          alongside how you actually showed up that day.
        </Txt>

        {/* Where connected data actually becomes visible. Sits directly under
            the wearables card because that's where the question "what did
            connecting this get me?" is asked. */}
        <PressCard
          onPress={() => router.push("/metrics" as never)}
          accent={color.teal}
          style={{ marginTop: space.md, padding: space.lg }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: radius.md,
                backgroundColor: tint(color.teal, 0.14),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="stats-chart" size={20} color={color.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Your data</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
                Every reading your connected apps have sent, charted.
              </Txt>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={color.textFaint}
            />
          </View>
        </PressCard>

        {/* Calendar — real OAuth, but a different disclosure from a wearable */}
        <SectionTitle accent={color.blue}>Calendar</SectionTitle>
        <WearablesCard providers={CALENDAR_PROVIDER_META} />
        <Txt
          variant="small"
          c={color.textFaint}
          style={{ marginTop: space.sm }}
        >
          Connecting a calendar lets Kinextion put habit cues in gaps that are
          actually free. It reads only the shape of your days — when your first
          commitment is, how much is booked, and where the longest open block
          sits. Event titles, people and locations are discarded before anything
          is saved, and are never sent to the AI.
        </Txt>

        {/* Music — real OAuth, life-context rather than fitness or calendar */}
        <SectionTitle accent={color.pink}>Music</SectionTitle>
        <WearablesCard providers={MUSIC_PROVIDER_META} />
        <Txt
          variant="small"
          c={color.textFaint}
          style={{ marginTop: space.sm }}
        >
          Reads your recently played tracks — nothing else about your account,
          and nothing is posted on your behalf.
        </Txt>

        {/* Data sources */}
        <SectionTitle>Data sources</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {SOURCES.map((s, i) => (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: color.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: tint(s.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={s.icon} size={17} color={s.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="body">{s.label}</Txt>
                <Txt
                  variant="small"
                  c={color.textFaint}
                  style={{ marginTop: 1 }}
                >
                  {s.detail}
                </Txt>
              </View>
              <Switch
                value={!!connected[s.id]}
                onValueChange={(v) => {
                  void Haptics.selectionAsync();
                  setConnected((p) => ({ ...p, [s.id]: v }));
                }}
                trackColor={{
                  false: "rgba(255,255,255,0.08)",
                  true: tint(s.accent, 0.45),
                }}
                thumbColor={connected[s.id] ? s.accent : "#64748B"}
              />
            </View>
          ))}
        </Card>
        <Txt
          variant="small"
          c={color.textFaint}
          style={{ marginTop: space.sm }}
        >
          Integrations are not live yet — these toggles record your preference
          so the connection happens the moment each one ships.
        </Txt>

        {/* Therapist Starter Pack */}
        <SectionTitle accent={color.purple}>Wellness support</SectionTitle>
        <PressCard
          onPress={() => router.push("/therapist" as never)}
          accent={color.purple}
          style={{ padding: space.lg }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: radius.md,
                backgroundColor: tint(color.purple, 0.14),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="heart-circle-outline"
                size={22}
                color={color.purple}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Therapist Starter Pack</Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
                Share real context with the therapist you already have
              </Txt>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={color.textFaint}
            />
          </View>
        </PressCard>

        {/* Settings */}
        <SectionTitle>Settings</SectionTitle>
        <Card padded={false} style={{ paddingVertical: space.xs }}>
          {SETTINGS.map((s, i) => (
            <PressCard
              key={s.key}
              onPress={() => {
                if (s.route) router.push(s.route as never);
                else if (s.key === "sign-out")
                  Alert.alert(
                    "Sign out?",
                    "Your habits and history stay safe on your account.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Sign out",
                        style: "destructive",
                        onPress: () => void signOut(),
                      },
                    ],
                  );
                else if (s.key === "delete-account") confirmDeleteAccount();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                backgroundColor: "transparent",
                borderWidth: 0,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: color.border,
                borderRadius: 0,
                shadowOpacity: 0,
                elevation: 0,
              }}
            >
              <Ionicons name={s.icon} size={18} color={s.accent} />
              <Txt variant="body" c={s.accent} style={{ flex: 1 }}>
                {s.label}
              </Txt>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={color.textFaint}
              />
            </PressCard>
          ))}
        </Card>

        <View
          style={{ alignItems: "center", marginTop: space.xxl, gap: space.sm }}
        >
          <Badge label="Kinextion 0.1.0" accent={color.textFaint} />
          <Txt variant="small" c={color.textFaint}>
            Made for people who are done starting over.
          </Txt>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WearablesCard({
  providers = WEARABLE_PROVIDERS,
}: {
  providers?: ReadonlyArray<ProviderMeta>;
}) {
  const api = useApi();
  const [data, setData] = useState<IntegrationsList | null>(null);
  const [busy, setBusy] = useState<IntegrationProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.listIntegrations());
    } catch {
      // Leave the last known state on screen rather than blanking it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConnect = async (provider: IntegrationProvider) => {
    setError(null);
    setBusy(provider);
    try {
      const { authorizeUrl } = await api.startConnect(provider);
      if (DEMO_MODE) {
        // No OAuth round trip in the demo — the connection is already made.
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        await refresh();
        return;
      }
      const redirectUrl = Linking.createURL("integrations/callback");
      const result = await WebBrowser.openAuthSessionAsync(
        authorizeUrl,
        redirectUrl,
      );
      if (result.type === "success") {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        await api.syncIntegration(provider);
        await refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't connect. Try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const onDisconnect = async (provider: IntegrationProvider) => {
    setError(null);
    setBusy(provider);
    try {
      await api.disconnectIntegration(provider);
      await refresh();
    } catch {
      setError("Couldn't disconnect. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onSync = async (provider: IntegrationProvider) => {
    setError(null);
    setBusy(provider);
    try {
      await api.syncIntegration(provider);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card padded={false} style={{ paddingVertical: space.xs }}>
        {providers.map((p, i) => {
          const connection = data?.integrations.find(
            (c) => c.provider === p.id,
          );
          const configured = data?.available[p.id] ?? true; // assume yes until we know otherwise
          const isBusy = busy === p.id;

          return (
            <View
              key={p.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: color.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: tint(p.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={p.icon} size={17} color={p.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="body">{p.label}</Txt>
                <Txt
                  variant="small"
                  c={color.textFaint}
                  style={{ marginTop: 1 }}
                >
                  {connection?.status === "connected"
                    ? connection.lastSyncedAt
                      ? `Synced ${timeAgo(connection.lastSyncedAt)}`
                      : "Connected — not synced yet"
                    : connection?.status === "error"
                      ? (connection.lastError ?? "Sync failed")
                      : configured
                        ? p.detail
                        : "Not configured yet"}
                </Txt>
              </View>
              {connection ? (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <PressCard
                    onPress={() => void onSync(p.id)}
                    disabled={isBusy}
                    accent={p.accent}
                    style={{
                      padding: space.sm,
                      shadowOpacity: 0,
                      elevation: 0,
                    }}
                  >
                    <Ionicons name="refresh" size={16} color={p.accent} />
                  </PressCard>
                  <PressCard
                    onPress={() => void onDisconnect(p.id)}
                    disabled={isBusy}
                    accent={color.textFaint}
                    style={{
                      padding: space.sm,
                      shadowOpacity: 0,
                      elevation: 0,
                    }}
                  >
                    <Ionicons name="close" size={16} color={color.textMuted} />
                  </PressCard>
                </View>
              ) : (
                <PressCard
                  onPress={() => void onConnect(p.id)}
                  disabled={isBusy || !configured}
                  accent={p.accent}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: space.md,
                    shadowOpacity: 0,
                    elevation: 0,
                  }}
                >
                  <Txt
                    variant="small"
                    c={configured ? p.accent : color.textFaint}
                  >
                    {isBusy ? "Connecting…" : "Connect"}
                  </Txt>
                </PressCard>
              )}
            </View>
          );
        })}
      </Card>
      {error ? (
        <View style={{ marginTop: space.sm }}>
          <Notice>{error}</Notice>
        </View>
      ) : null}
    </>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tint(accent, 0.07),
        borderWidth: 1,
        borderColor: tint(accent, 0.16),
        borderRadius: radius.md,
        paddingVertical: space.md,
        alignItems: "center",
      }}
    >
      <Txt variant="heading" c={accent}>
        {value}
      </Txt>
      <Txt
        variant="small"
        c={color.textFaint}
        style={{ fontSize: 11, marginTop: 1 }}
      >
        {label}
      </Txt>
    </View>
  );
}
