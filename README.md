# ReachInbox Scheduler

A full-stack bulk email job scheduler: no cron, survives restarts, no duplicate
sends, per-sender rate limiting with automatic hour-window overflow, live Slack
alerts, Elasticsearch search, and Google-authenticated dashboard.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Environment variables](#2-environment-variables)
3. [Creating the Google OAuth app](#3-creating-the-google-oauth-app)
4. [Creating the Slack app](#4-creating-the-slack-app)
5. [Architecture](#5-architecture)
6. [Chosen values](#6-chosen-values)
7. [Features mapped to requirements](#7-features-mapped-to-requirements)
8. [Testing](#8-testing)
9. [Assumptions, shortcuts, and trade-offs](#9-assumptions-shortcuts-and-trade-offs)

---

## 1. Quick start

### Prerequisites
- Docker Desktop (running)
- Node.js 20+
- A Google Cloud project with an OAuth client (§3)
- A Slack app (§4) — optional; the app runs fine without it, Slack alerts just won't fire

### Steps

```bash
# 1. Start Postgres (with AOF-equivalent durability), Redis (AOF), Elasticsearch
docker compose up -d
docker compose ps   # wait until all three are "healthy"

# 2. Install dependencies (npm workspaces: backend + frontend)
npm install

# 3. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env: fill in GOOGLE_*, SLACK_*, and generate real secrets:
#   JWT_SECRET, SLACK_STATE_SECRET -> any long random string
#   ENCRYPTION_KEY                 -> exactly 32 characters (AES-256 key)

# 4. Create database tables
npm run prisma:migrate

# 5. Seed 4 Ethereal (fake SMTP) test senders
npm run seed:senders

# 6. Run all three processes (separate terminals)
npm run dev:api      # http://localhost:4000
npm run dev:worker   # BullMQ worker (no HTTP port)
npm run dev:web      # http://localhost:3000
```

Open `http://localhost:3000`, sign in with Google, upload a CSV of lead emails,
and schedule a campaign. Watch `http://localhost:4000/admin/queues` (Bull Board,
behind login) for delayed/active jobs.

### Load test
```bash
npm run load-test --workspace backend -- --count=1000 --hourlyLimit=50
```
Schedules 1000 emails through the real campaign API path (not a bypass), so you
can watch pacing and hourly overflow happen live in Bull Board and the dashboard.

### Restart test
```bash
# schedule a few emails 2-5 minutes out, then:
docker compose stop        # or kill dev:api / dev:worker
docker compose start
npm run dev:worker          # boot reconciliation runs automatically
```
Nothing is lost: Redis's AOF persists delayed jobs, Postgres is the source of
truth, and the worker's boot reconciliation re-adds any orphaned jobs and
resolves anything stuck mid-send. See §5.4.

---

## 2. Environment variables

### Backend (`backend/.env`)

| Variable | Purpose | Example / chosen default |
|---|---|---|
| `PORT` | API port | `4000` |
| `FRONTEND_URL` | CORS origin + OAuth redirect target | `http://localhost:3000` |
| `JWT_SECRET` | Signs the httpOnly session cookie | long random string |
| `ENCRYPTION_KEY` | AES-256-GCM key for SMTP passwords / Slack tokens at rest | **exactly 32 characters** |
| `DATABASE_URL` | Postgres connection string | `postgresql://reachinbox:reachinbox@localhost:5433/reachinbox` (container's host port; changed from the 5432 default to avoid clashing with a locally-installed Postgres) |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | ES connection string | `http://localhost:9200` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials | see §3 |
| `GOOGLE_CALLBACK_URL` | Must match the app's authorized redirect URI | `http://localhost:4000/api/auth/google/callback` |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack app credentials | see §4 |
| `SLACK_REDIRECT_URI` | Must match the app's redirect URL | `http://localhost:4000/api/slack/callback` |
| `SLACK_STATE_SECRET` | Signs the OAuth `state` param (CSRF + carries userId) | long random string |
| `WORKER_CONCURRENCY` | Parallel jobs per worker process | `5` |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Minimum gap between two sends from the **same sender** | `2000` (2s) |
| `MAX_EMAILS_PER_HOUR` | Global ceiling (documented, not enforced per-sender) | `200` |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Default hourly cap per sender (overridable per-Sender in DB) | `50` |
| `JOB_ATTEMPTS` | BullMQ retry attempts before a send is marked `failed` | `3` |
| `SENDING_STUCK_TIMEOUT_MIN` | How long an email can sit in `sending` before boot reconciliation treats it as crashed | `10` |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL, e.g. `http://localhost:4000` |

---

## 3. Creating the Google OAuth app

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create
   a new project (or reuse one).
2. **APIs & Services → OAuth consent screen**
   - User type: External (or Internal if using a Workspace org)
   - Fill in app name, support email, developer email
   - Scopes: add `.../auth/userinfo.email` and `.../auth/userinfo.profile` (default)
   - Add yourself as a test user if the app stays in "Testing" mode
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:4000/api/auth/google/callback`
     (must exactly match `GOOGLE_CALLBACK_URL`)
4. Copy the generated **Client ID** and **Client secret** into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
   ```
5. Restart the API. "Continue with Google" on `/login` now works.

**Going over HTTPS/ngrok:** if you tunnel the backend (e.g. for a Slack demo,
see §4), add the tunnel's callback URL as an additional authorized redirect URI
in the same OAuth client, and update `GOOGLE_CALLBACK_URL` accordingly.

---

## 4. Creating the Slack app

Slack alerts require the API to be reachable over **HTTPS** for the OAuth
redirect (Slack rejects plain `http://` redirect URIs for non-localhost hosts).
For local dev, use a tunnel: `ngrok http 4000` or `cloudflared tunnel --url http://localhost:4000`.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
   - Name it (e.g. "ReachInbox Alerts"), pick your workspace.
2. **OAuth & Permissions** (left sidebar):
   - Under **Redirect URLs**, add: `{YOUR_TUNNEL_OR_API_URL}/api/slack/callback`
     (must exactly match `SLACK_REDIRECT_URI`)
   - Under **Scopes → Bot Token Scopes**, add:
     - `incoming-webhook` (required — lets the app post to a channel via webhook)
     - `chat:write` (optional, kept for future use; the notifier currently uses the webhook)
3. **Basic Information** → note the **Client ID** and **Client Secret**.
4. Fill in `backend/.env`:
   ```
   SLACK_CLIENT_ID=xxxx.xxxx
   SLACK_CLIENT_SECRET=xxxx
   SLACK_REDIRECT_URI=https://your-tunnel.ngrok-free.app/api/slack/callback
   SLACK_STATE_SECRET=some-long-random-string
   ```
5. Restart the API. On the dashboard, click **Connect Slack** → choose the
   channel for the incoming webhook → you're redirected back connected.
6. **Test it:** set `MAX_EMAILS_PER_HOUR_PER_SENDER=3` in `.env`, restart the
   worker, schedule 10 emails to one sender, and watch the Slack message arrive
   when the 4th email in that hour gets rate-limited.

If Slack isn't connected, rate-limit handling still works exactly the same —
the notifier just no-ops (looks up the connection, finds none, returns).

---

## 5. Architecture

```mermaid
flowchart LR
    subgraph Client
        FE[Next.js Dashboard]
    end

    subgraph API[Express API]
        AUTH[Google OAuth /\nJWT cookie]
        CAMP[POST /campaigns]
        EMAILS[GET /emails, /emails/search]
        SLACKAPI[Slack OAuth]
        BOARD[Bull Board /admin/queues]
    end

    subgraph Data
        PG[(Postgres\nsource of truth)]
        REDIS[(Redis AOF\nBullMQ + rate-limit state)]
        ES[(Elasticsearch\nsearch index)]
    end

    WORKER[BullMQ Worker\n(separate process)]
    SMTP[Ethereal SMTP]
    SLACK[Slack Incoming Webhook]

    FE <--> API
    CAMP --> PG
    CAMP --> REDIS
    CAMP --> ES
    EMAILS --> PG
    EMAILS --> ES
    BOARD --> REDIS

    REDIS <--> WORKER
    WORKER --> PG
    WORKER --> ES
    WORKER --> SMTP
    WORKER --> SLACK
```

### 5.1 Scheduling (no cron)
`POST /api/campaigns` does all of this in one request, no background poller:
1. Validate + dedupe leads (Zod schema, case-insensitive dedupe).
2. Round-robin assign each lead to an active `Sender`; each sender gets its own
   sequence number (`seq`) so it paces independently:
   `scheduledAt = startAt + seq * delayBetweenMs`.
3. `createMany` all `Email` rows in Postgres (status=`scheduled`) — this is the
   durable record.
4. `queue.addBulk()` in chunks of 500, `jobId = email.id`, `delay = scheduledAt - now`.
   BullMQ stores this as a **delayed job in Redis** — no `setInterval`, no
   `node-cron`, nothing polling. Redis's own internal timer wakes the job.
5. Bulk-index the new emails into Elasticsearch (best-effort; failures are
   logged, never block the API response).

### 5.2 Worker (`src/queue/worker.ts`, run as its own process)
For each job, in order:
1. Load the email. If already `sent`/`failed`, no-op (idempotent — handles
   duplicate delivery of the same BullMQ job).
2. **Hourly limit check** (`rl:{senderId}:{YYYYMMDDHH}`, Lua `INCR`+compare,
   self-refunding if it overshoots) — see §5.3.
3. **Min-gap check** (`sender:{id}:nextSlot`, Lua compare-and-set) — enforces
   `MIN_DELAY_BETWEEN_EMAILS_MS` between two sends from the *same* sender.
4. **Atomic claim**: `UPDATE email SET status='sending' WHERE id=? AND status
   IN ('scheduled','rate_limited')`. Zero rows affected means another worker
   already has it — return. This one SQL statement is what makes concurrent
   workers safe.
5. Send via the sender's cached Nodemailer/Ethereal transport.
6. On success: `status=sent`, `messageId`, `previewUrl`, reindex in ES.
   On failure: increment `attempts`; BullMQ retries with exponential backoff
   up to `JOB_ATTEMPTS`; after the last attempt, mark `failed` instead of
   letting BullMQ's own retry counter diverge from the DB.

If step 2 or 3 can't proceed, the job calls `job.moveToDelayed(ts)` and throws
`DelayedError` — this is a **BullMQ delayed job re-schedule**, not a cron poll.

### 5.3 Rate limiting
- Two independent Lua scripts, each a single atomic Redis command — no
  check-then-act race between the check and the increment:
  - `hourlyIncr`: `INCR` the hour-bucket counter; if it now exceeds the limit,
    `DECR` it back (self-refunding) and report "not allowed". TTL of 2h.
  - `reserveSlot`: compare-and-set the sender's `nextSlot` timestamp.
- Effective limit = `min(campaign.hourlyLimit, sender.hourlyLimit ?? MAX_EMAILS_PER_HOUR_PER_SENDER)`.
- On overflow, `computeNextWindowSlot(seq, limit, delayBetweenMs)` schedules the
  email into the next hour at `nextHourStart + (seq % limit) * delayBetweenMs`
  — rescheduled emails keep their relative order and spread across the new
  window instead of all re-firing on the same second.
- If the hourly check passes but the min-gap check then fails, the hourly
  counter is refunded (`DECR`) so the slot isn't wasted — the job will consume
  a slot again on its next attempt.
- **Trade-off:** fixed hour windows (not a sliding ZSET window) mean a burst up
  to ~2× the limit can happen right at an hour boundary. Documented, accepted
  for simplicity; a sliding window would cost one Redis ZSET op per send.

### 5.4 Persistence and restart safety
- Redis: `appendonly yes`, `appendfsync everysec` — delayed jobs survive a
  Redis restart.
- Postgres is the single source of truth for status; Redis/BullMQ only holds
  *when* to run a job, never the only copy of *whether* it ran.
- **Boot reconciliation** (`queue/reconcile.ts`) runs once, when the worker
  process starts — never on a timer:
  1. Every email still `scheduled`/`rate_limited` gets re-`enqueue`d.
     `jobId = email.id` means BullMQ silently dedupes if the job already
     exists in Redis — safe to run on every boot, including normal restarts.
  2. Every email stuck in `sending` for more than `SENDING_STUCK_TIMEOUT_MIN`
     minutes (worker crashed mid-send) is resolved: if a `messageId` was
     already recorded, the send actually succeeded before the crash →
     mark `sent`. Otherwise → mark `failed`, error `"interrupted"`.
     This is an **at-most-once** choice (§9), not at-least-once.
- Graceful shutdown: `SIGTERM`/`SIGINT` → `worker.close()` (finishes in-flight
  jobs, stops pulling new ones) → disconnect Postgres/Redis → exit.

### 5.5 Concurrency and idempotency
- `WORKER_CONCURRENCY` (default 5) jobs run in parallel within one worker
  process; run multiple worker processes for more throughput.
- Every piece of shared state that concurrent workers touch is either:
  - a single atomic Redis Lua script (rate limit counters, min-gap slot), or
  - a single conditional SQL `UPDATE ... WHERE status IN (...)` (the claim).
- No in-process locks, no distributed lock service — atomicity comes from
  Redis/Postgres themselves.
- `idempotencyKey = sha256(campaignId + toEmail)`, unique in Postgres — a
  retried "schedule this campaign" request can't create the same lead twice
  in the same campaign (`skipDuplicates: true` on the bulk insert).

---

## 6. Chosen values

- Minimum gap between two sends from the same sender: **2000 ms** (`MIN_DELAY_BETWEEN_EMAILS_MS`)
- Default hourly cap per sender: **50/hour** (`MAX_EMAILS_PER_HOUR_PER_SENDER`), overridable per `Sender` row
- Global hourly ceiling (documented floor only, not actively enforced per-sender math): **200/hour** (`MAX_EMAILS_PER_HOUR`)
- BullMQ global limiter floor: `{ max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }` — a queue-wide backstop, not the primary pacing mechanism (that's the per-sender Lua slot)
- Retry attempts before a send is marked `failed`: **3** (`JOB_ATTEMPTS`), exponential backoff starting at 5s
- Stuck-`sending` timeout before boot reconciliation resolves it: **10 minutes**
- Number of Ethereal senders seeded: **4**

---

## 7. Features mapped to requirements

| Requirement | Implementation |
|---|---|
| No cron | BullMQ delayed jobs (`queue.addBulk` with `delay`), Redis's own timer wakes them. `reconcile.ts` runs once per boot, not on an interval. |
| Survives restarts | Postgres source of truth + Redis AOF + boot reconciliation (§5.4) |
| No duplicate sends | `jobId = email.id` (BullMQ dedup) + atomic `UPDATE ... WHERE status IN (...)` claim (§5.2 step 4) + unique `idempotencyKey` |
| Concurrency | `WORKER_CONCURRENCY` env, safe via Lua scripts + conditional SQL updates |
| Min delay between sends | Per-sender Redis Lua slot reservation (`queue/rateLimiter.ts::tryReserveSendSlot`) |
| Hourly rate limit | Redis Lua hourly counter with self-refund + next-window rescheduling |
| Slack alert on limit hit | Real Slack OAuth v2, deduped `SET NX EX 3600` per sender per hour |
| Search | Elasticsearch `emails` index, updated on create + every status change |
| Queue visibility | Bull Board at `/admin/queues`, behind `requireAuth` |
| Auth | Real Google OAuth (Passport), httpOnly JWT cookie, avatar/name/email in header, logout |
| Frontend | Next.js App Router dashboard: Scheduled/Sent tabs, Compose modal with CSV upload, live search, Slack connect button, Bull Board link |

---

## 8. Testing

```bash
# Frontend: pure unit tests, no infra needed
npm test --workspace frontend

# Backend: pure unit tests (Zod schemas, rate-limit math) — no infra needed
npx vitest run src/queue/rateLimiter.pure.test.ts src/modules/campaigns/campaigns.schema.test.ts --dir backend

# Backend: Redis-backed atomicity tests for the Lua scripts
docker compose up -d redis
npm test --workspace backend -- rateLimiter.redis.test.ts

# Backend: Postgres-backed idempotent-claim integration test
docker compose up -d postgres
npm run prisma:migrate --workspace backend
npm test --workspace backend -- emails.service.integration.test.ts

# Everything at once (requires all Docker services up + backend/.env configured)
npm test --workspace backend
```

What's covered:
- **`rateLimiter.pure.test.ts`** — hour-boundary math and `computeNextWindowSlot`
  (rescheduled jobs keep relative order, spread across the next window, wrap
  correctly once `seq` exceeds the limit). No Redis needed — pure functions.
- **`rateLimiter.redis.test.ts`** — the actual Lua scripts against real Redis:
  hourly counter blocks past the limit, refund frees a slot, **concurrent**
  increments never exceed the limit (the atomicity guarantee the whole
  no-duplicate-sends design depends on).
- **`campaigns.schema.test.ts`** — Zod validation: rejects empty/oversized
  lead lists, malformed emails, negative delays, non-positive limits; coerces
  numeric strings.
- **`emails.service.integration.test.ts`** — two concurrent
  `claimEmailForSending()` calls on the same row: only one wins (this is the
  literal mechanism behind "no duplicate sends" under concurrency); a `sent`
  email refuses to be re-claimed; a `rate_limited` email can be re-claimed.
- **`leadParser.test.ts`** (frontend) — the CSV/regex lead extractor: trims
  and lowercases, silently skips blanks, counts invalid vs. duplicate entries
  separately, matches the counts shown in the Compose modal.

**Manual/scripted tests** (see §1): restart test, 1000-email load test, Slack
rate-limit demo.

---

## 9. Assumptions, shortcuts, and trade-offs

- **At-most-once on a crash mid-send.** An email stuck in `sending` without a
  recorded `messageId` is marked `failed`, not silently resent. This favors
  "never duplicate" over "always deliver" — a deliberate choice given the
  requirement is specifically "no duplicate sends."
- **Fixed hour windows**, not a sliding window. Simpler and cheaper (one INCR
  vs. a ZSET per send); accepts a possible burst up to ~2× the limit right at
  an hour boundary.
- Campaign-level `hourlyLimit`/`delayBetweenMs` are always capped by the
  sender/env limits — the stricter value wins, campaigns can't override a
  sender's ceiling upward.
- Senders are a shared pool of 4 Ethereal test accounts, not provisioned per
  user — fine for a scheduling demo, would need real per-user SMTP/API sender
  config for production use.
- Slack notifications are deduped to exactly 1 per sender per hour, even if
  many emails from that sender hit the limit in the same window.
- Elasticsearch is a secondary index only; Postgres remains authoritative.
  `npm run reindex:es` rebuilds it from scratch if they drift apart.
- The worker is a separate process specifically so it can be scaled
  horizontally (`npm run dev:worker` multiple times) — all shared state lives
  in Redis/Postgres, never in worker memory.
- All scheduling times are computed and stored in UTC; clock skew between
  instances is a non-issue because only the server ever computes `scheduledAt`.
- Slack app requires HTTPS for its OAuth redirect — local dev needs a tunnel
  (ngrok/cloudflared); documented in §4 rather than worked around.
- **Ethereal's `createTestAccount()` can return the same account for every call
  from one IP** (observed directly: 3 calls, 3 seconds apart, identical
  account). `scripts/create-ethereal-senders.ts` detects this and still
  creates `SENDER_COUNT` distinct `Sender` rows so round-robin/rate-limiting
  has multiple senders to work with — but they then share one real Ethereal
  SMTP login. Under concurrent sends (`WORKER_CONCURRENCY > 1`), simultaneous
  logins to that single shared Ethereal account can occasionally trip
  `535 Authentication failed` (verified live: 2 of 21 test sends hit this).
  BullMQ's retry/backoff handles it — the send is retried and normally
  succeeds a few seconds later. If your network mints genuinely distinct
  Ethereal accounts, this doesn't come up at all. For the cleanest demo,
  either confirm your `Sender` rows have distinct `smtpUser` values after
  seeding, or set `WORKER_CONCURRENCY=1` temporarily.

