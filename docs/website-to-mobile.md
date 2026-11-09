# Website → mobile: what to add

The website now only claims signals that have a real source. This is the list of what the mobile app needs to catch up on, from the November 2026 website rebuild.

Source of truth for the website's signals: `apps/web/lib/signal-taxonomy.ts`. When an item below ships, change its `status` from `"next"` to `"live"` and the site updates itself.

## 1. Signals an integration can supply, not read yet

Shown on the Solution page as "Coming next".

| Signal | Source | What's needed |
|---|---|---|
| Apple Watch (resting HR, HRV, active minutes) | Apple Health / Health Connect | API ingest and the app's reader interface exist. Needs the native packages and a dev build (see `integrations-checklist.md`). |
| Calendar | Google, Outlook | Built. Needs `GOOGLE_*` and `MICROSOFT_*` keys and OAuth verification. |
| Cycle phase | Apple Health (menstrual flow), Health Connect (menstruation) | New read, opt-in only. Say "affects people differently, so it learns your pattern" (`claims-and-sources.md`). |
| Skin temperature | Oura (`temperature_deviation`), Apple Health (wrist temperature) | New metric type in `oura.ts` and `device.ts`. |
| Sleep rhythm | Oura (bedtime start/end), Apple Health (sleep samples) | We only keep sleep totals. Keep bedtime and wake time, then compute the drift. |
| Mindful minutes | Apple Health (mindful sessions), Health Connect | New read. Can auto-log a linked habit. |
| Nutrition | Apple Health, Health Connect | Read-only: whatever a food app has written there. |
| Water | Apple Health, Health Connect | Same. |
| Time in daylight | Apple Health (iOS 17+, Apple Watch only) | New read. Narrow audience; lowest priority here. |

To check when building: exact scopes and availability on each provider's developer docs.

## 2. Removed from the website

No integration can supply these. They can return if a real source is added.

| Signal | Why it went |
|---|---|
| Digital behaviour (screen time) | iOS doesn't let other apps read Screen Time data. The app's own usage log only covers Kinextion. |
| Environment (weather, air quality) | Nothing reads this. Would need a weather API; worth considering because guides already talk about things like Texas heat. |
| Nature exposure | Needs location history, which the app deliberately doesn't keep. |

Also changed: "3-yr memory" is now "What worked before" (the app doesn't have three years of anyone), "Pod activity" is now "Your community" (the app has rooms, not pods), "Travel & location" is now "Away mode" (user-declared, no tracking), "Family context" is now "Your days & people" (About you).

## 3. Ideas from the old How It Works page

These were promised on the website. None has dedicated handling in the code today, unless noted.

**Build first: safety**

- **Eating disorder guardrail.** The site called it "critical": a disclosed history changes how the system talks about weight and food. No code or guidance mentions it. Should go into `packages/ai-core/src/personas/safety.ts` and the memory constraints.
- **Medication context.** SSRIs, beta blockers and stimulants shift heart rate and sleep baselines. Only mentioned in passing today. Guides should know to read those numbers differently when someone has shared this.

**Build next: fit**

- **Daily voice brief.** A short spoken morning summary from a guide. Fits the voice-first direction.
- **Nudges that learn.** Track which reminder style someone responds to and rotate toward it.
- **Returning user recognition.** Someone coming back skips the generic first day. Partly there through memory and away mode.
- **Chronotype.** One onboarding question, used to place habits.
- **Neurodivergence.** Opt-in; changes scheduling, wording and how streaks are shown.
- **Life-stage prompts.** Shift work, caregiving and bereavement are only picked up if someone types them into About you. Could be gentle opt-in prompts. Anniversaries of a loss get softer treatment.

**Later**

- **Spotify.** The API reads listening minutes, but no screen in the app uses it. Show it or drop it.
- **AI-generated workout programming.** Not built.
- **Community milestone events.** Goals exist; events don't.
