import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";

const STEPS = [
  {
    question: "Hey! What should we call you?",
    type: "text" as const,
    key: "name",
  },
  {
    question: "What's your main goal right now?",
    type: "select" as const,
    key: "goal",
    options: [
      "Build consistency",
      "Get stronger",
      "Lose weight",
      "Improve mental clarity",
      "Reduce stress",
      "Better sleep",
      "Build confidence",
    ],
  },
  {
    question: "How many days a week can you show up?",
    type: "select" as const,
    key: "days",
    options: ["2 days", "3 days", "4 days", "5 days", "6+ days"],
  },
  {
    question: "What's your current fitness level?",
    type: "select" as const,
    key: "level",
    options: [
      "Just starting out",
      "Getting back into it",
      "Intermediate — I know my way around",
      "Advanced — ready for challenges",
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const currentStep = STEPS[step];

  function selectAnswer(value: string) {
    setAnswers((prev) => ({ ...prev, [currentStep.key]: value }));
    if (step < STEPS.length - 1) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      // Onboarding complete
      router.replace("/(tabs)" as never);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A1A" }}>
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Progress dots */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            marginBottom: 48,
          }}
        >
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i <= step ? "#00D68F" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </View>

        {/* AI avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: "rgba(0,214,143,0.15)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#00D68F", fontSize: 20, fontWeight: "800" }}>
            K
          </Text>
        </View>

        {/* Question */}
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 32,
            lineHeight: 32,
          }}
        >
          {currentStep.question}
        </Text>

        {/* Options */}
        {currentStep.type === "select" &&
          currentStep.options?.map((option) => (
            <Pressable
              key={option}
              onPress={() => selectAnswer(option)}
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? "rgba(0,214,143,0.15)"
                  : "rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor:
                  answers[currentStep.key] === option
                    ? "rgba(0,214,143,0.4)"
                    : "rgba(255,255,255,0.08)",
              })}
            >
              <Text style={{ color: "#E2E8F0", fontSize: 16 }}>{option}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}
