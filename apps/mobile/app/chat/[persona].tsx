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
import { useAuth } from "../../lib/auth";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { GUIDES, getGreeting, resolveGuideId, DEFAULT_GUIDE } from "@kinextion/ai-core";
import { createSentenceSplitter } from "@kinextion/shared";
import * as SecureStore from "expo-secure-store";

import { ChatError, streamChat, type ChatAction, type ChatTurn } from "../../lib/api";
import { useApi } from "../../hooks/useApi";
import { useAppState } from "../../lib/store";
import { AuroraBackdrop, Chip, Txt, TypingDots } from "../../components/ui";
import { VoiceDock, type VoiceState } from "../../components/VoiceDock";
import { createSpeaker, useListener, voiceSupported, type Speaker } from "../../lib/voice";
import { color, radius, space, tint, type } from "../../theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set when the turn failed — renders as a retryable error bubble. */
  error?: boolean;
  /** What the guide did in the app during this reply. */
  actions?: ShownAction[];
}

interface ShownAction extends ChatAction {
  id: string;
  undone?: boolean;
}

/** Talking is the default; typing is a tap away and remembered per device. */
type InputMode = "voice" | "type";
const MODE_KEY = "chat.inputMode";
const SPEAK_KEY = "chat.speakAloud";

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
  const { getToken } = useAuth();
  const api = useApi();
  const { refresh } = useAppState();
  const { persona, topicId } = useLocalSearchParams<{
    persona: string;
    topicId?: string;
  }>();
  const guideId = resolveGuideId(persona) ?? DEFAULT_GUIDE;
  const guide = GUIDES[guideId];

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: "greeting", role: "assistant", content: getGreeting(guideId) },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Server-assigned once the first message lands; threading it back is what
  // lets the guide keep its memory of this conversation across turns.
  const conversationIdRef = useRef<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Voice ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<InputMode>(voiceSupported ? "voice" : "type");
  const [speakAloud, setSpeakAloud] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [premium, setPremium] = useState(false);
  const speakerRef = useRef<Speaker | null>(null);
  // Once they've tapped to talk, the conversation is hands-free: after the
  // guide finishes speaking, it listens again.
  const handsFree = useRef(false);
  const sendRef = useRef<(text: string, spoken?: boolean) => void>(() => {});

  const listener = useListener({ onFinal: (text) => sendRef.current(text, true) });

  useEffect(() => {
    void (async () => {
      try {
        const [m, s] = await Promise.all([SecureStore.getItemAsync(MODE_KEY), SecureStore.getItemAsync(SPEAK_KEY)]);
        if (m === "type" || (m === "voice" && voiceSupported)) setMode(m);
        if (s === "off") setSpeakAloud(false);
      } catch {
        // first run, or storage unavailable: keep the defaults
      }
    })();
    api.getVoice().then((v) => setPremium(v.premium)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remember = (key: string, value: string) => void SecureStore.setItemAsync(key, value).catch(() => {});

  const stopVoice = useCallback(() => {
    handsFree.current = false;
    speakerRef.current?.stop();
    speakerRef.current = null;
    listener.cancel();
  }, [listener]);

  // Cancel any in-flight request if the screen goes away, so we stop paying
  // for tokens the user will never see — and stop talking and listening.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      speakerRef.current?.stop();
      listener.cancel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text: string, spoken = false) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const replyId = `a-${Date.now()}`;

      // Build the API payload from what's on screen, minus the local greeting
      // (the model wrote it, but it was never part of a real exchange) and any
      // failed turns.
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== "greeting" && !m.error && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, { id: replyId, role: "assistant", content: "" }]);
      setInput("");
      setSending(true);
      scrollToEnd();

      const controller = new AbortController();
      abortRef.current = controller;
      // Once the guide has changed something, Today should show it.
      let acted = false;

      // In voice mode the reply is spoken sentence by sentence as it streams.
      speakerRef.current?.stop();
      const aloud = mode === "voice" && speakAloud;
      const splitter = createSentenceSplitter();
      let heard = 0;
      const speaker = aloud
        ? createSpeaker({
            persona: guideId,
            premium,
            getToken,
            onSpeaking: setSpeaking,
            onIdle: () => {
              if (speakerRef.current === speaker) speakerRef.current = null;
              if (handsFree.current) void listener.start();
            },
          })
        : null;
      speakerRef.current = speaker;

      const settle = (content: string, error = false) =>
        setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, content, error } : m)));

      try {
        const result = await streamChat({
          guide: guideId,
          messages: [...history, { role: "user", content: trimmed }],
          signal: controller.signal,
          token: await getToken(),
          conversationId: conversationIdRef.current,
          topicId,
          voice: spoken || mode === "voice",
          onDelta: (full) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === replyId ? { ...m, content: full } : m))
            );
            if (speaker) {
              splitter.push(full.slice(heard)).forEach((s) => speaker.say(s));
              heard = full.length;
            }
          },
          onAction: (action) => {
            acted = true;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === replyId
                  ? {
                      ...m,
                      actions: [
                        ...(m.actions ?? []),
                        { ...action, id: `${replyId}-${m.actions?.length ?? 0}` },
                      ],
                    }
                  : m
              )
            );
          },
        });
        conversationIdRef.current = result.conversationId;
        if (speaker) {
          splitter.flush().forEach((s) => speaker.say(s));
          speaker.end();
        } else if (handsFree.current && mode === "voice") {
          void listener.start();
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        speaker?.stop();
        if (controller.signal.aborted) {
          // Stopped by the user: keep whatever streamed, drop an empty bubble.
          setMessages((prev) => prev.filter((m) => m.id !== replyId || m.content.trim()));
          return;
        }
        const message = err instanceof ChatError ? err.message : "Something went wrong. Try again.";
        settle(message, true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setSending(false);
        scrollToEnd();
        if (acted) void refresh();
      }
    },
    [guideId, messages, scrollToEnd, sending, getToken, refresh, mode, speakAloud, premium, listener]
  );
  sendRef.current = (text, spoken) => void send(text, spoken);

  const voiceState: VoiceState =
    listener.state === "listening" ? "listening" : speaking ? "speaking" : sending ? "thinking" : "idle";

  /** The orb: talk, finish talking, or cut in on the guide. */
  const onOrb = useCallback(() => {
    listener.clearError();
    if (voiceState === "listening") return listener.stop();
    if (voiceState === "speaking") {
      speakerRef.current?.stop();
      speakerRef.current = null;
    }
    if (voiceState === "thinking") return;
    handsFree.current = true;
    void listener.start();
  }, [listener, voiceState]);

  const switchMode = (next: InputMode) => {
    stopVoice();
    setMode(next);
    remember(MODE_KEY, next);
  };

  /** Undo one card. The message stays; the card shows it was undone. */
  const undo = useCallback(
    async (messageId: string, action: ShownAction) => {
      if (!action.undo || action.undone) return;
      const mark = (undone: boolean) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, actions: m.actions?.map((a) => (a.id === action.id ? { ...a, undone } : a)) }
              : m
          )
        );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mark(true);
      try {
        await api.undoChatAction(action.undo);
        void refresh();
      } catch {
        mark(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [api, refresh]
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
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: guide.color,
          headerTitle: () => (
            <View style={{ alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: guide.color,
                  }}
                />
                <Txt variant="bodyStrong">{guide.name}</Txt>
              </View>
              <Txt variant="small" c={color.textFaint} style={{ fontSize: 11, lineHeight: 14 }}>
                {voiceState === "listening"
                  ? "listening…"
                  : voiceState === "speaking"
                    ? "speaking…"
                    : sending
                      ? "thinking…"
                      : guide.role}
              </Txt>
            </View>
          ),
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: color.bg }}>
        <AuroraBackdrop accent={guide.color} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              padding: space.lg,
              paddingBottom: space.sm,
            }}
            onContentSizeChange={scrollToEnd}
            keyboardDismissMode="interactive"
            renderItem={({ item, index }) => (
              <Bubble
                message={item}
                guideColor={guide.color}
                guideName={guide.name}
                streaming={sending && index === messages.length - 1 && !item.content}
                onRetry={item.error ? retry : undefined}
                onUndo={(a) => undo(item.id, a)}
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

          {mode === "voice" ? (
            <VoiceDock
              state={voiceState}
              partial={listener.partial}
              volume={listener.volume}
              accent={guide.color}
              speakAloud={speakAloud}
              error={listener.error}
              onOrb={onOrb}
              onKeyboard={() => switchMode("type")}
              onToggleSpeech={() => {
                const next = !speakAloud;
                if (!next) speakerRef.current?.stop();
                setSpeakAloud(next);
                remember(SPEAK_KEY, next ? "on" : "off");
              }}
            />
          ) : (
            <Composer
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              onStop={() => abortRef.current?.abort()}
              onVoice={voiceSupported ? () => switchMode("voice") : undefined}
              sending={sending}
              accent={guide.color}
              placeholder={
                guideId === "altheo"
                  ? "Ask about training, sleep, or today's plan…"
                  : "Say what's actually on your mind…"
              }
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
/**
 * Guides sometimes answer in light markdown. Show **bold** as bold and
 * "- item" as a bullet rather than printing the symbols.
 */
function renderInline(text: string) {
  const lines = text.replace(/^\s*[-*]\s+/gm, "• ");
  return lines.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <Txt key={i} variant="bodyStrong">
        {part.slice(2, -2)}
      </Txt>
    ) : (
      part
    )
  );
}

function Bubble({
  message,
  guideColor,
  guideName,
  streaming,
  onRetry,
  onUndo,
}: {
  message: Message;
  guideColor: string;
  guideName: string;
  streaming: boolean;
  onRetry?: () => void;
  onUndo: (action: ShownAction) => void;
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 5,
          }}
        >
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
          borderColor: isUser
            ? tint(guideColor, 0.26)
            : message.error
              ? tint(color.red, 0.3)
              : color.border,
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
            {renderInline(message.content)}
          </Txt>
        )}
      </View>

      {message.actions?.map((a) => (
        <ActionCard key={a.id} action={a} accent={guideColor} onUndo={() => onUndo(a)} />
      ))}

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

// ─── Action card ──────────────────────────────────────────────────────────────
/** "Added: Push-ups" — what the guide just did in the app, with its Undo. */
function ActionCard({
  action,
  accent,
  onUndo,
}: {
  action: ShownAction;
  accent: string;
  onUndo: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        marginTop: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: action.undone ? color.border : tint(accent, 0.3),
        backgroundColor: action.undone ? "transparent" : tint(accent, 0.08),
        opacity: action.undone ? 0.6 : 1,
      }}
    >
      <Ionicons
        name={action.undone ? "arrow-undo" : "checkmark-circle"}
        size={18}
        color={action.undone ? color.textFaint : accent}
      />
      <View style={{ flex: 1 }}>
        <Txt
          variant="bodyStrong"
          c={action.undone ? color.textMuted : color.text}
          style={{ textDecorationLine: action.undone ? "line-through" : "none" }}
        >
          {action.title}
        </Txt>
        {action.detail && !action.undone ? (
          <Txt variant="small" c={color.textMuted}>
            {action.detail}
          </Txt>
        ) : null}
      </View>
      {action.undo && !action.undone ? (
        <Pressable onPress={onUndo} hitSlop={10}>
          <Txt variant="small" c={accent}>
            Undo
          </Txt>
        </Pressable>
      ) : action.undone ? (
        <Txt variant="small" c={color.textFaint}>
          Undone
        </Txt>
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
  onVoice,
  sending,
  accent,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** Switch back to talking. */
  onVoice?: () => void;
  sending: boolean;
  accent: string;
  placeholder: string;
}) {
  const canSend = value.trim().length > 0 && !sending;
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: space.sm,
        padding: space.md,
        borderTopWidth: 1,
        borderTopColor: color.border,
        backgroundColor: "rgba(14,21,36,0.92)",
      }}
    >
      {onVoice ? (
        <Pressable
          onPress={onVoice}
          hitSlop={8}
          accessibilityLabel="Talk instead"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        >
          <Ionicons name="mic-outline" size={20} color={color.textMuted} />
        </Pressable>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        multiline
        maxLength={2000}
        editable={!sending}
        selectionColor={accent}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          type.body,
          {
            flex: 1,
            backgroundColor: color.bg,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: focused ? tint(accent, 0.5) : color.border,
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
