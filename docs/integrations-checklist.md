# Third-party services: what's built, what each one needs

Everything below is built and tested against mocks. Each service switches on
when its keys are in `.env`, and the app shows "connect" or "coming soon"
until then. Nothing else in the app depends on any of them.

Things marked **To check** are questions for the research day, not facts.
Pricing, approval rules and limits change, so confirm each one on the
provider's own developer site.

All OAuth services use the same redirect URL. Register this with each
provider:

```
{API_PUBLIC_URL}/api/integrations/{provider}/callback
```

e.g. `https://api.kinextion.com/api/integrations/strava/callback`

---

## Fitness and sleep (auto-logging habits)

| Service | Env vars | What Kinextion reads | Logs habits like |
|---|---|---|---|
| Strava | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Activities, totalled per day (minutes) | "Evening walk", "Run" |
| Whoop | `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` | Recovery (HRV, resting HR), workouts (minutes) | "Train" |
| Oura | `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET` | Sleep score, daily steps | "8,000 steps" |

How auto-logging works:
- After each sync, a habit linked to that service is logged for today and yesterday when the reading counts.
- It never overwrites a day the user logged or undid.
- The Habits tab syncs linked services when it opens, at most every 15 minutes.

**To check**
- Strava: is there a limit on connected athletes before an app review? What does review need (screenshots, privacy policy, brand guidelines for "Powered by Strava")?
- Whoop: is developer access open or by application? The code uses `/developer/v1/…` endpoints. Have they moved to v2, and is v1 being retired? Is the `read:workout` scope available to us?
- Oura: do users need an active Oura membership for API data? Is `daily_activity` covered by the `daily` scope?
- For each one: commercial-use terms, rate limits, and any rules on storing data (we keep daily totals, plus raw payloads for Strava).

## Calendars

| Service | Env vars | What's read |
|---|---|---|
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Busy times, for the rhythm of someone's week |
| Outlook | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Same |

**To check**
- Google: calendar read scopes are "sensitive". What does OAuth verification need, and how long does it take? Until it's verified, are we capped at a set number of test users?
- Microsoft: multi-tenant app registration and publisher verification.

## Music

| Service | Env vars |
|---|---|
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |

**To check:** does development mode limit how many users can connect before an extension request?

## Voice

| Piece | How | Cost |
|---|---|---|
| Listening (speech to text) | On the phone: Apple/Google speech recognition via `expo-speech-recognition`, on-device where supported | No API bill. On phones without on-device recognition, audio goes to Apple's or Google's speech service (disclosed in the privacy policy). Kinextion only receives the text |
| Speaking, default | On the phone: `expo-speech`, using the best English voice the phone has | No API bill |
| Speaking, premium | ElevenLabs: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ALTHEO`, `ELEVENLABS_VOICE_KAIRO`, optional `ELEVENLABS_MODEL` (default `eleven_flash_v2_5`) | Billed per character |

If the premium voice is missing or fails, the app falls back to the phone's
voice, sentence by sentence.

**To check**
- ElevenLabs: price per character on each plan, commercial licence for app use, and picking or designing a voice for each guide.
- Alternatives to compare on the same day: OpenAI TTS, Google Cloud TTS, Azure Neural voices.
- Apple speech recognition: per-device and per-app request limits for long conversations. Does on-device recognition need iOS 17 or later for English?

**Build note:** the speech recogniser is a native module. **A new dev build is needed** (`eas build --profile development`). Older builds open chat in typing mode instead of crashing.

## Home-screen widgets

Built so far:
- The snapshot of today's habits (`packages/shared/src/habits/widget.ts`).
- The app publishing it (`apps/mobile/lib/widget.ts`).
- The `kinextion://quick-log?habit=…&state=done` link that logs a habit.

Still needed, at build time:
1. **iOS:** a WidgetKit extension target, e.g. via `@bacons/apple-targets`. It needs an App Group shared with the app (e.g. `group.com.kinextion.app`) and a small Expo module named `KinextionWidget` with `setSnapshot(json)`. That method writes to the App Group's `UserDefaults` and calls `WidgetCenter.shared.reloadAllTimelines()`. Buttons that tick a habit without opening the app use an AppIntent (iOS 17+). Without one, the button opens the quick-log link.
2. **Android:** an App Widget, e.g. via `react-native-android-widget`, reading the same snapshot from `SharedPreferences` through the same `KinextionWidget` module.

**To check:** the Apple developer account needs App Groups enabled for the bundle id.

## Apple Health and Health Connect (not started)

These are on-device, so there's no partner deal. They need a native module (e.g. `react-native-health` / `react-native-health-connect`), HealthKit entitlements and App Store review notes. They would add steps, workouts and sleep for people without a wearable.
