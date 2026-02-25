# 06 — Async Systems

Queues, Cron, Durable Objects, Webhooks — everything that runs outside the request cycle.

---

## Queues

Two queues, both consumed by the same Worker.

### `github-webhooks` Queue

**Producer:** `/webhooks/github` POST handler.  
**Consumer:** `apps/api/src/queue/index.ts` dispatcher.  
**Config:** batch_size=10, max_retries=3.

| Event Type | Handler | What It Does |
|------------|---------|-------------|
| `push` | `push-handler.ts` | Log commits to `commitLog`. Detect force-pushes → `forcePushEvents` + notify organizers |
| `tag` (create) | `tag-create-handler.ts` | Validate tag pattern. Lock submission in DO (exactly-once). Insert `submissions` record. Mark as current. Notify team + organizers |
| `tag` (delete) | `tag-delete-handler.ts` | Mark submission as `tag_deleted`. Notify organizers |
| `installation` | `installation-handler.ts` | Track GitHub App install/uninstall. Update `teamRepos.botActive` |

### `devsage-notifications` Queue

**Producer:** Various route handlers and queue handlers.  
**Consumer:** `apps/api/src/queue/notification-handler.ts`.  
**Config:** batch_size=10, max_retries=3.

Process:
1. Check idempotency key (skip if already processed)
2. Resolve recipients based on notification type
3. Send email (via SMTP service) if type requires it
4. Insert `inAppNotifications` record
5. Log delivery in `notificationDeliveries`

---

## Cron (`0 * * * *` — Hourly)

Three jobs run every hour via `apps/api/src/cron/index.ts`:

### 1. Submission Deadline Check
- Query all `active` hackathons where `submissionDeadline < now()`
- Auto-transition to `judging` via DO
- Update D1 status

### 2. Deadline Reminders
- Find hackathons with deadlines in 24h or 1h windows
- Send `deadline_reminder` notifications to all participants
- Uses notification queue (deduplicated via idempotency)

### 3. Audit Hash Backfill
- Process up to 100 audit events missing hash chains
- Compute SHA-256 hash chain integrity
- Runs incrementally each hour

---

## Durable Object: HackathonStateMachine

One DO instance per hackathon (keyed by hackathon UUID).

### Storage (SQLite-backed, 3 internal tables)

```sql
lifecycle_state:  hackathon_id, status, version, updated_at
submission_locks: delivery_id (PK, INSERT OR IGNORE for exactly-once)
team_submissions: team_id, count
```

### RPC Methods

| Method | Called By | What It Does |
|--------|----------|-------------|
| `initialize(hackathonId, status)` | Hackathon creation | Set initial state |
| `transition(targetStatus, version)` | State transition endpoint | Validate transition, update version, return new state |
| `lockSubmission(deliveryId)` | Tag-create queue handler | INSERT OR IGNORE → returns `{locked: true}` or `{locked: false}` |
| `getState()` | State check endpoint | Return current status + version |
| `incrementTeamSubmission(teamId)` | After submission | Bump team submission counter |

### Alarm

Set when hackathon transitions to `active` with a `submissionDeadline`:
- Fires at deadline time
- Auto-transitions `active → judging`
- Backup: cron also checks hourly

### Key Design Decisions
- **SQLite-backed** (`new_sqlite_classes` in wrangler.jsonc) — NOT KV-backed
- **Worker mediates D1** — DO never touches D1 directly
- **Optimistic locking** — version number prevents concurrent state changes
- **MUST re-export from `index.ts`** — or wrangler deploy fails

---

## GitHub Webhooks

### Incoming Flow

```
GitHub → POST /webhooks/github
  → HMAC-SHA256 signature verification (X-Hub-Signature-256)
  → Normalize payload (normalizeGitHubEvent)
  → Record in webhookDeliveries
  → Enqueue to github-webhooks queue
  → Return 200 {received: true}
```

### Webhook Events Handled

| GitHub Event | Action | Queue Handler |
|-------------|--------|---------------|
| `push` | — | `push-handler` (commit log, force-push detection) |
| `create` | tag | `tag-create-handler` (submission creation) |
| `delete` | tag | `tag-delete-handler` (submission invalidation) |
| `installation` | created/deleted | `installation-handler` (bot activation) |

### Webhook Security
- **HMAC-SHA256** verification using `GITHUB_WEBHOOK_SECRET`
- Delivery ID (`X-GitHub-Delivery`) used for idempotency
- Signature mismatch → 401 response, webhook rejected
- All deliveries logged in `webhookDeliveries` table

---

## Email (SMTP Service)

Custom SMTP client built for Cloudflare Workers (`apps/api/src/services/smtp.ts`).

### Connection
- Primary: Port 465 (direct TLS)
- Fallback: Port 587 (STARTTLS)
- Auth: PLAIN mechanism
- Timeout: 10 seconds (fail-open)

### Email Types
- Judge invitation (custom HTML template)
- Workspace invitation
- Password reset
- Email verification OTP
- Hackathon request status updates
- Results published notification
- Deadline reminders

### Fail-Open Pattern
- If SMTP fails → `console.warn`, continue
- Email failure never blocks the API response
- Delivery status tracked in `notificationDeliveries`

---

## GitHub API Client

`apps/api/src/services/github.ts`

### Methods
| Method | Purpose |
|--------|---------|
| `getInstallationToken(installationId)` | Get GitHub App installation token (⚠️ STUB — needs JWT signing) |
| `resolveTagSha(owner, repo, tag, token)` | Get commit SHA for a git tag |
| `postCommitStatus(owner, repo, sha, status, token)` | Post commit status check |

### Configuration
- 10-second timeout via AbortController
- Installation token cached in KV (50-min TTL)
- Fail-open: errors logged, never thrown

---

## Judging Service

`apps/api/src/services/judging.ts`

### Methods
| Method | Purpose |
|--------|---------|
| `assignJudges(hackathonId, roundId?)` | Round-robin assignment of submissions to judges. Respects track affinity and COI declarations |
| `computeLeaderboard(hackathonId, roundId?, trackId?)` | Two-level aggregation: per-judge weighted scores → cross-judge average. Returns ranked team list |

### Leaderboard Caching
- KV-cached with 30–60s TTL (configurable)
- Cache key: `leaderboard:{hackathonId}:{roundId}:{trackId}`
- Invalidated on score submission or results publish
