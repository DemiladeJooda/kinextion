/**
 * Micro Recommendations — one precise, context-aware action per day.
 *
 * This is a real Claude call, not a rotating list of tips: the day's actual
 * state (habits done, streaks, mood, time of day) is sent to Althea and she
 * returns a single two-minute action. Because it runs against the same
 * `/api/chat` route as the guides, it inherits the safety rules and the app
 * format rules for free.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { ChatError, streamChat } from "../lib/api";
import { useAppState } from "../lib/store";
import { Badge, Card, Txt, TypingDots } from "./ui";
import { color, radius, space, tint } from "../theme";

interface DaySnapshot {
  done: number;
  total: number;
  longestStreak: number;
  slipping: string[];
  moodLogged: boolean;
  hour: number;
}

/** Compact snapshot of the day, written for the model rather than for a human. */
function buildContextLine(args: DaySnapshot): string {
  const { done, total, longestStreak, slipping, moodLogged, hour } = args;

  return [
    `It's ${partOfDay(hour)}.`,
    `Habits today: ${done} of ${total} done.`,
    longestStreak > 0 ? `Longest active streak: ${longestStreak} days.` : "No active streak.",
    slipping.length ? `Not yet done: ${slipping.join(", ")}.` : "Everything is done.",
    moodLogged ? "Mood checked in." : "No mood check-in yet.",
  ].join(" ");
}

function partOfDay(hour: number): string {
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/**
 * The exact signals this recommendation was built from.
 *
 * Shown under the action, because "why this one" is only credible if you can
 * see what it was reading. Every chip here comes from real local state — if a
 * signal isn't connected, it doesn't get a chip.
 */
function readingChips(s: DaySnapshot): string[] {
  const chips = [partOfDay(s.hour), `${s.done}/${s.total} habits`];
  if (s.longestStreak > 0) chips.push(`${s.longestStreak}-day streak`);
  if (s.moodLogged) chips.push("mood logged");
  if (s.slipping.length) chips.push(`${s.slipping.length} left`);
  return chips;
}

/**
 * Two labelled lines rather than a paragraph.
 *
 * The action and the reason do different jobs — one is something you do in the
 * next two minutes, the other is why it's that and not something else — so
 * they're parsed apart and rendered at different weights.
 */
const PROMPT_SUFFIX =
  "Give me exactly one micro-action for right now — something that takes two minutes or less and fits what's actually left in my day.\n" +
  "Reply in exactly two lines, in this format, and nothing else:\n" +
  "ACTION: the thing to do, under 15 words, starting with a verb\n" +
  "WHY: one sentence on why this one, referring to the specifics above\n" +
  "No preamble, no list, no bold text, no greeting.";

/** Split the labelled reply. Works on partial text so it can parse mid-stream. */
function parseReply(text: string): { action: string; why: string } {
  const actionMatch = /ACTION:\s*([\s\S]*?)(?:\n\s*WHY:|$)/i.exec(text);
  const whyMatch = /WHY:\s*([\s\S]*)$/i.exec(text);
  const action = actionMatch?.[1]?.trim() ?? "";
  const why = whyMatch?.[1]?.trim() ?? "";
  // Before the first label arrives, show the raw stream rather than nothing.
  if (!action && !why) return { action: text.trim(), why: "" };
  return { action, why };
}

export function MicroRecommendation() {
  const { habits, moodLogged } = useAppState();
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);
  const [chips, setChips] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  // Snapshot the habit state at fetch time so toggling a habit mid-request
  // doesn't retrigger and cancel an in-flight recommendation.
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const moodRef = useRef(moodLogged);
  moodRef.current = moodLogged;

  const fetchRecommendation = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setText("");
    setDone(false);

    const current = habitsRef.current;
    const snapshot = {
      done: current.filter((h) => h.done).length,
      total: current.length,
      longestStreak: current.reduce((m, h) => Math.max(m, h.streak), 0),
      slipping: current.filter((h) => !h.done).map((h) => h.name),
      moodLogged: moodRef.current,
      hour: new Date().getHours(),
    };
    const context = buildContextLine(snapshot);
    setChips(readingChips(snapshot));

    try {
      await streamChat({
        guide: "altheo",
        messages: [{ role: "user", content: `${context}\n\n${PROMPT_SUFFIX}` }],
        signal: controller.signal,
        onDelta: (full) => setText(full),
      });
      setState("ready");
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMsg(
        err instanceof ChatError ? err.message : "Couldn't load today's action."
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    void fetchRecommendation();
    return () => abortRef.current?.abort();
  }, [fetchRecommendation]);

  const parsed = parseReply(text);

  return (
    <Card accent={color.purple}>
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
            width: 28,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: tint(color.purple, 0.16),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles" size={15} color={color.purple} />
        </View>
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          Micro Recommendation
        </Txt>
        <Badge label="Live AI" accent={color.purple} />
      </View>

      {state === "loading" && !text ? (
        <View style={{ paddingVertical: space.md }}>
          <TypingDots accent={color.purple} />
          <Txt variant="small" c={color.textFaint} style={{ marginTop: space.sm }}>
            Reading your day…
          </Txt>
        </View>
      ) : state === "error" ? (
        <View>
          <Txt variant="body" c={color.textMuted}>
            {errorMsg}
          </Txt>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void fetchRecommendation();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: space.md,
            }}
          >
            <Ionicons name="refresh" size={14} color={color.purple} />
            <Txt variant="small" c={color.purple}>
              Try again
            </Txt>
          </Pressable>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)}>
          <Txt variant="bodyStrong" style={{ opacity: done ? 0.5 : 1 }}>
            {parsed.action}
          </Txt>

          {parsed.why ? (
            <View
              style={{
                flexDirection: "row",
                gap: space.sm,
                marginTop: space.md,
                paddingTop: space.md,
                borderTopWidth: 1,
                borderTopColor: color.border,
                opacity: done ? 0.5 : 1,
              }}
            >
              <Ionicons name="git-branch-outline" size={14} color={color.purple} style={{ marginTop: 3 }} />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                {parsed.why}
              </Txt>
            </View>
          ) : null}

          {/* What it was reading — the receipts for the line above. */}
          {chips.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: space.md }}>
              {chips.map((c) => (
                <View
                  key={c}
                  style={{
                    paddingHorizontal: space.sm,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: color.border,
                  }}
                >
                  <Txt variant="small" c={color.textFaint} style={{ fontSize: 10 }}>
                    {c}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
            <Pressable
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setDone(true);
              }}
              disabled={done}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: 999,
                backgroundColor: tint(done ? color.green : color.purple, 0.14),
                borderWidth: 1,
                borderColor: tint(done ? color.green : color.purple, 0.3),
              }}
            >
              <Ionicons
                name={done ? "checkmark-circle" : "checkmark"}
                size={15}
                color={done ? color.green : color.purple}
              />
              <Txt variant="small" c={done ? color.green : color.purple}>
                {done ? "Done" : "I did it"}
              </Txt>
            </Pressable>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void fetchRecommendation();
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: color.border,
              }}
            >
              <Ionicons name="shuffle" size={15} color={color.textMuted} />
              <Txt variant="small" c={color.textMuted}>
                Something else
              </Txt>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Card>
  );
}
