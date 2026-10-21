/**
 * A proposed habit, before it is a habit.
 *
 * Every draft carries the reason it was proposed, and that reason is rendered
 * as prominently as the habit itself. That's the whole contract of the feature:
 * the assistant may only cite signals it was actually given, so showing the
 * citation is what lets the user check the claim instead of trusting it.
 */

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HabitDraft } from "@kinextion/shared";
import { WELLNESS_LABELS } from "@kinextion/shared";

import { Card, Txt } from "./ui";
import {
  categoryColor,
  color,
  radius,
  space,
  tint,
  type Category,
} from "../theme";

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Every day",
  weekly: "Weekly",
  custom: "Certain days",
};

export function HabitDraftCard({
  draft,
  accepted,
  children,
}: {
  draft: HabitDraft;
  accepted?: boolean;
  /** Action row — differs between the suggest and discover screens. */
  children?: React.ReactNode;
}) {
  const accent = categoryColor[draft.category as Category];

  return (
    <Card accent={accepted ? color.green : accent}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{draft.name}</Txt>
          <View
            style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}
          >
            <Pill label={WELLNESS_LABELS[draft.category]} accent={accent} />
            <Pill
              label={FREQUENCY_LABEL[draft.frequency] ?? draft.frequency}
              accent={color.textMuted}
            />
          </View>
        </View>
        {accepted ? (
          <Ionicons name="checkmark-circle" size={22} color={color.green} />
        ) : null}
      </View>

      {draft.cue || draft.response ? (
        <View style={{ gap: 6, marginTop: space.lg }}>
          {draft.cue ? (
            <LoopLine icon="time-outline" label="When" value={draft.cue} />
          ) : null}
          {draft.response ? (
            <LoopLine
              icon="footsteps-outline"
              label="Do"
              value={draft.response}
            />
          ) : null}
          {draft.reward ? (
            <LoopLine icon="gift-outline" label="Then" value={draft.reward} />
          ) : null}
          {draft.backupPlan ? (
            <LoopLine
              icon="shield-checkmark-outline"
              label="If"
              value={draft.backupPlan}
            />
          ) : null}
        </View>
      ) : null}

      {/* The receipt. */}
      <View
        style={{
          flexDirection: "row",
          gap: space.sm,
          marginTop: space.lg,
          paddingTop: space.md,
          borderTopWidth: 1,
          borderTopColor: color.border,
        }}
      >
        <Ionicons
          name="git-branch-outline"
          size={14}
          color={accent}
          style={{ marginTop: 3 }}
        />
        <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
          {draft.rationale}
        </Txt>
      </View>

      {children ? (
        <View style={{ marginTop: space.lg }}>{children}</View>
      ) : null}
    </Card>
  );
}

function LoopLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}
    >
      <Ionicons
        name={icon}
        size={13}
        color={color.textFaint}
        style={{ marginTop: 3 }}
      />
      <Txt variant="small" c={color.textFaint} style={{ width: 38 }}>
        {label}
      </Txt>
      <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
        {value}
      </Txt>
    </View>
  );
}

function Pill({ label, accent }: { label: string; accent: string }) {
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: tint(accent, 0.12),
      }}
    >
      <Txt variant="label" c={accent} style={{ fontSize: 9 }}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * The signals a set of proposals was built from.
 *
 * Rendered even when short — "1 stated goal" is a more honest header than
 * silence, because it tells the user how thin the basis actually was.
 */
export function BasisChips({ basis }: { basis: string[] }) {
  if (basis.length === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 11 }}>
        Built from
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {basis.map((b) => (
          <View
            key={b}
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 3,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 10 }}>
              {b}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}
