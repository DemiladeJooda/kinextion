import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { useState, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const PERSONA_CONFIG = {
  altheo: {
    name: "Altheo",
    color: "#00D68F",
    greeting:
      "What's good! I'm Altheo, your coach inside Kinextion. I'm here to help you build a system that actually sticks. Tell me \u2014 what's the one thing you want to be more consistent with right now?",
  },
  kairo: {
    name: "Kairo",
    color: "#A855F7",
    greeting:
      "Hey. I'm Kairo \u2014 I'm here whenever you need a moment to pause, reflect, or just talk through what's on your mind. No judgment, no pressure. Just space for you.\n\nHow are you feeling right now \u2014 honestly?",
  },
};

export default function ChatScreen() {
  const { persona } = useLocalSearchParams<{ persona: string }>();
  const config = PERSONA_CONFIG[persona as keyof typeof PERSONA_CONFIG] ?? PERSONA_CONFIG.altheo;

  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "assistant", content: config.greeting },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function sendMessage() {
    if (!input.trim() || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // TODO: Replace with actual API call
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          persona === "altheo"
            ? "That's a great goal. Let's break it down into something you can start today \u2014 what does your schedule look like this week? I want to find the best windows for you."
            : "Thank you for sharing that. It takes courage to be honest about how you're feeling. Let's sit with that for a moment \u2014 what do you think is driving that feeling?",
      };
      setMessages((prev) => [...prev, aiMsg]);
      setSending(false);
    }, 1500);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: config.name,
          headerStyle: { backgroundColor: "#0F172A" },
          headerTintColor: config.color,
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: "#0A0A1A" }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={100}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View
                style={{
                  alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  marginBottom: 12,
                }}
              >
                {item.role === "assistant" && (
                  <Text
                    style={{
                      color: config.color,
                      fontSize: 11,
                      fontWeight: "700",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    {config.name}
                  </Text>
                )}
                <View
                  style={{
                    backgroundColor:
                      item.role === "user"
                        ? `${config.color}20`
                        : "rgba(255,255,255,0.05)",
                    borderRadius: 16,
                    borderTopRightRadius: item.role === "user" ? 4 : 16,
                    borderTopLeftRadius: item.role === "assistant" ? 4 : 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor:
                      item.role === "user"
                        ? `${config.color}30`
                        : "rgba(255,255,255,0.05)",
                  }}
                >
                  <Text
                    style={{
                      color: "#E2E8F0",
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
          />

          {/* Typing indicator */}
          {sending && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
              <Text style={{ color: "#64748B", fontSize: 12, fontStyle: "italic" }}>
                {config.name} is thinking...
              </Text>
            </View>
          )}

          {/* Input bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              padding: 12,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.05)",
              backgroundColor: "#0F172A",
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={`Talk to ${config.name}...`}
              placeholderTextColor="#475569"
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                color: "#F8FAFC",
                fontSize: 15,
                maxHeight: 100,
                marginRight: 8,
              }}
              onSubmitEditing={sendMessage}
            />
            <Pressable
              onPress={sendMessage}
              disabled={!input.trim() || sending}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: input.trim() ? config.color : "rgba(255,255,255,0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={input.trim() ? "#0A0A1A" : "#475569"}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
