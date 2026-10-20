# Testing the community loop on a device

The community layer is covered by API tests (`pnpm --filter @kinextion/api test`),
which enforce every rule the server owns — the gate, one response per topic,
hidden totals, expiry. What no automated test here covers is the phone itself:
the camera, the microphone, a real upload over cellular, and rotation. This is
that pass. Run it on a physical device before each release that touches
community; the simulator will not catch the interesting failures.

## Setup

1. Start the API with dev tools on, so a week can be walked in minutes:

   ```bash
   COMMUNITY_DEV_TOOLS=1 pnpm --filter @kinextion/api dev
   ```

2. Seed a community you're a member of:

   ```bash
   pnpm --filter @kinextion/api community:seed
   ```

3. Start the app (`pnpm --filter @kinextion/mobile dev`) and sign in.

Move the clock with `POST /api/community/dev/clock` (`{"advanceHours": 24}`),
which also runs maintenance — that's how you get from gathering to a vote to an
open room without waiting for Wednesday.

## The pass

1. **Community tab** — the tab appears between Habits and Guides, and shows
   your community with its current stage.
2. **Choosing** — pick a community, then change it. Then choose "Sit this one
   out" and confirm nothing scolds you: no streak, no badge, no red.
3. **Suggesting** — during gathering, send a thought. It disappears into
   Kairo; nothing shows it with your name.
4. **Voting** — during voting, four options appear. Vote, then change your
   vote. Confirm no count is visible anywhere.
5. **Locked room** — open the room before speaking. It shows the question and
   the deadline, and nothing about who has already spoken.
6. **Record video** — tap Add your voice, record for **under two minutes**, and
   confirm the review screen refuses to send and says why. Then record a real
   answer of 2–3 minutes and send it.
7. **Upload over cellular** — turn Wi-Fi off and repeat step 6 with a
   5-minute video. Then toggle airplane mode mid-upload: it must fail with a
   message that says what happened, never silently lose the take.
8. **Backgrounding mid-record** — start recording, background the app, return.
   Either the take survives or you're told clearly that it didn't. Losing nine
   minutes silently is unacceptable.
9. **Unlock** — after sending, the room opens and lists the other voices in
   your circle.
10. **Landscape** — open a response. The phone locks landscape, playback works,
    and going back restores portrait. **Repeat with the device's own rotation
    lock switched on** — this is the case that breaks.
11. **Audio response** — record an audio answer from another account. It shows
    artwork and a real player, not a black rectangle. Record one in silence and
    confirm it's refused and the room stays locked.
12. **React and comment** — react, change your reaction, and confirm no totals
    appear. Comment, reply once, and confirm a reply can't be replied to.
13. **Close the week** — advance the clock past Sunday 21:00 Central. The room
    shows where it landed, and community-only recordings are gone.

## Known gaps

- **Video takes aren't metered**, so the silence check only applies to audio
  responses. The recorder reports an audible-signal ratio from the microphone
  during an audio take; `expo-camera` gives no equivalent while recording
  video, so video sends none and the server skips that check.
- **The duplicate check uses a fingerprint, not a full hash** — file size plus
  the first and last 64KB. It catches the same file being submitted twice,
  which is what it's for; it is not a content-identity guarantee.
- **The app is on Expo SDK 57**, so it runs in the current Expo Go. Recording
  audio uses `expo-audio`, playback uses `expo-video` (`expo-av` was removed
  in SDK 54), and uploads use `expo-file-system/legacy`.
- **After any dependency change, start Metro with `--clear`.** A cache built
  against an older SDK fails in confusing ways.
