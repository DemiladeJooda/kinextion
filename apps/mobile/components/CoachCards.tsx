/**
 * The coach loop, as cards on Today rather than a chat.
 *
 *   WhatWouldItTakeCard  after a miss: the question, one-tap answers, then
 *                        the guide's reply and one change to apply
 *   PromiseCard          in the evening: "Tomorrow, I'll …"
 *   WeekReviewCard       Sunday evening and Monday: how the week went
 *   RestartCard          the first days of a month: restart paused habits
 *   ConcernCard          something the user wrote sounded heavy
 *
 * Each says one thing and offers one action. None of them nags: every card
 * can be dismissed, and a dismissed question isn't asked again.
 */

import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  QUICK_ANSWERS,
  coachFor,
  describeChange,
  whatWouldItTake,
  type WeekReview,
} from "@kinextion/shared";

import { Card, Chip, Txt, TypingDots } from "./ui";
import type { Habit } from "../lib/store";
import type { ReflectResult } from "../services";
import { color, radius, space, tint } from "../theme";

const GUIDE = {
  altheo: { name: "Altheo", accent: color.green },
  kairo: { name: "Kairo", accent: color.purple },
} as const;

function LinkButton({
  label,
  accent,
  onPress,
  muted,
}: {
  label: string;
  accent: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Txt
        variant="small"
        c={muted ? color.textFaint : accent}
        style={muted ? undefined : { fontWeight: "700" }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

// ─── What would it take? ──────────────────────────────────────────────────────

type Phase =
  | { kind: "ask" }
  | { kind: "thinking" }
  | { kind: "answered"; result: ReflectResult }
  | { kind: "applied"; text: string }
  | { kind: "error" };

export function WhatWouldItTakeCard({
  habit,
  onAnswer,
  onApply,
  onTalkToKairo,
}: {
  habit: Habit;
  /** null = "Not now". */
  onAnswer: (answer: string | null) => Promise<ReflectResult>;
  onApply: (reflectionId: string) => Promise<void>;
  onTalkToKairo: () => void;
}) {
  const guide = GUIDE[coachFor(habit.category)];
  const [phase, setPhase] = useState<Phase>({ kind: "ask" });
  const [text, setText] = useState("");

  const send = async (answer: string) => {
    if (!answer.trim()) return;
    setPhase({ kind: "thinking" });
    try {
      setPhase({ kind: "answered", result: await onAnswer(answer.trim()) });
    } catch {
      setPhase({ kind: "error" });
    }
  };

  const apply = async (result: ReflectResult) => {
    try {
      await onApply(result.reflection.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase({
        kind: "applied",
        text:
          result.change && result.change.type !== "none"
            ? "Done. Tomorrow's version is ready."
            : "Saved as your backup plan.",
      });
    } catch {
      setPhase({ kind: "error" });
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <Card accent={guide.accent}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginBottom: space.md,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: tint(guide.accent, 0.18),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt
              variant="small"
              c={guide.accent}
              style={{ fontWeight: "800", fontSize: 11 }}
            >
              {guide.name[0]}
            </Txt>
          </View>
          <Txt variant="small" c={guide.accent} style={{ fontWeight: "700" }}>
            {guide.name}
          </Txt>
        </View>

        {phase.kind === "ask" ? (
          <View style={{ gap: space.md }}>
            <Txt variant="bodyStrong">{whatWouldItTake(habit.name)}</Txt>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
            >
              {QUICK_ANSWERS.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  accent={guide.accent}
                  onPress={() => void send(a)}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                borderWidth: 1,
                borderColor: color.border,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Or say it in your own words"
                placeholderTextColor={color.textFaint}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => void send(text)}
                style={{
                  flex: 1,
                  color: color.text,
                  paddingVertical: space.md,
                }}
              />
              {text.trim() ? (
                <Pressable
                  onPress={() => void send(text)}
                  accessibilityLabel="Send"
                  hitSlop={8}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={24}
                    color={guide.accent}
                  />
                </Pressable>
              ) : null}
            </View>
            <LinkButton
              label="Not now"
              accent={guide.accent}
              muted
              onPress={() => void onAnswer(null)}
            />
          </View>
        ) : phase.kind === "thinking" ? (
          <View style={{ paddingVertical: space.sm }}>
            <TypingDots accent={guide.accent} />
          </View>
        ) : phase.kind === "answered" ? (
          <Animated.View
            entering={FadeIn.duration(250)}
            style={{ gap: space.md }}
          >
            <Txt variant="body">{phase.result.reply}</Txt>
            {phase.result.concern ? (
              <LinkButton
                label="Talk it through with Kairo →"
                accent={color.purple}
                onPress={onTalkToKairo}
              />
            ) : phase.result.change && phase.result.change.type !== "none" ? (
              <View style={{ gap: space.sm }}>
                <Pressable
                  onPress={() => void apply(phase.result)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: tint(guide.accent, 0.4),
                    backgroundColor: tint(guide.accent, pressed ? 0.18 : 0.1),
                  })}
                >
                  <Txt variant="bodyStrong" c={guide.accent}>
                    {describeChange(phase.result.change)}
                  </Txt>
                  {phase.result.backupPlan ? (
                    <Txt
                      variant="small"
                      c={color.textMuted}
                      style={{ marginTop: 3 }}
                    >
                      And a backup plan: {phase.result.backupPlan}
                    </Txt>
                  ) : null}
                </Pressable>
                <LinkButton
                  label="Keep it as it is"
                  accent={guide.accent}
                  muted
                  onPress={() =>
                    setPhase({
                      kind: "applied",
                      text: "Okay. It stays as it is.",
                    })
                  }
                />
              </View>
            ) : phase.result.backupPlan ? (
              <View style={{ gap: space.sm }}>
                <Txt variant="small" c={color.textMuted}>
                  Backup plan: {phase.result.backupPlan}
                </Txt>
                <LinkButton
                  label="Save it"
                  accent={guide.accent}
                  onPress={() => void apply(phase.result)}
                />
              </View>
            ) : null}
          </Animated.View>
        ) : phase.kind === "applied" ? (
          <Txt variant="small" c={color.textMuted}>
            {phase.text}
          </Txt>
        ) : (
          <View style={{ gap: space.sm }}>
            <Txt variant="small" c={color.textMuted}>
              Couldn&apos;t reach {guide.name} just now.
            </Txt>
            <LinkButton
              label="Try again"
              accent={guide.accent}
              onPress={() => setPhase({ kind: "ask" })}
            />
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

// ─── Tomorrow, I'll … ─────────────────────────────────────────────────────────

/**
 * A promise made the night before. Tapping habits is the whole interaction:
 * the promise is written from each habit's own plan, so there's nothing to
 * type, and tomorrow's reminder quotes it back.
 */
export function PromiseCard({
  habits,
  onPromise,
}: {
  habits: Habit[];
  onPromise: (habitIds: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (habits.length === 0) return null;

  if (saved) {
    return (
      <Card accent={color.blue}>
        <Txt variant="bodyStrong" c={color.blue}>
          Promised for tomorrow
        </Txt>
        <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
          {saved.join(", ")}. Your morning reminder will say it back to you.
        </Txt>
      </Card>
    );
  }

  return (
    <Card accent={color.blue}>
      <Txt variant="bodyStrong" c={color.blue}>
        Tomorrow, I&apos;ll…
      </Txt>
      <Txt
        variant="small"
        c={color.textMuted}
        style={{ marginTop: 3, marginBottom: space.md }}
      >
        Pick what you&apos;re promising yourself. Saying it tonight makes it
        easier tomorrow.
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {habits.map((h) => (
          <Chip
            key={h.id}
            label={h.name}
            accent={color.blue}
            selected={picked.includes(h.id)}
            onPress={() =>
              setPicked((p) =>
                p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id],
              )
            }
          />
        ))}
      </View>
      {picked.length ? (
        <View style={{ marginTop: space.md }}>
          <LinkButton
            label={busy ? "Saving…" : "Promise it →"}
            accent={color.blue}
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await onPromise(picked);
                setSaved(
                  habits
                    .filter((h) => picked.includes(h.id))
                    .map((h) => h.name),
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

// ─── Your week ────────────────────────────────────────────────────────────────

export function WeekReviewCard({
  review,
  onAdjust,
}: {
  review: WeekReview;
  onAdjust: (habitId: string) => void;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden || review.due === 0) return null;

  return (
    <Card accent={color.teal}>
      <Txt variant="bodyStrong" c={color.teal}>
        Your week: {review.kept} of {review.due} kept
      </Txt>
      <View style={{ gap: 3, marginTop: space.sm }}>
        {review.best ? (
          <Txt variant="small" c={color.textMuted}>
            Holding best: {review.best.name}.
          </Txt>
        ) : null}
        {review.slipping ? (
          <Txt variant="small" c={color.textMuted}>
            {review.slipping.name} was {review.slipping.kept} of{" "}
            {review.slipping.due}. A new week is a good moment to make it
            easier.
          </Txt>
        ) : (
          <Txt variant="small" c={color.textMuted}>
            Nothing slipping. Same again this week.
          </Txt>
        )}
      </View>
      <View
        style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}
      >
        {review.slipping ? (
          <LinkButton
            label={`Adjust ${review.slipping.name} →`}
            accent={color.teal}
            onPress={() => onAdjust(review.slipping!.id)}
          />
        ) : null}
        <LinkButton
          label="Dismiss"
          accent={color.teal}
          muted
          onPress={() => setHidden(true)}
        />
      </View>
    </Card>
  );
}

// ─── Restart paused habits ────────────────────────────────────────────────────

export function RestartCard({
  habits,
  onRestart,
}: {
  habits: Habit[];
  onRestart: (habitId: string) => Promise<void>;
}) {
  const [done, setDone] = useState<string[]>([]);
  const left = habits.filter((h) => !done.includes(h.id));
  if (left.length === 0) return null;
  const h = left[0];

  return (
    <Card accent={color.green}>
      <Txt variant="bodyStrong" c={color.green}>
        A new month. Restart {h.name}?
      </Txt>
      <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
        It&apos;s been paused. The days off won&apos;t count against it.
      </Txt>
      <View
        style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}
      >
        <LinkButton
          label="Restart it"
          accent={color.green}
          onPress={async () => {
            await onRestart(h.id);
            setDone((d) => [...d, h.id]);
          }}
        />
        <LinkButton
          label="Not yet"
          accent={color.green}
          muted
          onPress={() => setDone((d) => [...d, h.id])}
        />
      </View>
    </Card>
  );
}

// ─── Something sounded heavy ──────────────────────────────────────────────────

export function ConcernCard({ onTalk }: { onTalk: () => void }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Card accent={color.purple}>
      <Txt variant="bodyStrong" c={color.purple}>
        Something you wrote sounded heavy
      </Txt>
      <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
        No pressure. If you want to talk it through, Kairo&apos;s here — or
        reach someone you trust.
      </Txt>
      <View
        style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}
      >
        <LinkButton
          label="Talk to Kairo →"
          accent={color.purple}
          onPress={onTalk}
        />
        <LinkButton
          label="Not now"
          accent={color.purple}
          muted
          onPress={() => setHidden(true)}
        />
      </View>
    </Card>
  );
}

// ─── Healthy use ──────────────────────────────────────────────────────────────

/**
 * Kairo checking in when the app itself looks like the compulsion. Says
 * what was noticed, offers a conversation, and goes away when asked.
 */
export function UsageCard({
  concern,
  onTalk,
  onDismiss,
}: {
  concern: { title: string; body: string };
  onTalk: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card accent={color.purple}>
      <Txt
        variant="small"
        c={color.purple}
        style={{ fontWeight: "700", marginBottom: space.xs }}
      >
        Kairo
      </Txt>
      <Txt variant="bodyStrong">{concern.title}</Txt>
      <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
        {concern.body}
      </Txt>
      <View
        style={{ flexDirection: "row", gap: space.lg, marginTop: space.md }}
      >
        <LinkButton
          label="Talk to Kairo →"
          accent={color.purple}
          onPress={onTalk}
        />
        <LinkButton
          label="I'm okay"
          accent={color.purple}
          muted
          onPress={onDismiss}
        />
      </View>
    </Card>
  );
}
