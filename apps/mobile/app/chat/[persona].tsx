import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { GUIDES, getGreeting, resolveGuideId, DEFAULT_GUIDE } from "@kinextion/ai-core";

import { ChatError, streamChat, type ChatTurn } from "../../lib/api";
import { Chip, Txt, TypingDots } from "../../components/ui";
import { color, radius, space, tint, type } from "../../theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set when the turn failed — renders as a retryable error bubble. */
  error?: boolean;
}

/** Conversation starters, tuned per guide. */
const OPENERS: Record<string, string[]> = {
  altheo: [
    "Should I train or rest today?",
    "I keep skipping the same workout",
    "Build me a 20-minute session",
  ],
  kairo: [
    "I'm feeling off this week",
    "Why can't I stay consistent?",
    "Something's weighing on me",
  ],
};

export default function ChatScreen() {
  const { persona } = useLocalSearchParams<{ persona: string }>();
  const guideId = resolveGuideId(persona) ?? DEFAULT_GUIDE;
  const guide = GUIDES[guideId];

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: "greeting", role: "assistant", content: getGreeting(guideId) },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request if the screen goes away, so we stop paying
  // for tokens the user will never see.
  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed };
      const replyId = `a-${Date.now()}`;

      // Build the API payload from what's on screen, minus the local greeting
      // (the model wrote it, but it was never part of a real exchange) and any
      // failed turns.
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== "greeting" && !m.error && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: replyId, role: "assistant", content: "" },
      ]);
      setInput("");
      setSending(true);
      scrollToEnd();

      const controller = new AbortController();
      abortRef.current = controller;

      const settle = (content: string, error = false) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, content, error } : m))
        );

      try {
        await streamChat({
          guide: guideId,
          messages: [...history, { role: "user", content: trimmed }],
          signal: controller.signal,
          onDelta: (full) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === replyId ? { ...m, content: full } : m))
            );
          },
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof ChatError ? err.message : "Something went wrong. Try again.";
        settle(message, true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setSending(false);
        scrollToEnd();
      }
    },
    [guideId, messages, scrollToEnd, sending]
  );

  /** Drop the failed exchange and replay the user's last message. */
  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUser.id);
      return idx === -1 ? prev : prev.slice(0, idx);
    });
    void send(lastUser.content);
  }, [messages, send]);

  const showOpeners = messages.length === 1 && !sending;
  const openers = useMemo(() => OPENERS[guideId] ?? [], [guideId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: guide.name,
          headerStyle: { backgroundColor: color.surface },
          headerTintColor: guide.color,
          headerTitleStyle: { color: color.text, fontWeight: "700" },
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: color.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: space.lg, paddingBottom: space.sm }}
            onContentSizeChange={scrollToEnd}
            keyboardDismissMode="interactive"
            renderItem={({ item, index }) => (
              <Bubble
                message={item}
                guideColor={guide.color}
                guideName={guide.name}
                streaming={sending && index === messages.length - 1 && !item.content}
                onRetry={item.error ? retry : undefined}
              />
            )}
          />

          {showOpeners && openers.length > 0 ? (
            <Animated.View entering={FadeIn.duration(400)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: space.lg,
                  paddingBottom: space.md,
                  gap: space.sm,
                }}
              >
                {openers.map((o) => (
                  <Chip key={o} label={o} accent={guide.color} selected onPress={() => send(o)} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            onStop={() => abortRef.current?.abort()}
            sending={sending}
            accent={guide.color}
            placeholder={
              guideId === "altheo"
                ? "Ask about training, sleep, or today's plan…"
                : "Say what's actually on your mind…"
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({
  message,
  guideColor,
  guideName,
  streaming,
  onRetry,
}: {
  message: Message;
  guideColor: string;
  guideName: string;
  streaming: boolean;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";
  const accent = message.error ? color.red : guideColor;

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify().damping(18)}
      layout={Layout.springify().damping(20)}
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        marginBottom: space.md,
      }}
    >
      {!isUser ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: tint(accent, 0.16),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt variant="mono" c={accent} style={{ fontSize: 9 }}>
              {message.error ? "!" : guideName[0]}
            </Txt>
          </View>
          <Txt variant="label" c={accent}>
            {message.error ? "Couldn't send" : guideName}
          </Txt>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: isUser ? tint(guideColor, 0.14) : color.surface,
          borderWidth: 1,
          borderColor: isUser ? tint(guideColor, 0.26) : message.error ? tint(color.red, 0.3) : color.border,
          borderRadius: radius.lg,
          borderTopRightRadius: isUser ? 5 : radius.lg,
          borderTopLeftRadius: isUser ? radius.lg : 5,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        {streaming ? (
          <View style={{ paddingVertical: 5 }}>
            <TypingDots accent={accent} />
          </View>
        ) : (
          <Txt variant="body" c={message.error ? color.textMuted : color.text}>
            {message.content}
          </Txt>
        )}
      </View>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            marginTop: space.sm,
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name="refresh" size={13} color={color.textMuted} />
          <Txt variant="small" c={color.textMuted}>
            Try again
          </Txt>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────
function Composer({
  value,
  onChange,
  onSend,
  onStop,
  sending,
  accent,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  accent: string;
  placeholder: string;
}) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.sm,
        padding: space.md,
        borderTopWidth: 1,
        borderTopColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        multiline
        maxLength={2000}
        editable={!sending}
        style={[
          type.body,
          {
            flex: 1,
            backgroundColor: color.bg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: color.border,
            paddingHorizontal: space.lg,
            paddingTop: 11,
            paddingBottom: 11,
            color: color.text,
            maxHeight: 120,
          },
        ]}
      />
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          sending ? onStop() : onSend();
        }}
        disabled={!canSend && !sending}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: sending
            ? tint(color.red, 0.16)
            : canSend
              ? accent
              : "rgba(255,255,255,0.05)",
        }}
      >
        <Ionicons
          name={sending ? "stop" : "arrow-up"}
          size={20}
          color={sending ? color.red : canSend ? color.bg : color.textFaint}
        />
      </Pressable>
    </View>
  );
}
