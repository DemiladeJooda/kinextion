# Deploying Kinextion

Three deployable pieces: the **API** (`apps/api`), the **website** (`apps/web`),
and the **mobile app** (`apps/mobile`). Deploy the API first — the other two
call it.

---

## 1. Database

Managed Postgres (currently Neon). One-time:

```bash
pnpm --filter @kinextion/database generate   # generate the Prisma client
pnpm --filter @kinextion/database push       # sync schema (dev)
```

For production, prefer migrations over `push` so schema changes are
reviewable and reversible:

```bash
pnpm --filter @kinextion/database migrate
```

---

## 2. API (`apps/api`)

Any Node 20+ host (Railway, Fly, Render, ECS). Not serverless-friendly — it
holds a Prisma connection pool and runs a scheduled job.

```bash
pnpm --filter @kinextion/api build
pnpm --filter @kinextion/api start
```

### Required environment

The server **refuses to boot** if any of these are missing or look like
development values, and prints exactly what's wrong. Full list in
`.env.example`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `CLERK_SECRET_KEY` | Verifying user sessions (must be `sk_live_…`) |
| `CLERK_PUBLISHABLE_KEY` | Clerk client config (must be `pk_live_…`) |
| `ANTHROPIC_API_KEY` | The AI guides |
| `INTEGRATIONS_ENCRYPTION_KEY` | Encrypting stored OAuth tokens (≥32 chars) |
| `API_PUBLIC_URL` | Public base URL — OAuth providers redirect here |
| `WEB_ORIGIN` | Comma-separated CORS allowlist |
| `NODE_ENV=production` | Enables the strict checks above |

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Rotating `INTEGRATIONS_ENCRYPTION_KEY` invalidates every stored OAuth
> token.** Users would have to reconnect Strava/Whoop/Oura. Treat it as
> permanent unless it leaks.

### Scheduled job

Run nightly, off-peak. This is what keeps storage bounded.

```bash
pnpm --filter @kinextion/api retention             # apply
pnpm --filter @kinextion/api retention -- --dry-run  # report only, no deletes
```

Exits non-zero on failure so a scheduler can alert. Always run `--dry-run`
first after changing any retention window.

### Community maintenance — hourly

Everything in the community layer that happens because time passed rather than
because someone acted: admission panels that went quiet, forming communities
that never formed, each week's cycles, Kairo's topic synthesis, ballots closing,
rooms settling, and deleting media whose window has ended.

```bash
pnpm --filter @kinextion/api community              # apply
pnpm --filter @kinextion/api community -- --dry-run # report only, no writes
```

Run it **hourly**. Every step is idempotent, so an overlapping or repeated run
is harmless, and a failure in one community never stops another's week — the
job reports what failed and exits non-zero. Missing an hour is survivable: the
next pass does the work that was due, including synthesising and deciding a
topic in the same run if the whole voting window was missed.

Two things it needs to do its whole job:

- `ANTHROPIC_API_KEY` for topic synthesis. Without it, ballots come from the
  prompt bank and weeks still get a question.
- The `R2_*` variables to delete recordings. Without them, nothing is purged —
  media stays in storage past its window, which is a privacy promise broken, so
  set these before real users record anything.

### Media storage (`R2_*`)

Community recordings are uploaded by the client straight to Cloudflare R2 with
a presigned URL and played back the same way; the API never carries the bytes.
The API boots fine without these variables and answers a clear 503 on the
upload routes, so the rest of Kinextion is unaffected while storage is being
set up.

| Variable | Purpose |
|---|---|
| `R2_ACCOUNT_ID` | R2 account, used to build the S3 endpoint |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Signing uploads, playback and deletes |
| `R2_BUCKET_NAME` | Bucket holding recordings |

The bucket must **not** be public: every read is a short-lived signed URL, and
the retention job deletes objects when a week closes or a public response's 30
days are up.

---

## 3. Website (`apps/web`)

Next.js on Vercel. Environment:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk (client) |
| `CLERK_SECRET_KEY` | Clerk (server) |
| `ANTHROPIC_API_KEY` | The chat/vision demo routes |
| `NEXT_PUBLIC_API_URL` | Points at the deployed API |

---

## 4. Mobile (`apps/mobile`)

Expo + EAS. Build profiles are in `eas.json`.

```bash
npm install -g eas-cli
eas login
eas init            # writes the real projectId into app.json
```

### Before the first build

1. Replace `extra.eas.projectId` in `app.json` (`eas init` does this).
2. Set the Clerk key for each profile — it is **not** in `eas.json`, because
   the production value differs from the development one:
   ```bash
   eas env:create --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_… --environment production
   ```
3. Add app icons. `app.json` references an adaptive icon and splash colour but
   **no icon files exist yet** — both stores reject a submission without them.
   Required: `icon.png` (1024×1024, no transparency) and
   `adaptive-icon.png` for Android.

### Build and submit

```bash
eas build --platform all --profile preview      # internal testing
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

---

## 5. Store submission requirements

Both stores gate on these. Status as of now:

| Requirement | Status |
|---|---|
| In-app account deletion | **Done** — Profile → Delete account, cascading server-side delete |
| Camera usage descriptions | **Done** — `NSCameraUsageDescription` et al. in `app.json` |
| Encryption declaration | **Done** — `usesNonExemptEncryption: false` |
| App icons | **You must add** — 1024×1024 `icon.png` + Android adaptive icon |
| Privacy policy URL | **You must write and host** |
| Data-safety / privacy-nutrition disclosures | **You must complete** — content below |
| EAS project id | **You must run `eas init`** — `app.json` has a placeholder |
| Live Clerk keys | **You must provision** — the API refuses to boot on `sk_test_` in production |

### What the disclosures must declare

Be accurate here; both stores audit it. The app collects and stores:

- **Health & fitness** — habits, workouts, and (when the user connects a
  provider) sleep, HRV, and resting heart rate.
- **Sensitive info** — mood scores and free-text journal entries, and, only
  if the user fills in About you, self-described racial/ethnic background and
  gender. Optional, never inferred, clearable.
- **Audio** — none stored. Speech is turned into text by the phone's own
  recogniser (on-device where supported, otherwise Apple's/Google's speech
  service); Kinextion receives only text.
- **User content shared with others** — community responses (text, audio,
  video) and any habit the user chooses to share with a community.
- **Identifiers** — email address, via Clerk.
- **Camera** — processed for form/referee/environment analysis. Frames are
  **not** recorded or retained; say so explicitly.

Also disclose that data is shared with **Anthropic** (AI processing), with
**ElevenLabs** only if the premium voice is switched on (the text of guides'
replies), and, only where the user connects them, **Strava / Whoop / Oura**. The Therapist
Starter Pack shares data **only** on explicit per-category opt-in and only to
a recipient the user chooses — Kinextion never transmits it automatically.

---

## Deploy order

1. Migrate the database.
2. Deploy the API; confirm `GET /health`.
3. Deploy the website.
4. Ship the mobile build pointing at the deployed API.

Rolling back the API is safe; rolling back a schema migration is not — take a
snapshot before migrating.
