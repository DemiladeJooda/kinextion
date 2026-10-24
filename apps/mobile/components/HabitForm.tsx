/**
 * The habit builder.
 *
 * Shared by "new habit" and "edit habit" so the two can't drift apart. It
 * walks the steps that make a habit hold, in order, one card each:
 *
 *   1. What        the habit, and which part of life it belongs to
 *   2. After I…    the anchor: an existing moment it attaches to, and a
 *                  window of the day (a window, never a minute — flexible
 *                  timing keeps habits going better than a rigid slot)
 *   3. Tiny        the version small enough for the worst day; required for
 *                  new habits, because it's what keeps a streak alive
 *   4. How often   every day, certain days, or a number of times a week
 *   5. Why         in the user's words, so it can be played back to them
 *
 * Extras (a backup plan, something to pair it with, the payoff) sit behind
 * one optional fold. A live preview writes the plan out as a sentence —
 * "After I pour my coffee, I'll do 2 push-ups." — because stating the plan
 * in full is the implementation intention itself.
 *
 * The four loop fields keep their database names (cue = anchor, response =
 * tiny version, craving = why, reward = payoff); the UI never uses them.
 */

import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  HABIT_CATEGORY_HINTS,
  WELLNESS_CATEGORIES,
  WELLNESS_LABELS,
  basicTidy,
  describeHabitPlan,
  nextMondayKey,
  today,
  MEASURE_UNITS,
} from "@kinextion/shared";
import type { CreateHabitInput, PolishedField } from "@kinextion/shared";

import { Button, Card, Chip, Field, Label, PressCard, Txt } from "./ui";
import {
  categoryColor,
  color,
  radius,
  space,
  tint,
  type Category,
} from "../theme";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/** Moments most days already have. Tapping one fills the anchor field. */
const ANCHORS = [
  "After I wake up",
  "After I pour my coffee",
  "After I brush my teeth",
  "When I get to work",
  "After lunch",
  "When I get home",
  "After I get into bed",
];

const WINDOWS: Array<{ value: HabitFormValues["timeWindow"]; label: string }> =
  [
    { value: "morning", label: "Morning" },
    { value: "midday", label: "Midday" },
    { value: "evening", label: "Evening" },
    { value: "anytime", label: "Any time" },
  ];

export interface HabitFormValues {
  name: string;
  category: Category;
  /** The anchor: "After I …". */
  cue: string;
  /** Why it matters, in their words. */
  craving: string;
  /** The tiny version. */
  response: string;
  /** Today's payoff. */
  reward: string;
  frequency: "daily" | "weekly" | "custom";
  targetDays: number[];
  perWeekTarget: number;
  timeWindow: "morning" | "midday" | "evening" | "anytime";
  fullVersion: string;
  backupPlan: string;
  pairWith: string;
  /** New habits only: start today, or on the coming Monday. */
  start: "today" | "monday";
  /** A reminder at the start of its part of the day. */
  reminderEnabled: boolean;
  /** Count an amount ("8 glasses") rather than yes/no. Numbers as typed. */
  measureOn: boolean;
  measureTarget: string;
  measureTiny: string;
  measureUnit: string;
}

export function emptyHabitForm(): HabitFormValues {
  return {
    name: "",
    category: "physical",
    cue: "",
    craving: "",
    response: "",
    reward: "",
    frequency: "daily",
    targetDays: [],
    perWeekTarget: 3,
    timeWindow: "anytime",
    fullVersion: "",
    backupPlan: "",
    pairWith: "",
    start: "today",
    reminderEnabled: true,
    measureOn: false,
    measureTarget: "",
    measureTiny: "",
    measureUnit: "",
  };
}

/** Strip empty optional fields — the API would rather have them absent. */
export function toCreateInput(values: HabitFormValues): CreateHabitInput {
  const trimmed = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    name: values.name.trim(),
    category: values.category,
    cue: trimmed(values.cue),
    craving: trimmed(values.craving),
    response: trimmed(values.response),
    reward: trimmed(values.reward),
    frequency: values.frequency,
    targetDays: values.frequency === "custom" ? values.targetDays : undefined,
    perWeekTarget:
      values.frequency === "weekly" ? values.perWeekTarget : undefined,
    timeWindow: values.timeWindow,
    fullVersion: trimmed(values.fullVersion),
    backupPlan: trimmed(values.backupPlan),
    pairWith: trimmed(values.pairWith),
    startsOn: values.start === "monday" ? nextMondayKey(today()) : undefined,
    reminderEnabled: values.reminderEnabled,
    // Always sent, so turning the amount off on an edit clears it.
    ...measureFields(values),
  };
}

function measureFields(values: HabitFormValues) {
  const num = (s: string) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const target = values.measureOn ? num(values.measureTarget) : null;
  return {
    measureTarget: target,
    measureTiny: target ? num(values.measureTiny) : null,
    measureUnit: target ? values.measureUnit.trim() || null : null,
  };
}

export function HabitForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
  isNew = false,
  readings,
}: {
  values: HabitFormValues;
  onChange: (next: HabitFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  saving?: boolean;
  error?: string | null;
  /** New habits require a tiny version and can start on Monday. Existing
   *  ones built before the tiny version existed can still be saved. */
  isNew?: boolean;
  /**
   * Kinextion's tidied reading of each field, and the raw text it was read
   * from. Shown under a field while that field is unchanged, so the tidy-up
   * is visible rather than silent.
   */
  readings?: Partial<Record<PolishedField, { from: string; text: string }>>;
}) {
  // Open by default when the user has already filled an extra, so editing
  // never hides content behind a collapsed section.
  const [showExtras, setShowExtras] = useState(
    Boolean(values.backupPlan || values.pairWith || values.reward),
  );

  const accent = categoryColor[values.category];
  const set = <K extends keyof HabitFormValues>(
    key: K,
    value: HabitFormValues[K],
  ) => onChange({ ...values, [key]: value });

  const isMonday = nextMondayKey(today()) === today();
  const missingTiny = isNew && values.response.trim().length === 0;
  const canSubmit = values.name.trim().length > 0 && !missingTiny && !saving;
  /** The reading for a field, if it still applies to what's in the box. */
  const readingFor = (field: PolishedField): string | null => {
    const r = readings?.[field];
    if (!r || r.from !== values[field]) return null;
    return r.text.trim() && r.text.trim() !== values[field].trim()
      ? r.text
      : null;
  };
  /** What the app will show for a field: the reading, else a basic tidy. */
  const shown = (field: PolishedField) =>
    readingFor(field) ?? basicTidy(values[field]);
  const preview = describeHabitPlan({
    ...values,
    cue: shown("cue"),
    response: shown("response"),
    backupPlan: shown("backupPlan"),
  });

  return (
    <View style={{ gap: space.lg }}>
      {/* ── 1. What ─────────────────────────────────────────────────── */}
      <Card accent={accent}>
        <View style={{ gap: space.lg }}>
          <Field
            label="The habit"
            value={values.name}
            onChangeText={(v) => set("name", v)}
            placeholder="Push-ups"
            maxLength={100}
            accent={accent}
            hint="Name it as the thing you do, not the outcome you want."
          />
          <View style={{ gap: space.sm }}>
            <Label>Part of life</Label>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {WELLNESS_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={WELLNESS_LABELS[c]}
                  accent={categoryColor[c as Category]}
                  selected={values.category === c}
                  onPress={() => set("category", c as Category)}
                />
              ))}
            </View>
            <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
              {HABIT_CATEGORY_HINTS[values.category]}
            </Txt>
          </View>
        </View>
      </Card>

      {/* ── 2. After I… ─────────────────────────────────────────────── */}
      <Card>
        <View style={{ gap: space.md }}>
          <Field
            label="When does it happen?"
            value={values.cue}
            onChangeText={(v) => set("cue", v)}
            placeholder="After I pour my coffee"
            maxLength={200}
            accent={accent}
            hint="Attach it to something you already do every day."
          />
          <Reading text={readingFor("cue")} />
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {ANCHORS.map((a) => (
              <Chip
                key={a}
                label={a}
                accent={accent}
                selected={values.cue === a}
                onPress={() => set("cue", a)}
              />
            ))}
          </View>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Label>Part of the day</Label>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {WINDOWS.map((w) => (
                <Chip
                  key={w.value}
                  label={w.label}
                  accent={accent}
                  selected={values.timeWindow === w.value}
                  onPress={() => set("timeWindow", w.value)}
                />
              ))}
            </View>
            {values.timeWindow === "anytime" ? (
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
                Any-time habits only appear in the evening "still open" nudge.
              </Txt>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  marginTop: space.xs,
                }}
              >
                <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                  Remind me when this part of the day starts
                </Txt>
                <Switch
                  value={values.reminderEnabled}
                  onValueChange={(v) => set("reminderEnabled", v)}
                  trackColor={{ true: accent }}
                  accessibilityLabel="Remind me"
                />
              </View>
            )}
          </View>
        </View>
      </Card>

      {/* ── 3. Tiny version ────────────────────────────────────────── */}
      {/* Asked as a pair, usual version first, because people think in
          their normal version; the tiny one only makes sense next to it.
          A worked example closest to what they're building makes the idea
          land without having to explain it. */}
      <Card>
        <View style={{ gap: space.md }}>
          <View>
            <Txt variant="bodyStrong">Make it easy on bad days</Txt>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: 2 }}>
              Some days you&apos;ll be tired, busy or not feeling it. Decide now
              what still counts, so a bad day never breaks the habit.
            </Txt>
          </View>
          <Field
            label="Your usual version (optional)"
            value={values.fullVersion}
            onChangeText={(v) => set("fullVersion", v)}
            placeholder={tinyExampleFor(values.name).full}
            maxLength={200}
            accent={accent}
          />
          <Field
            label={
              isNew
                ? "Your tiny version, for bad days"
                : "Your tiny version, for bad days (recommended)"
            }
            value={values.response}
            onChangeText={(v) => set("response", v)}
            placeholder={tinyExampleFor(values.name).tiny}
            maxLength={200}
            accent={accent}
            hint="The easiest version that still counts. Doing it keeps your streak."
          />
          <Reading text={readingFor("response")} />
          <TinyExamples name={values.name} accent={accent} />

          {/* Amounts: for habits people count, like water, pages or minutes. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Chip
              label={values.measureOn ? "Counting an amount" : "Count an amount instead"}
              icon={values.measureOn ? "checkmark" : "add"}
              accent={accent}
              selected={values.measureOn}
              onPress={() => set("measureOn", !values.measureOn)}
            />
          </View>
          {values.measureOn ? (
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Usual amount"
                    value={values.measureTarget}
                    onChangeText={(v) => set("measureTarget", v.replace(/[^0-9.,]/g, ""))}
                    placeholder="8"
                    maxLength={7}
                    accent={accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Tiny amount"
                    value={values.measureTiny}
                    onChangeText={(v) => set("measureTiny", v.replace(/[^0-9.,]/g, ""))}
                    placeholder="2"
                    maxLength={7}
                    accent={accent}
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {MEASURE_UNITS.map((u) => (
                  <Chip key={u} label={u} accent={accent} selected={values.measureUnit === u} onPress={() => set("measureUnit", u)} />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint}>
                Log how much each day. The usual amount is done, the tiny amount still counts.
              </Txt>
            </View>
          ) : null}
        </View>
      </Card>

      {/* ── 4. How often ───────────────────────────────────────────── */}
      <Card>
        <View style={{ gap: space.sm }}>
          <Label>How often</Label>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            {(
              [
                ["daily", "Every day"],
                ["custom", "Certain days"],
                ["weekly", "Times a week"],
              ] as const
            ).map(([f, label]) => (
              <Chip
                key={f}
                label={label}
                accent={accent}
                selected={values.frequency === f}
                onPress={() => set("frequency", f)}
              />
            ))}
          </View>

          {values.frequency === "custom" ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <View
                style={{
                  flexDirection: "row",
                  gap: space.xs,
                  marginTop: space.sm,
                }}
              >
                {DAY_LABELS.map((label, index) => {
                  const on = values.targetDays.includes(index);
                  return (
                    <PressCard
                      key={index}
                      haptic="none"
                      onPress={() => {
                        void Haptics.selectionAsync();
                        set(
                          "targetDays",
                          on
                            ? values.targetDays.filter((d) => d !== index)
                            : [...values.targetDays, index].sort(),
                        );
                      }}
                      style={{
                        flex: 1,
                        padding: 0,
                        paddingVertical: space.md,
                        alignItems: "center",
                        backgroundColor: on
                          ? tint(accent, 0.16)
                          : "transparent",
                        borderColor: on ? tint(accent, 0.4) : color.border,
                        borderRadius: radius.sm,
                        shadowOpacity: 0,
                        elevation: 0,
                      }}
                    >
                      <Txt variant="small" c={on ? accent : color.textFaint}>
                        {label}
                      </Txt>
                    </PressCard>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {values.frequency === "weekly" ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{ gap: space.sm, marginTop: space.sm }}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: space.sm,
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Chip
                    key={n}
                    label={n === 1 ? "Once" : `${n} times`}
                    accent={accent}
                    selected={values.perWeekTarget === n}
                    onPress={() => set("perWeekTarget", n)}
                  />
                ))}
              </View>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
                Any days that suit you. It leaves your list once the week&apos;s
                done.
              </Txt>
            </Animated.View>
          ) : null}
        </View>
      </Card>

      {/* ── 5. Why ─────────────────────────────────────────────────── */}
      <Card>
        <Field
          label="Why does this matter to you?"
          value={values.craving}
          onChangeText={(v) => set("craving", v)}
          placeholder="I think more clearly after moving"
          maxLength={200}
          accent={accent}
          hint="In your words. Kinextion will remind you of it on the days it's hard."
        />
        <Reading text={readingFor("craving")} />
      </Card>

      {/* ── Extras, optional ───────────────────────────────────────── */}
      <PressCard
        haptic="light"
        onPress={() => setShowExtras((v) => !v)}
        style={{ padding: space.lg }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <Ionicons name="sparkles-outline" size={18} color={color.amber} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Make it stick</Txt>
            <Txt variant="small" c={color.textMuted} style={{ marginTop: 1 }}>
              A backup plan, something to pair it with, the payoff. All
              optional.
            </Txt>
          </View>
          <Ionicons
            name={showExtras ? "chevron-up" : "chevron-down"}
            size={18}
            color={color.textFaint}
          />
        </View>
      </PressCard>

      {showExtras ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <Card>
            <View style={{ gap: space.lg }}>
              <Field
                label="If something gets in the way"
                value={values.backupPlan}
                onChangeText={(v) => set("backupPlan", v)}
                placeholder="If I get home late, I'll do the tiny version before dinner"
                maxLength={300}
                accent={accent}
                hint="Plan for the most likely obstacle now, so you don't have to think later."
              />
              <Reading text={readingFor("backupPlan")} />
              <Field
                label="Pair it with"
                value={values.pairWith}
                onChangeText={(v) => set("pairWith", v)}
                placeholder="Only listen to my podcast on the walk"
                maxLength={200}
                accent={accent}
              />
              <Field
                label="Today's payoff"
                value={values.reward}
                onChangeText={(v) => set("reward", v)}
                placeholder="Coffee when I get back"
                maxLength={200}
                accent={accent}
              />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {/* ── Start ──────────────────────────────────────────────────── */}
      {isNew && !isMonday ? (
        <View style={{ gap: space.sm }}>
          <Label>Start</Label>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            <Chip
              label="Today"
              accent={accent}
              selected={values.start === "today"}
              onPress={() => set("start", "today")}
            />
            <Chip
              label="Monday · a fresh start"
              accent={accent}
              selected={values.start === "monday"}
              onPress={() => set("start", "monday")}
            />
          </View>
        </View>
      ) : null}

      {/* ── Preview: the plan, written out ─────────────────────────── */}
      {values.name.trim() ? (
        <Card accent={accent}>
          <Label c={accent}>Your plan</Label>
          <Txt variant="bodyStrong" style={{ marginTop: space.sm }}>
            {preview.plan}
          </Txt>
          {preview.extras.map((line) => (
            <Txt
              key={line}
              variant="small"
              c={color.textMuted}
              style={{ marginTop: 3 }}
            >
              {line}
            </Txt>
          ))}
        </Card>
      ) : null}

      {error ? (
        <Txt variant="small" c={color.red}>
          {error}
        </Txt>
      ) : null}

      {missingTiny && values.name.trim() ? (
        <Pressable
          onPress={() => set("response", values.name.trim())}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Txt variant="small" c={color.textMuted}>
            Add a tiny version to save it. Not sure? Tap here to use the habit
            itself for now.
          </Txt>
        </Pressable>
      ) : null}

      <Button
        label={submitLabel}
        accent={accent}
        loading={saving}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </View>
  );
}

/** "How Kinextion reads this": the tidied version, under the user's own. */
function Reading({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: "row", gap: space.sm, marginTop: -space.xs }}>
      <Ionicons
        name="sparkles-outline"
        size={13}
        color={color.textFaint}
        style={{ marginTop: 2 }}
      />
      <Txt
        variant="small"
        c={color.textFaint}
        style={{ flex: 1, fontSize: 12 }}
      >
        How Kinextion reads this: {text}
      </Txt>
    </View>
  );
}

// ─── Tiny version examples ────────────────────────────────────────────────────

const TINY_EXAMPLES: Array<{ match: RegExp; full: string; tiny: string }> = [
  {
    match: /push|press/i,
    full: "10 push-ups",
    tiny: "5 push-ups on your knees",
  },
  {
    match: /read|book|page/i,
    full: "Read for 20 minutes",
    tiny: "Read one page",
  },
  {
    match: /walk|step/i,
    full: "A 30-minute walk",
    tiny: "Walk to the end of the street",
  },
  {
    match: /run|jog/i,
    full: "A 5k run",
    tiny: "Put on your running shoes and jog one block",
  },
  {
    match: /journal|write|diary/i,
    full: "Write a page",
    tiny: "Write one sentence",
  },
  {
    match: /meditat|breath|mindful/i,
    full: "10 minutes of meditation",
    tiny: "Three slow breaths",
  },
  {
    match: /gym|lift|train|workout|strength/i,
    full: "A full gym session",
    tiny: "Put on your gear and do one warm-up set",
  },
  {
    match: /water|drink|hydrat/i,
    full: "8 glasses of water",
    tiny: "One glass when you wake up",
  },
  {
    match: /stretch|yoga|mobil/i,
    full: "20 minutes of yoga",
    tiny: "One minute of stretching",
  },
  {
    match: /sleep|bed|phone|screen/i,
    full: "Phone away by 10pm",
    tiny: "Phone on the charger across the room",
  },
];

/** The example closest to what they're building, push-ups if nothing matches. */
function tinyExampleFor(name: string) {
  return TINY_EXAMPLES.find((e) => e.match.test(name)) ?? TINY_EXAMPLES[0];
}

/**
 * Worked examples: the closest one to their habit first, then two others,
 * so the idea ("the same habit, made tiny") is obvious at a glance.
 */
function TinyExamples({ name, accent }: { name: string; accent: string }) {
  const first = tinyExampleFor(name);
  const rest = TINY_EXAMPLES.filter((e) => e !== first).slice(0, 2);
  return (
    <View
      style={{
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: tint(accent, 0.06),
        borderWidth: 1,
        borderColor: tint(accent, 0.18),
      }}
    >
      <Label c={accent}>For example</Label>
      {[first, ...rest].map((e) => (
        <View
          key={e.full}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
            {e.full}
          </Txt>
          <Ionicons name="arrow-forward" size={12} color={color.textFaint} />
          <Txt
            variant="small"
            c={accent}
            style={{ flex: 1, fontWeight: "600" }}
          >
            {e.tiny}
          </Txt>
        </View>
      ))}
    </View>
  );
}
