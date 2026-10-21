/**
 * Micro Recommendations — one precise, context-aware action per day.
 *
 * This card used to stream a fresh action from the chat route on every mount
 * and throw it away: "I did it" set a local boolean, "Something else"
 * regenerated, and neither ever left the phone. The suggestion was real, but
 * the system had no way of finding out whether it was any good.
 *
 * Now the recommendation is generated and stored server-side, both buttons
 * write a real outcome against its id, and that history is read back into the
 * next generation. Two consequences the user can see:
 *
 *   - the card survives a reload with its state intact, because it's a row
 *     rather than a render;
 *   - "Learned from you" shows what the feedback has actually taught it, in
 *     the same words the generator is given.
 *
 * It offers two options first. Choosing between two feels like your own
 * decision rather than being told what to do (Possibilities, in Zoe Chance's
 * 4Ps), and the pick itself is a signal: the option passed over is kept on
 * the row. Once one is picked, the card is the single action as before.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { useApi } from "../hooks/useApi";
import type { RemoteRecommendation } from "../services";
import { Badge, Card, Txt, TypingDots } from "./ui";
import {
  categoryColor,
  color,
  radius,
  space,
  tint,
  type Category,
} from "../theme";

type Phase = "loading" | "ready" | "error";

export function MicroRecommendation() {
  const api = useApi();
  const router = useRouter();

  const [recommendation, setRecommendation] =
    useState<RemoteRecommendation | null>(null);
  const [basis, setBasis] = useState<string[]>([]);
  const [learned, setLearned] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Guards against a late response from a request the user has moved past —
  // tapping "something else" twice quickly shouldn't leave the older reply on
  // screen.
  const requestId = useRef(0);

  const load = useCallback(
    async (options: { refresh?: boolean } = {}) => {
      const id = ++requestId.current;
      setPhase(options.refresh ? "ready" : "loading");
      setBusy(true);

      try {
        const result = await api.requestRecommendation(options);
        if (id !== requestId.current) return;
        setRecommendation(result.recommendation);
        setBasis(result.basis);
        setLearned(result.learned);
        setPhase("ready");
      } catch (err) {
        if (id !== requestId.current) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Couldn't load today's action.",
        );
        setPhase("error");
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Optimistic, but honest about it.
   *
   * The tap is confirmed instantly because waiting on a round trip to strike
   * out a line feels broken. If the write fails the flag is put back and the
   * user is told, rather than the app quietly showing a "done" the server
   * never recorded — which would be the one thing worse than no feedback loop:
   * a feedback loop that silently drops the feedback.
   */
  const respond = async (outcome: "acted" | "dismissed") => {
    if (!recommendation || busy) return;

    const previous = recommendation;
    setRecommendation({
      ...recommendation,
      acted: outcome === "acted",
      dismissed: outcome === "dismissed",
    });
    void Haptics.notificationAsync(
      outcome === "acted"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );

    try {
      await api.sendRecommendationFeedback(previous.id, outcome);
    } catch {
      setRecommendation(previous);
      setErrorMsg("Couldn't save that — tap again?");
    }
  };

  /** Pick one of the two. Optimistic, rolled back if the write fails. */
  const choose = async (option: "primary" | "alternative") => {
    if (!recommendation || busy) return;
    const previous = recommendation;
    const now = new Date().toISOString();
    setRecommendation(
      option === "alternative" && previous.alternative
        ? {
            ...previous,
            content: previous.alternative,
            category: previous.alternativeCategory ?? previous.category,
            context: previous.alternativeContext ?? null,
            alternative: previous.content,
            alternativeCategory: previous.category,
            alternativeContext: previous.context,
            chosenAt: now,
          }
        : { ...previous, chosenAt: now },
    );
    void Haptics.selectionAsync();
    try {
      setRecommendation(await api.chooseRecommendation(previous.id, option));
    } catch {
      setRecommendation(previous);
      setErrorMsg("Couldn't save that — tap again?");
    }
  };

  const choosing = Boolean(
    recommendation?.alternative && !recommendation?.chosenAt,
  );

  const accent = recommendation
    ? (categoryColor[recommendation.category as Category] ?? color.purple)
    : color.purple;
  const done = recommendation?.acted ?? false;

  return (
    <Card accent={done ? color.green : color.purple}>
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
            backgroundColor: tint(done ? color.green : color.purple, 0.16),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={done ? "checkmark" : "sparkles"}
            size={15}
            color={done ? color.green : color.purple}
          />
        </View>
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          Micro Recommendation
        </Txt>
        <Badge
          label={learned.length ? "Learning" : "Live AI"}
          accent={done ? color.green : color.purple}
        />
      </View>

      {phase === "loading" ? (
        <View style={{ paddingVertical: space.md }}>
          <TypingDots accent={color.purple} />
          <Txt
            variant="small"
            c={color.textFaint}
            style={{ marginTop: space.sm }}
          >
            {learned.length
              ? "Reading your day and what's worked before…"
              : "Reading your day…"}
          </Txt>
        </View>
      ) : phase === "error" || !recommendation ? (
        <View>
          <Txt variant="body" c={color.textMuted}>
            {errorMsg}
          </Txt>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void load();
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
      ) : choosing ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ gap: space.sm }}
        >
          <Txt variant="small" c={color.textMuted}>
            Two small things. Pick whichever sounds easier right now.
          </Txt>
          {(
            [
              [
                "primary",
                recommendation.content,
                recommendation.context,
                recommendation.category,
              ],
              [
                "alternative",
                recommendation.alternative ?? "",
                recommendation.alternativeContext ?? null,
                recommendation.alternativeCategory ?? recommendation.category,
              ],
            ] as const
          ).map(([option, content, why, category]) => {
            const optionAccent =
              categoryColor[category as Category] ?? color.purple;
            return (
              <Pressable
                key={option}
                onPress={() => void choose(option)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Pick: ${content}`}
                style={({ pressed }) => ({
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: tint(optionAccent, 0.35),
                  backgroundColor: tint(optionAccent, pressed ? 0.14 : 0.06),
                })}
              >
                <Txt variant="bodyStrong">{content}</Txt>
                {why ? (
                  <Txt
                    variant="small"
                    c={color.textMuted}
                    style={{ marginTop: 3 }}
                  >
                    {why}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
          {errorMsg ? (
            <Txt variant="small" c={color.red}>
              {errorMsg}
            </Txt>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)}>
          <Txt
            variant="bodyStrong"
            style={
              done
                ? { opacity: 0.5, textDecorationLine: "line-through" }
                : undefined
            }
          >
            {recommendation.content}
          </Txt>

          {recommendation.context ? (
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
              <Ionicons
                name="git-branch-outline"
                size={14}
                color={accent}
                style={{ marginTop: 3 }}
              />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                {recommendation.context}
              </Txt>
            </View>
          ) : null}

          {/* What it was reading — the receipts for the line above. */}
          {basis.length ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 5,
                marginTop: space.md,
              }}
            >
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
                  <Txt
                    variant="small"
                    c={color.textFaint}
                    style={{ fontSize: 10 }}
                  >
                    {b}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}

          {/* What your feedback has taught it. Absent until it has actually
              learned something — an empty "Learned from you" would be worse
              than none at all. */}
          {learned.length ? (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/recommendations" as never);
              }}
              style={{
                flexDirection: "row",
                gap: space.sm,
                marginTop: space.md,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: tint(color.pink, 0.07),
                borderWidth: 1,
                borderColor: tint(color.pink, 0.18),
              }}
            >
              <Ionicons
                name="school-outline"
                size={14}
                color={color.pink}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Txt
                  variant="small"
                  c={color.pink}
                  style={{ fontSize: 11, fontWeight: "700" }}
                >
                  LEARNED FROM YOU
                </Txt>
                <Txt
                  variant="small"
                  c={color.textMuted}
                  style={{ marginTop: 3 }}
                >
                  {learned[0]}
                </Txt>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={color.textFaint}
              />
            </Pressable>
          ) : null}

          <View
            style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}
          >
            <Pressable
              onPress={() => void respond("acted")}
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
                void load({ refresh: true });
              }}
              disabled={busy}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: color.border,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Ionicons name="shuffle" size={15} color={color.textMuted} />
              <Txt variant="small" c={color.textMuted}>
                Something else
              </Txt>
            </Pressable>
          </View>

          {/* Says out loud that skipping is information, because a user who
              knows it teaches the system faster than one who doesn't. */}
          {!done ? (
            <Txt
              variant="small"
              c={color.textFaint}
              style={{ marginTop: space.md, fontSize: 11 }}
            >
              Both answers train it. Skipping tells it as much as doing.
            </Txt>
          ) : null}
        </Animated.View>
      )}
    </Card>
  );
}
