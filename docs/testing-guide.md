# Testing guide: everything since the last device test

For each part: where to find it, what to try, what to watch for, and what
feedback is most useful. Give feedback however suits you. Notes about how
the AI talks or decides go into `apps/api/guidance/*.md` (see the README
there). Everything else, tell me directly.

## Before you start

1. **A new dev build.** Voice uses a new native module, so the build on your phone can't do it.
   ```
   cd apps/mobile && eas build --profile development --platform ios
   ```
   (or `--platform android`). An older build still works but opens chat in typing mode.
2. **Run the API and Metro on the same Wi-Fi as your phone.** `pnpm --filter @kinextion/api dev`, then `pnpm --filter @kinextion/mobile dev`. The app now finds your computer by itself; it used to try "localhost", which on a phone is the phone.
3. **The Anthropic account needs credit.** `pnpm --filter @kinextion/api ai:smoke` and `chat:smoke` are a quick check that all the AI pieces answer (a few cents each).
4. **Demo mode** (`pnpm --filter @kinextion/mobile demo`) runs with sample data and no account, which is good for the simulator and away mode. The guides don't act in demo mode.

---

## 1. Talking to the guides (voice)

**Where:** Altheo or Kairo → chat opens with the orb.

**Try**
- Tap the orb and talk: "I want to start doing push-ups every morning." Stop talking and see whether it sends by itself.
- Let it answer aloud, then reply without tapping anything (it should already be listening).
- Interrupt it mid-sentence by tapping the orb.
- Turn the voice off (right button), and switch to typing and back (left button). Close and reopen chat: does it remember your choice?
- Try it with headphones, in a noisy room, and with the phone on silent.

**Watch for**
- The words you say should appear as you speak, without long pauses.
- The gap between you stopping and it starting to talk.
- Whether it sounds like talk (short sentences, no lists) or like reading out a text.
- Audio coming out of the earpiece instead of the speaker.
- It hearing itself and replying to its own voice.

**Feedback that helps:** the moments it felt like a person and the moments it felt like a machine, the voice itself (the phone voice is the free default; a more human one is an option), and anything it mishears often.

## 2. Guides acting in the app

**Where:** chat, either typing or voice.

**Try**
- "Add a habit to drink water when I wake up, 8 glasses, 2 on bad days." You should get a card with **Undo**, and Today should show it.
- "Just did my push-ups." / "Only managed 5 glasses." / "Feeling about a 4 today."
- "I'm at the airport, off to Lagos for a week, pause my habits." Then try the Undo.
- "Remember my left knee is sore."
- Undo each card. Is everything back the way it was?

**Watch for:** it doing something you didn't ask for; it asking permission for something you did ask for; wrong dates ("yesterday" after noon is locked, by design); cards whose wording isn't clear.

## 3. Tiny version (habit builder)

**Where:** Habits → + → step 3 "Make it easy on bad days".

**Try:** type a habit name like "Push-ups", "Read" or "Walk". Do the example and the placeholder change to match? Does it make sense without explanation?

## 4. Counting amounts

**Where:** builder step 3, "Count an amount instead". You can also edit an existing habit.

**Try:** water, usual 8, tiny 2, unit glasses. On Today, tap it: a stepper opens. Try 1 (saved but doesn't count), 3 (tiny version), 8 (done). Also try ⋯ → "Log an amount".

**Watch for:** whether the line under the number ("The tiny version. It still counts.") makes sense; the plus/minus step size for big numbers like steps.

## 5. Going away and coming back

**Where:** Habits → For you → "Going away?". In demo mode it works with sample habits.

**Try:** pick a reason and a length, untick one habit, then pause. Today should show the away banner and no due habits. Then "I'm back", tick "Still works" on some habits, and use "Change it" on one.

**Watch for:** the days you were away showing as misses or breaking a streak (they shouldn't); the wording for each reason; "Welcome back" appearing once the return date arrives.

## 6. How habits form (demo simulator)

**Where:** Habits → For you → "How habits form".

**Try:** play, drag across the chart, switch habit, life, 90 days or 9 months. Read a few mornings and nights. Fill in About you, come back, and choose "Your life".

**Watch for:** does it make you feel "I can see an end"? Is anything unclear? Is any diary line off or repetitive? Does it work as a demo for someone seeing the app for the first time?

## 7. Where this could go (your own habit)

**Where:** open one of your habits → "Where this could go". Your habits also appear first in the simulator.

**Try:** compare the four futures. Answer a weekly "how automatic" check, if one's offered, and see whether the curve changes.

**Watch for:** the past looking wrong (days you did it showing as missed); the "about N days from today" lines feeling like a promise rather than a possibility.

## 8. About you

**Where:** Profile → About you.

**Try:** fill it in honestly, then ask Altheo something like "Help me pick a time to walk this week" and Kairo "I've been stressed with work". Then clear it and ask again.

**Watch for:** advice that clearly fits your life (weather, schedule, family); anything that feels like a stereotype or an assumption. That's the most important thing to report.

## 9. Build it with your community

**Where:** a habit's page → "Build it with your community" (only if you're in a community). Then the community page → "Building together".

**Watch for:** whether a week of dots feels like company or like being watched, and whether you'd want to share at all.

## 10. Auto-logging and widgets: not testable yet

- **Auto-logging** needs Strava, Whoop or Oura keys (see `docs/integrations-checklist.md`). The setup on a habit's page shows "connect" until then.
- **Widgets** need the native widget target added to the build. The app side is ready.

## 11. Already built, worth a pass

- **Weekly "how automatic" check** after ticking a habit, and graduating a habit once it's automatic (phase 8).
- **Settings → Habits & streaks**: the Show streaks switch. Also the gentle check-in if the app gets opened very often (phase 9).

## Health check on real data

```
pnpm --filter @kinextion/api habit:metrics
```

This prints logging days per week, recovery after a miss, 30-day survival and automaticity, once there's enough data to say anything.
