/**
 * Arriving.
 *
 * Four short chapters: say hello, say what's going on, say why it matters,
 * decide what to try. It only asks what it needs to actually help today, and
 * each question says why it's there. Everything else (your days, your home,
 * whether you see a therapist) comes later, one at a time. See GetToKnowCard.
 */

import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInRight } from "react-native-reanimated";
import {
  FOCUS_AREAS,
  HELP_STYLES,
  OBSTACLE_OPTIONS,
  ROUTINE_OPTIONS,
  habitFromProposal,
  type HabitProposal,
  type HelpStyleId,
} from "@kinextion/shared";

import { AuroraBackdrop, Button, Notice, PressCard, Txt } from "../../components/ui";
import { JourneyPath } from "../../components/JourneyPath";
import { WhySession, type WhyOutcome } from "../../components/onboarding/WhySession";
import { HabitNegotiation } from "../../components/onboarding/HabitNegotiation";
import { markOnboardingFinished } from "../../components/GetToKnowCard";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../lib/auth";
import { useAppState } from "../../lib/store";
import { color, radius, space, tint, type } from "../../theme";

type Screen = "hello" | "name" | "area" | "specific" | "routine" | "obstacles" | "style" | "invite" | "why" | "becoming" | "journey" | "negotiate";

const FLOW: readonly Screen[] = ["hello", "name", "area", "specific", "routine", "obstacles", "style", "invite", "why", "becoming", "journey", "negotiate"];

const CHAPTERS: readonly { title: string; screens: readonly Screen[] }[] = [
  { title: "Hello", screens: ["hello", "name"] },
  { title: "What's going on", screens: ["area", "specific", "routine", "obstacles", "style"] },
  { title: "Why it matters", screens: ["invite", "why", "becoming"] },
  { title: "What you'll try", screens: ["journey", "negotiate"] },
];

const OTHER_ID = "other";

export default function OnboardingScreen() {
  const router = useRouter();
  const api = useApi();
  const { signOut } = useAuth();
  const { addHabits } = useAppState();

  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaOther, setAreaOther] = useState("");
  const [specifics, setSpecifics] = useState<string[]>([]);
  const [specificOther, setSpecificOther] = useState("");
  const [routine, setRoutine] = useState<string | undefined>();
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [obstacleOther, setObstacleOther] = useState("");
  const [helpStyle, setHelpStyle] = useState<HelpStyleId | undefined>();
  const [why, setWhy] = useState<WhyOutcome>({ ladder: [] });
  const [identity, setIdentity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screen = FLOW[index];
  const area = FOCUS_AREAS.find((a) => a.id === areaId) ?? null;
  const areaLabel = area?.label ?? areaOther.trim();
  const firstName = name.trim();

  const allSpecifics = [...specifics, ...(specificOther.trim() ? [specificOther.trim()] : [])];
  const allObstacles = [...obstacles, ...(obstacleOther.trim() ? [obstacleOther.trim()] : [])];

  const go = () => {
    void Haptics.selectionAsync();
    setIndex((i) => Math.min(FLOW.length - 1, i + 1));
  };

  const back = () => {
    void Haptics.selectionAsync();
    if (index > 0) return setIndex((i) => i - 1);
    Alert.alert("Leave setup?", "You'll be signed out. Your account stays, and setup starts again next time you sign in.", [
      { text: "Stay", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const toggle = (value: string, set: (fn: (p: string[]) => string[]) => void) => {
    void Haptics.selectionAsync();
    set((p) => (p.includes(value) ? p.filter((x) => x !== value) : [...p, value]));
  };

  const finish = async (proposal: HabitProposal | null, outcome: WhyOutcome = why) => {
    setError(null);
    setSubmitting(true);
    try {
      await api.completeOnboarding({
        displayName: firstName,
        primaryGoals: [areaLabel.slice(0, 60)],
        identityGoal: identity.trim().length >= 3 ? identity.trim() : undefined,
        preferences: helpStyle ? { coachingIntensity: HELP_STYLES.find((s) => s.id === helpStyle)?.intensity } : undefined,
        understanding: {
          area: areaLabel.slice(0, 60),
          specifics: allSpecifics.slice(0, 6),
          routine,
          obstacles: allObstacles.slice(0, 8),
          helpStyle,
          whyLadder: outcome.ladder.slice(0, 8),
          coreWhy: outcome.coreWhy,
        },
      });
      // The profile is saved first, so a failure here never loses onboarding.
      if (proposal) await addHabits([habitFromProposal(proposal, why.coreWhy, area?.category ?? "physical")]).catch(() => {});
      await markOnboardingFinished();
      router.replace("/(tabs)" as never);
      if (outcome.concern) router.push("/chat/kairo" as never);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const context = { name: firstName, area: areaLabel, specifics: allSpecifics, routine, obstacles: allObstacles };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <AuroraBackdrop accent={screen === "why" || screen === "invite" ? color.purple : color.green} />

      <Progress screen={screen} onBack={back} />

      {screen === "why" ? (
        <WhySession
          {...context}
          onDone={(outcome) => {
            setWhy(outcome);
            // Someone who's just said something frightening isn't asked to plan a habit.
            if (outcome.concern) void finish(null, outcome);
            else go();
          }}
        />
      ) : screen === "negotiate" ? (
        <>
          {error ? (
            <View style={{ paddingHorizontal: space.xl }}>
              <Notice>{error}</Notice>
            </View>
          ) : null}
          <HabitNegotiation {...context} helpStyle={helpStyle} coreWhy={why.coreWhy} submitting={submitting} onCommit={(p) => void finish(p)} onSkip={() => void finish(null)} />
        </>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Animated.View key={screen} entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
              {screen === "hello" ? (
                <Hello onNext={go} />
              ) : screen === "name" ? (
                <Question title="First, what should we call you?">
                  <Field value={name} onChange={setName} placeholder="Your first name" autoCapitalize="words" autoFocus onSubmit={() => firstName && go()} />
                  <Next onPress={go} disabled={!firstName} />
                </Question>
              ) : screen === "area" ? (
                <Question title={`Good to meet you, ${firstName}. What do you most want help with?`} why="Start with one thing. We'll get to the rest over time.">
                  <View style={{ gap: space.sm }}>
                    {FOCUS_AREAS.map((a, i) => (
                      <Option
                        key={a.id}
                        index={i}
                        label={a.label}
                        selected={areaId === a.id}
                        onPress={() => {
                          setAreaId(a.id);
                          setSpecifics([]);
                          setAreaOther("");
                        }}
                      />
                    ))}
                    <Option index={FOCUS_AREAS.length} label="Something else" selected={areaId === OTHER_ID} onPress={() => { setAreaId(OTHER_ID); setSpecifics([]); }} />
                    {areaId === OTHER_ID ? <Field value={areaOther} onChange={setAreaOther} placeholder="What's on your mind?" autoFocus /> : null}
                  </View>
                  <Next onPress={go} disabled={!areaId || (areaId === OTHER_ID && !areaOther.trim())} />
                </Question>
              ) : screen === "specific" ? (
                <Question title={area?.question ?? "Tell me a bit more. What's actually going on?"} why="The same words mean different things to different people. This is how we avoid guessing.">
                  <View style={{ gap: space.sm }}>
                    {area?.specifics.map((s, i) => <Option key={s} index={i} multi label={s} selected={specifics.includes(s)} onPress={() => toggle(s, setSpecifics)} />)}
                    <Field value={specificOther} onChange={setSpecificOther} placeholder={area ? "Or say it your way" : "In your own words"} multiline />
                  </View>
                  <Next onPress={go} disabled={allSpecifics.length === 0} />
                </Question>
              ) : screen === "routine" ? (
                <Question title="Do you already have something you do for this?" why="So we build on what you've got, and don't start you over.">
                  <View style={{ gap: space.sm }}>
                    {ROUTINE_OPTIONS.map((r, i) => <Option key={r} index={i} label={r} selected={routine === r} onPress={() => setRoutine(r)} />)}
                  </View>
                  <Next onPress={go} disabled={!routine} />
                </Question>
              ) : screen === "obstacles" ? (
                <Question title="What's usually gotten in the way?" why="Your plan should be built around this. Pick as many as are true.">
                  <View style={{ gap: space.sm }}>
                    {OBSTACLE_OPTIONS.map((o, i) => <Option key={o} index={i} multi label={o} selected={obstacles.includes(o)} onPress={() => toggle(o, setObstacles)} />)}
                    <Field value={obstacleOther} onChange={setObstacleOther} placeholder="Something else" />
                  </View>
                  <Next onPress={go} disabled={allObstacles.length === 0} />
                </Question>
              ) : screen === "style" ? (
                <Question title="When it gets hard, what actually helps you?" why="This is how your guides will talk to you. You can change it any time.">
                  <View style={{ gap: space.sm }}>
                    {HELP_STYLES.map((s, i) => <Option key={s.id} index={i} label={s.label} note={s.note} selected={helpStyle === s.id} onPress={() => setHelpStyle(s.id)} />)}
                  </View>
                  <Next onPress={go} disabled={!helpStyle} />
                </Question>
              ) : screen === "invite" ? (
                <Invite name={firstName} area={areaLabel} onNext={go} />
              ) : screen === "becoming" ? (
                <Question title="So, who do you want to become?" why="Your habits and your progress will be told in these words. Skip it if nothing comes yet.">
                  {why.coreWhy ? (
                    <Txt variant="body" c={color.purple} style={{ marginBottom: space.lg }}>
                      {why.coreWhy}
                    </Txt>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: color.surface, borderWidth: 1, borderColor: identity ? tint(color.green, 0.4) : color.border, borderRadius: radius.lg, paddingHorizontal: space.lg }}>
                    <Txt variant="body" c={color.textMuted}>
                      I'm{" "}
                    </Txt>
                    <TextInput
                      value={identity}
                      onChangeText={setIdentity}
                      placeholder="someone who shows up for my kids"
                      placeholderTextColor={color.textFaint}
                      autoCapitalize="none"
                      autoCorrect
                      spellCheck
                      autoFocus
                      maxLength={120}
                      style={[type.body, { flex: 1, paddingVertical: space.lg, color: color.text }]}
                    />
                  </View>
                  <Next onPress={go} label={identity.trim() ? "Continue" : "Skip for now"} />
                </Question>
              ) : (
                <Question title="This won't be a straight line." why="Everyone's way there looks different. Up and down is how it normally goes.">
                  <JourneyPath />
                  <Next onPress={go} label="What should I try?" />
                </Question>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Progress({ screen, onBack }: { screen: Screen; onBack: () => void }) {
  const chapter = CHAPTERS.findIndex((c) => c.screens.includes(screen));
  const within = CHAPTERS[chapter].screens;
  const share = (within.indexOf(screen) + 1) / within.length;

  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={color.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
          {CHAPTERS.map((c, i) => (
            <View key={c.title} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <View style={{ height: "100%", width: i < chapter ? "100%" : i === chapter ? `${share * 100}%` : "0%", backgroundColor: color.green }} />
            </View>
          ))}
        </View>
      </View>
      <Txt variant="small" c={color.textMuted} style={{ textAlign: "center" }}>
        {CHAPTERS[chapter].title}
      </Txt>
    </View>
  );
}

function Hello({ onNext }: { onNext: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <Animated.View entering={FadeIn.duration(700)}>
        <Txt variant="display">Hi. We're really glad you're here.</Txt>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(450).duration(600)}>
        <Txt variant="body" c={color.textMuted} style={{ marginTop: space.lg, fontSize: 17, lineHeight: 25 }}>
          Take a few minutes to tell us what's going on, so your guides don't start from zero.
        </Txt>
        <Txt variant="body" c={color.textMuted} style={{ marginTop: space.md, fontSize: 17, lineHeight: 25 }}>
          No right answers. Change anything later.
        </Txt>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(1000)} style={{ marginTop: space.xxxl }}>
        <Button label="Let's start" accent={color.green} onPress={onNext} />
      </Animated.View>
    </View>
  );
}

function Invite({ name, area, onNext }: { name: string; area: string; onNext: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <Txt variant="label" c={color.purple}>
        KAIRO
      </Txt>
      <Txt variant="title" style={{ marginTop: space.md }}>
        {name}, before we plan anything, I'd love to know what's underneath this.
      </Txt>
      <Txt variant="body" c={color.textMuted} style={{ marginTop: space.lg, fontSize: 17, lineHeight: 25 }}>
        Plans fall apart. The reason you want "{area.toLowerCase()}" is what keeps you going when they do. A few questions, about three minutes.
      </Txt>
      <Txt variant="small" c={color.textFaint} style={{ marginTop: space.lg }}>
        It's easier out loud, if you're somewhere you can talk. Typing works too.
      </Txt>
      <View style={{ marginTop: space.xxl }}>
        <Button label="I'm ready" accent={color.purple} onPress={onNext} />
      </View>
    </View>
  );
}

function Question({ title, why, children }: { title: string; why?: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt variant="title">{title}</Txt>
      {why ? (
        <Txt variant="body" c={color.textMuted} style={{ marginTop: space.sm }}>
          {why}
        </Txt>
      ) : null}
      <View style={{ marginTop: space.xl, flex: 1 }}>{children}</View>
    </View>
  );
}

function Next({ onPress, disabled, label = "Continue" }: { onPress: () => void; disabled?: boolean; label?: string }) {
  return (
    <View style={{ marginTop: "auto", paddingTop: space.xxl }}>
      <Button label={label} accent={color.green} onPress={onPress} disabled={disabled} />
    </View>
  );
}

function Option({
  index,
  label,
  note,
  selected,
  multi,
  onPress,
}: {
  index: number;
  label: string;
  note?: string;
  selected: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(40 + index * 35)}>
      <PressCard
        accent={selected ? color.green : undefined}
        haptic="none"
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        style={{ paddingVertical: space.lg, borderColor: selected ? tint(color.green, 0.55) : color.border }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{label}</Txt>
            {note ? (
              <Txt variant="small" c={color.textMuted}>
                {note}
              </Txt>
            ) : null}
          </View>
          <Ionicons
            name={selected ? "checkmark-circle" : multi ? "square-outline" : "ellipse-outline"}
            size={22}
            color={selected ? color.green : color.textFaint}
          />
        </View>
      </PressCard>
    </Animated.View>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoCapitalize = "sentences",
  multiline,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  autoCapitalize?: "words" | "sentences";
  multiline?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={color.textFaint}
      autoFocus={autoFocus}
      autoCapitalize={autoCapitalize}
      autoCorrect
      spellCheck
      multiline={multiline}
      maxLength={120}
      returnKeyType={multiline ? "default" : "done"}
      onSubmitEditing={onSubmit}
      style={[
        type.body,
        {
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: value ? tint(color.green, 0.4) : color.border,
          borderRadius: radius.lg,
          paddingHorizontal: space.lg,
          paddingVertical: space.lg,
          color: color.text,
        },
      ]}
    />
  );
}
