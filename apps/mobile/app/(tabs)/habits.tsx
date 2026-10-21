/**
 * Today — the screen the app opens on.
 *
 * Two parts, deliberately far apart:
 *
 *   To do    Everything that asks something of the user today, in one list:
 *            the habits due today, "How are you feeling?", and an optional
 *            workout. Finished items fold into a "Done" group, so the list
 *            only ever shows what's left. One glance answers "what now?".
 *
 *   For you  Things to read, not things to do: today's recommendation, a
 *            slim stats strip, measured patterns, and a tip that only shows
 *            up when a habit is actually slipping.
 *
 * The earlier version stacked a progress card, the habit list, a static tip,
 * the mood strip, a workout link, the recommendation and a stats table one
 * after another. Every block asked to be read, so the screen asked for
 * thinking before doing. Built for the tired, distracted user: the next
 * action is always the top row.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  ZoomIn,
} from "react-native-reanimated";

import { MicroRecommendation } from "../../components/MicroRecommendation";
import {
  TAB_BAR_CLEARANCE,
  AuroraBackdrop,
  Button,
  Card,
  Label,
  PressCard,
  ScreenHeader,
  Txt,
} from "../../components/ui";
import { useApi } from "../../hooks/useApi";
import {
  addDays,
  localHour,
  orderForToday,
  plannedReminders,
  shouldOfferToFade,
  today,
  isDueOn,
  reviewWindow,
  weekInReview,
  type ReminderHabit,
} from "@kinextion/shared";
import {
  canAskForNotifications,
  syncHabitReminders,
} from "../../lib/habit-reminders";
import { requestNotificationPermission } from "../../lib/notifications";
import {
  ConcernCard,
  PromiseCard,
  RestartCard,
  WeekReviewCard,
  WhatWouldItTakeCard,
} from "../../components/CoachCards";
import { useAppState, type Habit } from "../../lib/store";
import { categoryColor, color, radius, space, tint } from "../../theme";

const PERIOD_LABEL: Record<"weekly" | "monthly" | "yearly", string> = {
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};

const MOODS = [
  { emoji: "😞", label: "Rough", accent: color.red },
  { emoji: "😐", label: "Flat", accent: color.amber },
  { emoji: "🙂", label: "Okay", accent: color.blue },
  { emoji: "😄", label: "Good", accent: color.green },
  { emoji: "🤩", label: "Great", accent: color.purple },
] as const;

/** 1-10 scale the mood API expects, evenly spaced across the five taps. */
const MOOD_VALUES = [2, 4, 6, 8, 10] as const;

function moodLabel(value: number | null | undefined): string | null {
  if (value == null) return null;
  const i = Math.min(4, Math.max(0, Math.round(value / 2) - 1));
  return MOODS[i].label.toLowerCase();
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function TodayScreen() {
  const router = useRouter();
  const {
    habits: allHabits,
    toggleHabit,
    setHabitDay,
    editHabit,
    reminderHabits,
    answerMiss,
    applyReflection,
    promise,
    score,
    periodScore,
    checkIn,
    moodLogged,
    reflectionLogged,
    workoutLogged,
    submitCheckIn,
    refresh,
    error,
  } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  // Only what's due today. A Mon/Wed/Fri habit on a Tuesday isn't a habit
  // you're failing. It's a day off, and it waits out of the way.
  const due = allHabits.filter((h) => h.due);
  const notToday = allHabits.filter((h) => !h.due);
  // Easiest win first, within what's due now — so the first tap of the day
  // is very likely a success. See orderForToday in @kinextion/shared.
  const habitsLeft = orderForToday(
    due.filter((h) => h.todayState === null),
    localHour(),
  );
  // Done, the tiny version, and rest days all leave the list.
  const habitsDone = due.filter((h) => h.todayState !== null);
  const habitsKept = due.filter(
    (h) => h.todayState === "done" || h.todayState === "minimum",
  );
  const yesterdayOpen = allHabits.filter((h) => h.yesterdayOpen);
  const comeback = due.find(
    (h) => h.comeback && h.todayState !== null && h.todayState !== "rest",
  );
  const [sheetFor, setSheetFor] = useState<Habit | null>(null);

  // ── Coach loop ────────────────────────────────────────────────────────
  // One "What would it take?" at a time, for the habit at the top of the
  // list that was missed and hasn't been asked about yet.
  const askAbout = habitsLeft.find((h) => h.askAboutMiss) ?? null;
  const hourNow = localHour();
  const todayKey = today();
  const tomorrowKey = addDays(todayKey, 1);
  const dueTomorrow =
    hourNow >= 17
      ? allHabits.filter((h) => {
          const r = reminderHabits.find((x) => x.id === h.id);
          return (
            r &&
            h.status !== "paused" &&
            !h.promiseTomorrow &&
            isDueOn(r, tomorrowKey, r.completed)
          );
        })
      : [];
  const alreadyPromised = allHabits.some((h) => h.promiseTomorrow);
  const reviewSpan = reviewWindow(todayKey, hourNow);
  const review = reviewSpan
    ? weekInReview(
        reminderHabits.filter((h) => h.status !== "paused"),
        reviewSpan,
        todayKey,
      )
    : null;
  const paused =
    Number(todayKey.slice(8, 10)) <= 3
      ? allHabits.filter((h) => h.status === "paused")
      : [];
  const worrying = allHabits.some((h) => h.display.concern);

  // The check-in counts as a to-do; the workout is offered, not required,
  // so it never sits in the count as something you're behind on. A rested
  // habit isn't owed today, so it leaves the count too.
  const rested = due.filter((h) => h.todayState === "rest").length;
  const required = due.length - rested + 1;
  const completed = habitsKept.length + (moodLogged ? 1 : 0);
  const remaining = required - completed;

  // Fire once on the transition to zero, not on every render at zero, and
  // not when the screen simply opens on a finished day.
  const lastRemaining = useRef<number | null>(null);
  useEffect(() => {
    if (
      lastRemaining.current !== null &&
      lastRemaining.current > 0 &&
      remaining === 0
    ) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    lastRemaining.current = remaining;
  }, [remaining]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  const openNew = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/habit/new" as never);
  };
  const openHabit = (id: string) => router.push(`/habit/${id}` as never);

  const doneCount =
    habitsDone.length + (moodLogged ? 1 : 0) + (workoutLogged ? 1 : 0);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.bg }}
      edges={["top"]}
    >
      <AuroraBackdrop accent={color.amber} />
      <ScrollView
        contentContainerStyle={{
          padding: space.xl,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.textFaint}
          />
        }
      >
        <ScreenHeader
          title="Today"
          subtitle={todayLabel()}
          right={
            <Pressable
              onPress={openNew}
              accessibilityRole="button"
              accessibilityLabel="Add a habit"
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tint(color.amber, 0.14),
                borderWidth: 1,
                borderColor: tint(color.amber, 0.3),
              }}
            >
              <Ionicons name="add" size={22} color={color.amber} />
            </Pressable>
          }
        />

        {/* ── Progress: one line and one bar, nothing to read twice ─────── */}
        <Progress
          remaining={remaining}
          completed={completed}
          required={required}
        />

        {/* ── To do ───────────────────────────────────────────────────── */}
        <View style={{ marginTop: space.xxl, marginBottom: space.md }}>
          <Label c={color.textFaint}>To do</Label>
        </View>

        {comeback ? <ComebackBanner name={comeback.name} /> : null}

        {yesterdayOpen.length > 0 ? (
          <YesterdayList
            habits={yesterdayOpen}
            onTick={(h) =>
              setHabitDay(h.id, "done", { date: addDays(today(), -1) })
            }
          />
        ) : null}

        {allHabits.length === 0 ? <NoHabitsYet onStart={openNew} /> : null}
        {allHabits.length > 0 && due.length === 0 ? (
          <Txt
            variant="small"
            c={color.textMuted}
            style={{ marginBottom: space.md }}
          >
            No habits due today. Rest days are part of the plan, and your
            streaks are safe.
          </Txt>
        ) : null}

        <View style={{ gap: space.md }}>
          {habitsLeft.map((h, i) => (
            <Animated.View
              key={h.id}
              entering={FadeInDown.duration(350).delay(i * 40)}
              layout={Layout.springify().damping(20)}
            >
              <HabitRow
                habit={h}
                isNext={i === 0}
                onToggle={() => toggleHabit(h.id)}
                onMore={() => setSheetFor(h)}
              />
            </Animated.View>
          ))}

          {!moodLogged ? (
            <Animated.View layout={Layout.springify().damping(20)}>
              <FeelingTask onSubmit={(mood) => submitCheckIn({ mood })} />
            </Animated.View>
          ) : null}

          {!workoutLogged ? (
            <Animated.View layout={Layout.springify().damping(20)}>
              <TaskRow
                icon="barbell-outline"
                accent={color.green}
                title="Log a workout"
                subtitle="Optional · if you trained today"
                onPress={() => router.push("/workout/log" as never)}
              />
            </Animated.View>
          ) : null}
        </View>

        {askAbout && askAbout.missedOn ? (
          <View style={{ marginTop: space.md }}>
            <WhatWouldItTakeCard
              key={`${askAbout.id}-${askAbout.missedOn}`}
              habit={askAbout}
              onAnswer={(answer) =>
                answerMiss(askAbout.id, askAbout.missedOn!, answer)
              }
              onApply={applyReflection}
              onTalkToKairo={() => router.push("/chat/kairo" as never)}
            />
          </View>
        ) : null}

        {remaining === 0 && due.length > 0 ? (
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Card accent={color.green} style={{ marginTop: space.md }}>
              <Txt variant="bodyStrong" c={color.green}>
                That&apos;s everything for today.
              </Txt>
              <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
                Nothing left to do. Enjoy the rest of your day.
              </Txt>
            </Card>
          </Animated.View>
        ) : null}

        {error ? (
          <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
            {error}
          </Txt>
        ) : null}

        {/* Finished items fold away so the list only shows what's left. */}
        <Folded
          icon="checkmark-done-outline"
          label={`Done · ${doneCount}`}
          count={doneCount}
          accent={color.green}
        >
          {habitsDone.map((h) => (
            <DoneRow
              key={h.id}
              title={h.name}
              detail={
                h.todayState === "rest"
                  ? "Rest day · undo"
                  : h.todayState === "minimum"
                    ? "Tiny version · undo"
                    : "Tap to undo"
              }
              accent={categoryColor[h.category]}
              faded={h.todayState === "rest"}
              onPress={() => setHabitDay(h.id, "clear")}
            />
          ))}
          {moodLogged ? (
            <DoneRow
              title={
                moodLabel(checkIn?.mood)
                  ? `Feeling ${moodLabel(checkIn?.mood)}`
                  : "Checked in"
              }
              detail={reflectionLogged ? "Full check-in done" : "Add more"}
              accent={color.purple}
              onPress={() => router.push("/checkin" as never)}
            />
          ) : null}
          {workoutLogged ? (
            <DoneRow
              title="Workout logged"
              detail="Log another"
              accent={color.green}
              onPress={() => router.push("/workout/log" as never)}
            />
          ) : null}
        </Folded>

        <Folded
          icon="moon-outline"
          label={`Not today · ${notToday.length}`}
          count={notToday.length}
        >
          {notToday.map((h) => (
            <DoneRow
              key={h.id}
              title={h.name}
              detail={notTodayDetail(h)}
              accent={categoryColor[h.category]}
              faded
              onPress={() => openHabit(h.id)}
            />
          ))}
        </Folded>

        {/* ── For you: reading, not doing ─────────────────────────────── */}
        <View
          style={{
            marginTop: space.xxxl + space.lg,
            paddingTop: space.xxl,
            borderTopWidth: 1,
            borderTopColor: color.border,
            gap: space.xxl,
          }}
        >
          <Label c={color.textFaint}>For you</Label>

          {worrying ? (
            <ConcernCard onTalk={() => router.push("/chat/kairo" as never)} />
          ) : null}

          {dueTomorrow.length > 0 && !alreadyPromised ? (
            <PromiseCard
              habits={dueTomorrow}
              onPromise={(ids) => promise(ids, tomorrowKey)}
            />
          ) : null}

          {review ? (
            <WeekReviewCard review={review} onAdjust={openHabit} />
          ) : null}

          {paused.length > 0 ? (
            <RestartCard
              habits={paused}
              onRestart={(id) => editHabit(id, { status: "building" })}
            />
          ) : null}

          <RemindersPrompt reminderHabits={reminderHabits} />

          <FadeTip
            habits={allHabits}
            onTurnOff={(h) => void editHabit(h.id, { reminderEnabled: false })}
          />

          <SlippingTip habits={due} onResize={openHabit} />

          <View style={{ gap: space.md }}>
            <Txt variant="bodyStrong">Today&apos;s one thing</Txt>
            <MicroRecommendation />
          </View>

          <View style={{ gap: space.md }}>
            <Txt variant="bodyStrong">Your numbers</Txt>
            <StatsStrip
              bestStreak={allHabits.reduce(
                (m, h) => Math.max(m, h.bestStreak),
                0,
              )}
              periodAverage={periodScore?.average ?? null}
              periodLabel={
                periodScore ? PERIOD_LABEL[periodScore.period] : "This week"
              }
              todayScore={score}
            />
            <Txt variant="small" c={color.textFaint}>
              From what you log. Connect Oura or Apple Health in Profile to add
              biometrics.
            </Txt>
          </View>

          <PatternsSection />
        </View>
      </ScrollView>

      <LogSheet
        habit={sheetFor}
        onClose={() => setSheetFor(null)}
        onMinimum={(h) => setHabitDay(h.id, "minimum")}
        onRest={(h) => setHabitDay(h.id, "rest")}
        onNote={(h, notes) =>
          setHabitDay(h.id, h.todayState === null ? "clear" : h.todayState, {
            notes,
          })
        }
        onEdit={(h) => openHabit(h.id)}
      />
    </SafeAreaView>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function Progress({
  remaining,
  completed,
  required,
}: {
  remaining: number;
  completed: number;
  required: number;
}) {
  const pct = required ? completed / required : 0;
  return (
    <View style={{ marginTop: space.lg, gap: space.sm }}>
      <Txt variant="bodyStrong" c={remaining === 0 ? color.green : color.text}>
        {remaining === 0
          ? "All done for today"
          : remaining === 1
            ? "1 thing left today"
            : `${remaining} things left today`}
      </Txt>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: required, now: completed }}
      >
        <Animated.View
          layout={Layout.springify().damping(18)}
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: color.green,
          }}
        />
      </View>
    </View>
  );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────
/** A to-do that isn't a habit: same height and shape, so the list reads as one. */
function TaskRow({
  icon,
  accent,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <PressCard haptic="light" onPress={onPress} style={{ padding: space.lg }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: tint(accent, 0.14),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{title}</Txt>
          {subtitle ? (
            <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={color.textFaint} />
      </View>
    </PressCard>
  );
}

function HabitRow({
  habit,
  isNext,
  onToggle,
  onMore,
}: {
  habit: Habit;
  /** The top of the list: the one thing to do now, so the eye lands there. */
  isNext?: boolean;
  onToggle: () => void;
  onMore: () => void;
}) {
  const accent = categoryColor[habit.category];

  return (
    <PressCard
      haptic="medium"
      onPress={onToggle}
      accent={isNext ? accent : undefined}
      style={{ padding: space.lg }}
    >
      {isNext ? (
        <Txt
          variant="label"
          c={accent}
          style={{ fontSize: 10, marginBottom: space.sm }}
        >
          NEXT UP
        </Txt>
      ) : null}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        {/* The ring's colour is the category, so no separate label is needed. */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: accent,
          }}
        />

        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{habit.name}</Txt>
          {/* At risk beats the cue: it's the one thing worth knowing today,
              said as an invitation, never as "you broke it". */}
          {habit.atRisk ? (
            <Txt
              variant="small"
              c={color.amber}
              style={{ marginTop: 1 }}
              numberOfLines={1}
            >
              {habit.display.response
                ? `Save your streak · even "${habit.display.response}" counts`
                : "Save your streak today"}
            </Txt>
          ) : habit.promiseToday ? (
            <Txt
              variant="small"
              c={color.blue}
              style={{ marginTop: 1 }}
              numberOfLines={1}
            >
              You promised this for today
            </Txt>
          ) : habit.display.cue ? (
            <Txt
              variant="small"
              c={color.textFaint}
              style={{ marginTop: 1 }}
              numberOfLines={1}
            >
              {habit.display.cue}
            </Txt>
          ) : null}
        </View>

        {habit.streak > 0 ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            accessibilityLabel={`${habit.streak} ${habit.streakUnit} streak`}
          >
            <Ionicons name="flame" size={12} color={color.amber} />
            <Txt variant="small" c={color.amber} style={{ fontSize: 12 }}>
              {habit.streakUnit === "week" ? `${habit.streak}w` : habit.streak}
            </Txt>
          </View>
        ) : null}

        {/* Separate hit target: tapping the row logs the habit, so the other
            options need their own control rather than a long-press nobody
            discovers. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onMore();
          }}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${habit.name}`}
          hitSlop={12}
          style={{ paddingLeft: space.sm }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={color.textFaint}
          />
        </Pressable>
      </View>
    </PressCard>
  );
}

// ─── Logging options ──────────────────────────────────────────────────────────
/**
 * What "…" on a habit opens: the ways a day can go other than "done".
 * The tiny version is first because it's the one to reach for on a bad day,
 * and it names the user's own tiny version so there's nothing to recall.
 */
function LogSheet({
  habit,
  onClose,
  onMinimum,
  onRest,
  onNote,
  onEdit,
}: {
  habit: Habit | null;
  onClose: () => void;
  onMinimum: (h: Habit) => void;
  onRest: (h: Habit) => void;
  onNote: (h: Habit, notes: string) => void;
  onEdit: (h: Habit) => void;
}) {
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");

  const close = () => {
    setWriting(false);
    setNote("");
    onClose();
  };
  const choose = (fn: (h: Habit) => void) => () => {
    if (!habit) return;
    void Haptics.selectionAsync();
    fn(habit);
    close();
  };

  return (
    <Modal
      visible={habit !== null}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: color.scrim }}
        onPress={close}
        accessibilityLabel="Close"
      />
      <View
        style={{
          backgroundColor: color.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.xl,
          paddingBottom: space.xxxl,
          gap: space.sm,
        }}
      >
        {habit ? (
          <>
            <Txt variant="heading" style={{ marginBottom: space.sm }}>
              {habit.name}
            </Txt>

            {writing ? (
              <View style={{ gap: space.md }}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="How did it go?"
                  placeholderTextColor={color.textFaint}
                  maxLength={500}
                  multiline
                  autoFocus
                  style={{
                    minHeight: 80,
                    color: color.text,
                    borderWidth: 1,
                    borderColor: color.border,
                    borderRadius: radius.md,
                    padding: space.md,
                    textAlignVertical: "top",
                  }}
                />
                <Button
                  label="Save note"
                  accent={color.amber}
                  disabled={!note.trim()}
                  onPress={() => {
                    onNote(habit, note.trim());
                    close();
                  }}
                />
              </View>
            ) : (
              <>
                <SheetOption
                  icon="leaf-outline"
                  accent={color.green}
                  title="I did the tiny version"
                  detail={
                    habit.display.response
                      ? `"${habit.display.response}" · keeps your streak`
                      : "Keeps your streak"
                  }
                  onPress={choose(onMinimum)}
                />
                <SheetOption
                  icon="moon-outline"
                  accent={color.teal}
                  title="Take a rest day"
                  detail="One a week · your streak is safe"
                  onPress={choose(onRest)}
                />
                <SheetOption
                  icon="create-outline"
                  accent={color.amber}
                  title="Add a note"
                  onPress={() => setWriting(true)}
                />
                <SheetOption
                  icon="options-outline"
                  accent={color.textMuted}
                  title="Edit habit"
                  onPress={choose(onEdit)}
                />
              </>
            )}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function SheetOption({
  icon,
  accent,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: pressed ? color.surfaceAlt : "transparent",
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: tint(accent, 0.14),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {detail ? (
          <Txt variant="small" c={color.textFaint} numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Yesterday and comebacks ──────────────────────────────────────────────────
/**
 * Habits due yesterday that were never ticked, until noon. Forgetting to tap
 * shouldn't cost a streak for something that actually happened.
 */
function YesterdayList({
  habits,
  onTick,
}: {
  habits: Habit[];
  onTick: (h: Habit) => void;
}) {
  return (
    <Card style={{ marginBottom: space.lg, padding: space.lg, gap: space.md }}>
      <View>
        <Txt variant="bodyStrong">Did these yesterday?</Txt>
        <Txt variant="small" c={color.textFaint} style={{ marginTop: 1 }}>
          You can still tick them until noon.
        </Txt>
      </View>
      {habits.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onTick(h);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${h.name} done for yesterday`}
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: categoryColor[h.category],
            }}
          />
          <Txt variant="body" style={{ flex: 1 }}>
            {h.name}
          </Txt>
          <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
            Yesterday
          </Txt>
        </Pressable>
      ))}
    </Card>
  );
}

/**
 * The first tick after a streak ended. Coming back is the behaviour worth
 * celebrating (in a 61,000-person study, a small reward for returning after
 * a miss beat 53 other ideas), so it gets its own moment instead of a zero.
 */
function ComebackBanner({ name }: { name: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <Card accent={color.green} style={{ marginBottom: space.lg }}>
        <Txt variant="bodyStrong" c={color.green}>
          You&apos;re back on {name}.
        </Txt>
        <Txt variant="small" c={color.textMuted} style={{ marginTop: 3 }}>
          Coming back is the habit. Day one of the next run starts now.
        </Txt>
      </Card>
    </Animated.View>
  );
}

/** A finished (or resting) item: one quiet line. */
function DoneRow({
  title,
  detail,
  accent,
  faded,
  onPress,
}: {
  title: string;
  detail: string;
  accent: string;
  faded?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.border,
      }}
    >
      {faded ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: accent,
          }}
        />
      ) : (
        <Ionicons name="checkmark-circle" size={18} color={accent} />
      )}
      <Txt
        variant="body"
        c={color.textMuted}
        style={[
          { flex: 1 },
          faded ? null : { textDecorationLine: "line-through" },
        ]}
        numberOfLines={1}
      >
        {title}
      </Txt>
      <Txt variant="small" c={color.textFaint} style={{ fontSize: 12 }}>
        {detail}
      </Txt>
    </Pressable>
  );
}

/** A collapsed group with a count. Hidden entirely when empty. */
function Folded({
  icon,
  label,
  count,
  accent = color.textFaint,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  accent?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <View style={{ marginTop: space.xl }}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <Ionicons name={icon} size={15} color={accent} />
        <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
          {label}
        </Txt>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={15}
          color={color.textFaint}
        />
      </Pressable>

      {open ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{ gap: space.sm, marginTop: space.md }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── How are you feeling? ─────────────────────────────────────────────────────
/**
 * The check-in as a to-do. Closed it's one row; tapping it opens the five
 * faces in place, and picking one saves and folds the row into Done. It
 * writes through the check-in route, so a face tapped here and a journal
 * written tonight edit the same day.
 */
function FeelingTask({
  onSubmit,
}: {
  onSubmit: (mood: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const onPick = async (i: number) => {
    setPicked(i);
    setFailed(false);
    try {
      await onSubmit(MOOD_VALUES[i]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPicked(null);
      setFailed(true);
    }
  };

  if (!open) {
    return (
      <TaskRow
        icon="heart-outline"
        accent={color.purple}
        title="How are you feeling?"
        subtitle="One tap"
        onPress={() => setOpen(true)}
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Card style={{ padding: space.lg }}>
        <Txt variant="bodyStrong" style={{ marginBottom: space.md }}>
          How are you feeling?
        </Txt>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {MOODS.map((m, i) => {
            const active = picked === i;
            return (
              <PressCard
                key={m.label}
                accent={active ? m.accent : undefined}
                haptic="medium"
                disabled={picked !== null}
                onPress={() => void onPick(i)}
                style={{
                  flex: 1,
                  marginHorizontal: 3,
                  paddingVertical: space.md,
                  paddingHorizontal: 0,
                  alignItems: "center",
                  backgroundColor: active
                    ? tint(m.accent, 0.12)
                    : "transparent",
                  borderColor: active ? tint(m.accent, 0.32) : "transparent",
                  shadowOpacity: 0,
                  elevation: 0,
                }}
              >
                <Txt variant="heading" style={{ fontSize: 26 }}>
                  {m.emoji}
                </Txt>
                <Txt
                  variant="small"
                  c={active ? m.accent : color.textFaint}
                  style={{ marginTop: 4, fontSize: 11 }}
                >
                  {m.label}
                </Txt>
              </PressCard>
            );
          })}
        </View>
        {failed ? (
          <Txt variant="small" c={color.red} style={{ marginTop: space.md }}>
            Couldn&apos;t save that. Try again.
          </Txt>
        ) : null}
      </Card>
    </Animated.View>
  );
}

// ─── For you ──────────────────────────────────────────────────────────────────
/**
 * Asks for notifications once there's something worth being reminded of,
 * rather than at launch. Hidden once allowed, or once the OS won't ask again.
 */
function RemindersPrompt({
  reminderHabits,
}: {
  reminderHabits: ReminderHabit[];
}) {
  const api = useApi();
  const [show, setShow] = useState(false);
  const worthIt = reminderHabits.some(
    (h) => h.reminderEnabled && h.timeWindow !== "anytime",
  );

  useEffect(() => {
    if (!worthIt) return;
    void canAskForNotifications().then(setShow);
  }, [worthIt]);

  if (!show || !worthIt) return null;

  const enable = async () => {
    const granted = await requestNotificationPermission();
    setShow(false);
    if (!granted) return;
    await api
      .updateProfile({ preferences: { habitReminders: true } })
      .catch(() => {});
    const now = new Date();
    await syncHabitReminders(
      plannedReminders(
        reminderHabits,
        today(),
        now.getHours() * 60 + now.getMinutes(),
      ),
    );
  };

  return (
    <Card accent={color.amber}>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Ionicons name="notifications-outline" size={18} color={color.amber} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Txt variant="bodyStrong" c={color.amber}>
            Want a nudge at the right moment?
          </Txt>
          <Txt variant="small" c={color.textMuted}>
            One reminder when each habit&apos;s part of the day starts, in your
            words, with a Done button right on it. Nothing for habits
            you&apos;ve already done.
          </Txt>
          <Pressable
            onPress={() => void enable()}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Txt variant="small" c={color.amber} style={{ fontWeight: "700" }}>
              Turn on reminders →
            </Txt>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

/**
 * Once a habit has held for two weeks, offers to drop its reminder. Leaning
 * on a reminder keeps a habit going but can stop it becoming automatic, so
 * the goal is a habit that no longer needs one.
 */
function FadeTip({
  habits,
  onTurnOff,
}: {
  habits: Habit[];
  onTurnOff: (h: Habit) => void;
}) {
  const [kept, setKept] = useState<string[]>([]);
  const habit = habits.find(
    (h) => shouldOfferToFade(h) && !kept.includes(h.id),
  );
  if (!habit) return null;

  return (
    <Card accent={color.teal}>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Ionicons name="leaf-outline" size={18} color={color.teal} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Txt variant="bodyStrong" c={color.teal}>
            {habit.name}: {habit.streak} days running
          </Txt>
          <Txt variant="small" c={color.textMuted}>
            You might not need the reminder anymore. Want to try without it?
          </Txt>
          <View style={{ flexDirection: "row", gap: space.lg }}>
            <Pressable
              onPress={() => onTurnOff(habit)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Txt variant="small" c={color.teal} style={{ fontWeight: "700" }}>
                Turn it off
              </Txt>
            </Pressable>
            <Pressable
              onPress={() => setKept((k) => [...k, habit.id])}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Txt variant="small" c={color.textFaint}>
                Keep it
              </Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

/**
 * Shown only when a habit is actually slipping: due, no current streak, and
 * kept under half the time. A permanent tip card is one more thing to read
 * every day; this one appears when it has something to say.
 */
function SlippingTip({
  habits,
  onResize,
}: {
  habits: Habit[];
  onResize: (id: string) => void;
}) {
  const slipping = habits.find(
    (h) => h.streak === 0 && h.consistency !== null && h.consistency < 0.5,
  );
  if (!slipping) return null;

  return (
    <Card accent={color.blue}>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Ionicons name="bulb-outline" size={18} color={color.blue} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Txt variant="bodyStrong" c={color.blue}>
            {slipping.name} keeps slipping
          </Txt>
          <Txt variant="small" c={color.textMuted}>
            Want to make it smaller? A two-minute version you actually do beats
            a bigger one you skip.
          </Txt>
          <Pressable
            onPress={() => onResize(slipping.id)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Txt variant="small" c={color.blue} style={{ fontWeight: "700" }}>
              Resize it →
            </Txt>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

function StatsStrip({
  bestStreak,
  periodAverage,
  periodLabel,
  todayScore,
}: {
  bestStreak: number;
  periodAverage: number | null;
  periodLabel: string;
  todayScore: number | null;
}) {
  const tiles = [
    {
      label: "Best streak",
      value: bestStreak > 0 ? `${bestStreak}d` : "—",
      accent: color.amber,
    },
    {
      label: periodLabel,
      value: periodAverage === null ? "—" : String(periodAverage),
      accent: color.teal,
    },
    {
      label: "Today",
      value: todayScore === null ? "—" : String(todayScore),
      accent: color.green,
    },
  ];
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      {tiles.map((t) => (
        <Card
          key={t.label}
          style={{ flex: 1, padding: space.lg, alignItems: "flex-start" }}
        >
          <Txt variant="heading" c={t.accent}>
            {t.value}
          </Txt>
          <Txt
            variant="small"
            c={color.textFaint}
            style={{ marginTop: 2, fontSize: 12 }}
          >
            {t.label}
          </Txt>
        </Card>
      ))}
    </View>
  );
}

/** Real, computed correlations between wearable data, mood, and habits.
 * Silent when there's nothing to show yet — an always-empty section reads
 * worse than no section at all. */
function PatternsSection() {
  const api = useApi();
  const [patterns, setPatterns] = useState<Awaited<
    ReturnType<typeof api.listPatterns>
  > | null>(null);

  useEffect(() => {
    api
      .listPatterns()
      .then(setPatterns)
      .catch(() => setPatterns([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!patterns || patterns.length === 0) return null;

  return (
    <View style={{ gap: space.md }}>
      <Txt variant="bodyStrong">Patterns</Txt>
      <Card>
        <View style={{ gap: space.md }}>
          {patterns.slice(0, 3).map((p) => (
            <View
              key={`${p.metricType}-${p.summary}`}
              style={{ flexDirection: "row", gap: space.md }}
            >
              <Ionicons
                name="analytics-outline"
                size={16}
                color={color.pink}
                style={{ marginTop: 2 }}
              />
              <Txt variant="small" c={color.textMuted} style={{ flex: 1 }}>
                {p.summary}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/**
 * The real empty state.
 *
 * This screen used to seed five habits on first load so it never looked bare.
 * That made the app feel populated and quietly capped everyone at the same
 * five forever. An empty list that points at three ways to build the first
 * habit is both more honest and more useful.
 */
function NoHabitsYet({ onStart }: { onStart: () => void }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450)}
      style={{ marginBottom: space.md }}
    >
      <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: tint(color.amber, 0.12),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: space.lg,
          }}
        >
          <Ionicons name="leaf-outline" size={26} color={color.amber} />
        </View>
        <Txt variant="heading" style={{ textAlign: "center" }}>
          No habits yet
        </Txt>
        <Txt
          variant="small"
          c={color.textMuted}
          style={{ textAlign: "center", marginTop: space.sm, maxWidth: 280 }}
        >
          Start with one. Kinextion can suggest something from what it already
          knows about you, work it out with you in conversation, or get out of
          the way while you write your own.
        </Txt>
        <Button
          label="Build your first habit"
          icon="add"
          accent={color.amber}
          style={{ marginTop: space.xl, alignSelf: "stretch" }}
          onPress={onStart}
        />
      </Card>
    </Animated.View>
  );
}

/** Why a habit isn't on today's list, in a few words. */
function notTodayDetail(h: Habit): string {
  if (h.status === "paused") return "Paused";
  if (h.startsOn && h.startsOn > today()) {
    const day = new Date(`${h.startsOn}T12:00:00Z`).toLocaleDateString(
      undefined,
      {
        weekday: "long",
        timeZone: "UTC",
      },
    );
    return `Starts ${day}`;
  }
  return h.frequency === "weekly" ? "Done this week" : h.scheduleLabel;
}
