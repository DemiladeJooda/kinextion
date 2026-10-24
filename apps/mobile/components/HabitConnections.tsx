/**
 * Where a habit connects beyond the app: a service that logs it for you,
 * and communities you're building it alongside.
 *
 * Both are opt-in and per habit. Auto-logging only offers services that can
 * actually see the habit (a run on Strava, steps on Oura); a service that
 * isn't connected yet points to where to connect it. Sharing lists only
 * communities you're in.
 */

import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AUTO_LOG_OPTIONS, PROVIDER_LABEL, type AutoLog, type CommunityDetail } from "@kinextion/shared";

import { Card, Chip, Label, Txt } from "./ui";
import { useApi } from "../hooks/useApi";
import type { IntegrationsList } from "../services";
import { PHONE_HEALTH, healthSource } from "../lib/health";
import { color, space } from "../theme";

export function HabitConnections({
  habitId,
  autoLog,
  accent,
  onAutoLog,
}: {
  habitId: string;
  autoLog: AutoLog | null;
  accent: string;
  onAutoLog: (next: AutoLog | null) => Promise<void>;
}) {
  const api = useApi();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<IntegrationsList | null>(null);
  const [communities, setCommunities] = useState<CommunityDetail[]>([]);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [rule, setRule] = useState<AutoLog | null>(autoLog);

  useEffect(() => {
    api.listIntegrations().then(setIntegrations).catch(() => {});
    api
      .listMyCommunities()
      .then((list) => setCommunities(list.filter((c) => c.membership)))
      .catch(() => {});
    api
      .getHabitShares(habitId)
      .then((ids) => setShared(new Set(ids)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitId]);

  const connected = new Set(
    (integrations?.integrations ?? []).filter((i) => i.status !== "disconnected").map((i) => i.provider)
  );

  const chooseRule = async (next: AutoLog | null) => {
    void Haptics.selectionAsync();
    const before = rule;
    setRule(next);
    try {
      await onAutoLog(next);
    } catch {
      setRule(before);
    }
  };

  const toggleShare = async (communityId: string) => {
    void Haptics.selectionAsync();
    const on = shared.has(communityId);
    setShared((prev) => {
      const next = new Set(prev);
      if (on) next.delete(communityId);
      else next.add(communityId);
      return next;
    });
    try {
      if (on) await api.unshareHabit(habitId, communityId);
      else await api.shareHabit(habitId, communityId);
    } catch {
      setShared((prev) => {
        const next = new Set(prev);
        if (on) next.add(communityId);
        else next.delete(communityId);
        return next;
      });
    }
  };

  return (
    <View style={{ gap: space.md, marginTop: space.xxl }}>
      <Card>
        <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
          <Ionicons name="sync-outline" size={18} color={color.teal} />
          <Label>Log it automatically</Label>
        </View>
        <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
          When a connected service sees it happen, it&apos;s ticked for you. You&apos;ll always see it was logged
          automatically, and you can undo it.
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
          <Chip label="Off" accent={color.text} selected={!rule} onPress={() => void chooseRule(null)} />
          {AUTO_LOG_OPTIONS.filter(
            (o) => !(o.provider === "apple_health" || o.provider === "health_connect") || o.provider === PHONE_HEALTH?.provider
          ).map((o) => {
            const isOn = rule?.provider === o.provider && rule.metric === o.metric;
            const phone = o.provider === "apple_health" || o.provider === "health_connect";
            const ready = connected.has(o.provider) && (!phone || healthSource() !== null);
            return (
              <Chip
                key={`${o.provider}-${o.metric}`}
                label={ready ? o.label : `${o.label} · connect`}
                accent={color.teal}
                selected={isOn}
                onPress={() =>
                  ready
                    ? void chooseRule({ provider: o.provider, metric: o.metric })
                    : router.push("/(tabs)/profile" as never)
                }
              />
            );
          })}
        </View>
        {rule ? (
          <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
            {(() => {
              const o = AUTO_LOG_OPTIONS.find((x) => x.provider === rule.provider && x.metric === rule.metric);
              return o
                ? `Counts from ${(rule.min ?? o.defaultMin).toLocaleString("en-US")} ${o.unit} on ${PROVIDER_LABEL[o.provider]}.`
                : null;
            })()}
          </Txt>
        ) : null}
      </Card>

      {communities.length ? (
        <Card>
          <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            <Ionicons name="people-outline" size={18} color={accent} />
            <Label>Build it with your community</Label>
          </View>
          <Txt variant="small" c={color.textMuted} style={{ marginTop: space.sm }}>
            Members see this habit and which days you did it this week. No streaks, no rankings.
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {communities.map((c) => (
              <Chip
                key={c.community.id}
                label={c.community.name}
                icon={shared.has(c.community.id) ? "checkmark" : undefined}
                accent={accent}
                selected={shared.has(c.community.id)}
                onPress={() => void toggleShare(c.community.id)}
              />
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
