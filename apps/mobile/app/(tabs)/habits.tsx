import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

interface HabitItem {
  id: string;
  name: string;
  category: "physical" | "mental" | "emotional" | "spiritual";
  completed: boolean;
  streak: number;
}

const CATEGORY_COLORS = {
  physical: "#00D68F",
  mental: "#3B82F6",
  emotional: "#A855F7",
  spiritual: "#0ABAB5",
};

const CATEGORY_LABELS = {
  physical: "Body",
  mental: "Mind",
  emotional: "Heart",
  spiritual: "Spirit",
};

export default function HabitsScreen() {
  const [habits, setHabits] = useState<HabitItem[]>([
    { id: "1", name: "Morning stretch", category: "physical", completed: false, streak: 0 },
    { id: "2", name: "Drink 8 glasses of water", category: "physical", completed: false, streak: 0 },
    { id: "3", name: "10 minutes of reading", category: "mental", completed: false, streak: 0 },
    { id: "4", name: "Gratitude journaling", category: "emotional", completed: false, streak: 0 },
    { id: "5", name: "2-minute reflection", category: "spiritual", completed: false, streak: 0 },
  ]);

  function toggleHabit(id: string) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h))
    );
  }

  const completed = habits.filter((h) => h.completed).length;
  const total = habits.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A1A" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text
          style={{
            color: "#F8FAFC",
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 4,
          }}
        >
          Habits
        </Text>
        <Text style={{ color: "#64748B", fontSize: 14, marginBottom: 24 }}>
          {completed}/{total} completed today
        </Text>

        {/* Progress bar */}
        <View
          style={{
            height: 6,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 3,
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: total > 0 ? `${(completed / total) * 100}%` : "0%",
              borderRadius: 3,
              backgroundColor: "#00D68F",
            }}
          />
        </View>

        {/* Habits list */}
        {habits.map((habit) => (
          <Pressable
            key={habit.id}
            onPress={() => toggleHabit(habit.id)}
            style={{
              backgroundColor: habit.completed
                ? "rgba(0,214,143,0.06)"
                : "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: habit.completed
                ? "rgba(0,214,143,0.2)"
                : "rgba(255,255,255,0.05)",
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: habit.completed
                  ? CATEGORY_COLORS[habit.category]
                  : "rgba(255,255,255,0.15)",
                backgroundColor: habit.completed
                  ? CATEGORY_COLORS[habit.category]
                  : "transparent",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              {habit.completed && (
                <Ionicons name="checkmark" size={16} color="#0A0A1A" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: habit.completed ? "#94A3B8" : "#F8FAFC",
                  fontSize: 15,
                  fontWeight: "600",
                  textDecorationLine: habit.completed ? "line-through" : "none",
                }}
              >
                {habit.name}
              </Text>
              <Text
                style={{
                  color: CATEGORY_COLORS[habit.category],
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginTop: 2,
                }}
              >
                {CATEGORY_LABELS[habit.category]}
              </Text>
            </View>

            {habit.streak > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(245,158,11,0.1)",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ color: "#F59E0B", fontSize: 11, fontWeight: "700" }}
                >
                  {habit.streak}d
                </Text>
              </View>
            )}
          </Pressable>
        ))}

        {/* Add habit button */}
        <Pressable
          style={{
            borderRadius: 12,
            padding: 16,
            marginTop: 8,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            borderStyle: "dashed",
          }}
        >
          <Text style={{ color: "#64748B", fontSize: 14, fontWeight: "600" }}>
            + Add New Habit
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
