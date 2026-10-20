# Testing the community layer

Everything the server owns is already covered by `pnpm --filter @kinextion/api test`
— the gate, one response per topic, hidden totals, anonymity, expiry. What those
tests can't tell you is whether the Prisma queries run against real Postgres,
whether uploads reach R2, and whether the phone behaves. That's what this is for.

The device-specific pass lives in `apps/mobile/TESTING-community.md`. Do the
setup here first.

---

## 0. Before anything

**Point `DATABASE_URL` at a development database.** The schema adds ~20 tables
and `db push` will apply them wherever that variable points. If it currently
points at the database with your real users, branch it in Neon first and use
the branch's URL.

```bash
grep DATABASE_URL .env
```

---

## 1. One-time setup

```bash
pnpm db:generate && pnpm db:push
```

Add to `.env` (the API reads it at boot):

```
COMMUNITY_DEV_TOOLS=1
```

Media uploads need R2. Without the four `R2_*` variables the API still runs and
every other screen works, but recording answers `503 MEDIA_UNAVAILABLE` and
nothing gets purged. Fill them in `.env` before testing the recorder.

Check `apps/web/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3001`.

---

## 2. Start the API and seed a community

```bash
pnpm --filter @kinextion/api dev
```

Your account row is created the first time an authenticated request reaches this
API — **signing in to Clerk on its own doesn't do it.** With the API running,
sign in and open `/dashboard` on the website (or launch the phone app); that
first call creates it. Then:

```bash
pnpm --filter @kinextion/api community:seed -- --join you@example.com --applicant
```

`--join` puts you in the community as a steward, so steward-only paths work
too. `--applicant` adds a fixture member asking to join, drawing a fresh
admission panel from whoever is in the community *now* — which is what puts a
vote in front of you. Without it, the seed's original applicant was judged by a
panel drawn before your account existed.

That creates eight fixture members ("Seed Member 1"…), founds **Seed Community**
through the real invite flow, and leaves a ninth member waiting on the admission
panel — so you have something to vote on.

---

## 3. Driving the week

A real week takes a week. The dev clock doesn't:

```bash
curl http://localhost:3001/api/community/dev/clock
```

```bash
curl -X POST http://localhost:3001/api/community/dev/clock -H "Content-Type: application/json" -d "{\"advanceHours\":24}"
```

Each move also runs maintenance, so cycles get created, Kairo builds the ballot,
votes are decided, rooms settle, and expired media is purged. The response tells
you what happened and lists any errors.

These routes need no session and **cannot exist in production** — the server
only registers them when `NODE_ENV` isn't production *and* `COMMUNITY_DEV_TOOLS=1`.

The stages, in order, with what to test at each:

| Stage | How to get there | What to test |
|---|---|---|
| `gathering` | advance 1h from a fresh seed | suggestions |
| `voting` | advance to Friday 18:00 Central | the four options, changing your vote |
| `open` | advance to Monday 00:00 Central | locked room, recording, unlock, reactions, comments |
| `closed` → `settled` | advance past Sunday 21:00 Central | the reveal, community media deleted |

Watch the current stage in the app, or in the response from the clock call.

---

## 4. Website

```bash
pnpm --filter @kinextion/web dev
```

1. **Signed out**, open `/discover`. With nothing public yet it says so plainly.
   Confirm no console errors.
2. **Signed out**, open `/community` — it must redirect to `/sign-in` and carry
   `redirect_url` back.
3. Sign in and open `/community`. Your seeded community appears with its stage.
4. **Choose** a community, then change it, then pick *Sit this week out*.
   Confirm nothing scolds you — no streak, no badge, no red.
5. During `gathering`, send a suggestion. It disappears; nothing shows it with
   your name.
6. During `voting`, four options appear. Vote, change your vote, and confirm no
   count is visible anywhere on the page.
7. During `open`, open the room **before speaking**. It shows the question and
   the deadline and nothing about who has already spoken. Recording is
   phone-only, so this is the state the web shows until you've answered on the
   app.
8. After answering on the phone, reload: the room lists your circle. Play a
   response, react, change your reaction, comment, reply once.
9. Open `/community/groups/<communityId>` — members, history, chest.
10. After `settled`, the room page shows where the room landed and says the
    recordings are gone.

---

## 5. Mobile

Follow `apps/mobile/TESTING-community.md` — 13 steps on a physical device,
covering the recorder, cellular upload, backgrounding mid-take, landscape
playback with rotation lock on, and the silence check.

```bash
pnpm --filter @kinextion/mobile dev
```

The app finds the API automatically when the phone is on the same Wi-Fi as
Metro (`http://<your-machine>:3001`). If it can't connect, allow Node through
the Windows firewall, or set `EXPO_PUBLIC_DATA_API_URL` explicitly.

---

## 6. Things worth knowing before you start

- **You need two accounts to see a real room.** With one, the room correctly
  says "You're first". Use a second Clerk account on a second device (or a
  private browser window) and have both answer the same question.
- **Recording is phone-only by design.** The web surface listens, reacts and
  comments; it never records.
- **The seeded members can't speak** — they're database fixtures with no
  devices. Only real accounts can submit responses.
- **Without R2 configured**, everything except recording and playback works.

---

## 7. Resetting

The seed is safe to re-run; it leaves an existing Seed Community alone and just
re-adds you. To start clean, drop the seed community and its fixture users in
Prisma Studio:

```bash
pnpm --filter @kinextion/database studio
```

Deleting the `Seed Community` row cascades to its memberships, cycles, ballots,
responses and results. Stored media is deleted by the maintenance job, not by
the row delete — if you drop rows by hand, the objects stay in the bucket.
