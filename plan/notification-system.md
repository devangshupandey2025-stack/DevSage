# Notification, Webhook & Queue System

> **Status:** Partially implemented — core pipeline works, several debt items outstanding  
> **Last updated:** 2026-02-15  
> **Packages touched:** `apps/api`, `packages/db`, `packages/shared`

---

## 1. Overview

DevSage uses three notification channels:

| Channel | Scope | Delivery | Storage |
|---------|-------|----------|---------|
| **In-app** | Per-user, per-hackathon | Immediate (queue consumer writes to D1) | `in_app_notifications` table |
| **Email** | Per-user | SMTP via Workers TCP sockets | `notification_deliveries` table |
| **Announcements** | Per-hackathon broadcast | Organizer-created, polled by frontend | `announcements` table |

GitHub webhooks drive automated events (push tracking, tag-based submissions, app installations). Two Cloudflare Queues connect the ingest layer to async processing.

### Key Files

| File | Role |
|------|------|
| `apps/api/src/routes/webhooks.ts` | GitHub webhook receiver (HMAC verify → normalize → enqueue) |
| `apps/api/src/routes/notifications.ts` | In-app notification REST API (list, unread count, mark read) |
| `apps/api/src/routes/announcements.ts` | Announcement CRUD (organizer broadcasts) |
| `apps/api/src/lib/webhook-normalize.ts` | GitHub payload → typed internal events |
| `apps/api/src/lib/queue-utils.ts` | `WebhookQueueMessage` and `NotificationQueueMessage` type definitions |
| `apps/api/src/queue/index.ts` | Queue consumer dispatcher |
| `apps/api/src/queue/notification-handler.ts` | Notification fan-out (in-app + email) |
| `apps/api/src/queue/notification-logic.ts` | Recipient resolution per notification type |
| `apps/api/src/queue/push-handler.ts` | Commit logging + force push detection |
| `apps/api/src/queue/tag-create-handler.ts` | Tag → submission (exactly-once via DO) |
| `apps/api/src/queue/tag-delete-handler.ts` | Tag deletion → submission status update |
| `apps/api/src/queue/installation-handler.ts` | GitHub App installation matching |
| `apps/api/src/services/email.ts` | SMTP email wrapper (fail-open) |
| `apps/api/src/services/smtp.ts` | Low-level SMTP client (Workers TCP sockets) |
| `apps/api/wrangler.jsonc` | Queue producer/consumer bindings |

---

## 2. Architecture

### 2.1 Queue System

Two **Cloudflare Queues** are configured in `apps/api/wrangler.jsonc` (lines 49–66):

| Queue Name | Binding | Purpose |
|------------|---------|---------|
| `github-webhooks` | `WEBHOOK_QUEUE` | GitHub webhook payloads (push, tag, installation) |
| `devsage-notifications` | `NOTIFICATION_QUEUE` | Internal notification dispatch (email + in-app) |

Both queues share the same configuration:

```jsonc
{
  "max_batch_size": 10,
  "max_retries": 3
}
```

The **same Worker** (`apps/api`) acts as both producer and consumer. The entrypoint (`src/index.ts`) exports a `queue` handler that delegates to `queueHandler()` in `src/queue/index.ts`.

### 2.2 Dispatcher Pattern

`queue/index.ts` implements a single dispatcher that routes messages by queue name:

```
batch.queue === 'github-webhooks'      → dispatchWebhookMessage()
batch.queue === 'devsage-notifications' → handleNotificationMessage()
```

Within `dispatchWebhookMessage()`, messages are further routed by `type` field:

```
github_push                       → handlePushEvent()
github_tag_created                → handleTagCreateEvent()
github_tag_deleted                → handleTagDeleteEvent()
github_installation               → handleInstallationEvent()
github_installation_repos_added   → handleInstallationEvent()
github_installation_repos_removed → handleInstallationEvent()
```

Each message is individually ack'd on success or retried on error (`message.ack()` / `message.retry()`).

### 2.3 Webhook Pipeline (End-to-End)

```
GitHub  ──POST /webhooks/github──►  Webhook Route
                                       │
                               1. Validate headers (X-Hub-Signature-256, X-GitHub-Event, X-GitHub-Delivery)
                               2. HMAC SHA-256 verification (constant-time double-HMAC)
                               3. Parse JSON body
                               4. normalizeGitHubEvent() → typed NormalizedEvent | null
                               5. If null → record as 'ignored', return 200
                               6. Build WebhookQueueMessage { type: `github_${event}`, payload, received_at, delivery_id }
                               7. WEBHOOK_QUEUE.send(message)
                               8. waitUntil(recordDelivery(..., 'queued'))
                               9. Return { received: true, action: 'queued' }
                                       │
                                       ▼
                              Cloudflare Queue (github-webhooks)
                                       │
                                       ▼
                              queueHandler() → dispatchWebhookMessage()
                                       │
                            ┌──────────┼───────────┬──────────────────┐
                            ▼          ▼           ▼                  ▼
                       Push Handler  Tag Create  Tag Delete    Installation
                       (commits,    (submission   (mark         (bot activate/
                        force push)  creation)    tag_deleted)   deactivate)
```

### 2.4 Notification Pipeline (End-to-End)

```
Any mutation handler ──NOTIFICATION_QUEUE.send({type, hackathon_id, data})──►  Queue
                                                                                │
                                                                                ▼
                                                              handleNotificationMessage()
                                                                    │
                                                         1. Idempotency check (notification_idempotency table)
                                                         2. resolveNotificationRecipients(db, type, hackathon_id, data)
                                                         3. generateNotificationContent(db, type, hackathon_id, data, env)
                                                         4. For each recipient:
                                                            a. INSERT into in_app_notifications
                                                            b. sendEmail() → INSERT into notification_deliveries
                                                         5. If ALL emails succeeded → INSERT idempotency record
                                                                    │
                                                         (On retry, idempotency prevents re-processing)
```

---

## 3. GitHub Webhooks

### 3.1 Webhook Receiver

**Route:** `POST /webhooks/github` (`apps/api/src/routes/webhooks.ts`)

**Required headers:**
- `X-Hub-Signature-256` — HMAC SHA-256 signature
- `X-GitHub-Event` — Event type (e.g., `push`, `create`, `delete`, `installation`)
- `X-GitHub-Delivery` — Unique delivery ID

**HMAC Verification** (lines 55–98): Uses a **double-HMAC comparison** technique because Cloudflare Workers lack `timingSafeEqual`. The approach:
1. Compute expected HMAC of the body using `GITHUB_WEBHOOK_SECRET`
2. Generate a random comparison key
3. HMAC both the expected and received signatures with the random key
4. XOR-compare the two HMACs byte-by-byte

This ensures any timing leak reveals information about the random key, not the actual secret.

**Delivery recording** (lines 100–113): Every webhook is logged to `webhook_deliveries` via `waitUntil()` (non-blocking) with status `queued` or `ignored`.

> ⚠️ **Debt (API-031):** Webhook route returns `{ received, action }` instead of the standard `{ ok, data }` envelope.
> ⚠️ **Debt (API-016):** Webhook route sits under CORS middleware unnecessarily.

### 3.2 Events Handled

| GitHub Event | `ref_type` | Normalized Type | Handler |
|--------------|-----------|-----------------|---------|
| `push` | — | `github_push` | `push-handler.ts` |
| `create` | `tag` | `github_tag_created` | `tag-create-handler.ts` |
| `delete` | `tag` | `github_tag_deleted` | `tag-delete-handler.ts` |
| `installation` | — | `github_installation` | `installation-handler.ts` |
| `installation_repositories` | — | `github_installation_repos_added` / `github_installation_repos_removed` | `installation-handler.ts` |

Non-tag `create`/`delete` events (branches) and all other event types return `null` from the normalizer and are recorded as `ignored`.

### 3.3 Payload Normalization

**File:** `apps/api/src/lib/webhook-normalize.ts`

The normalizer converts raw GitHub payloads into a typed union:

```typescript
export type NormalizedEvent =
  | { type: 'push'; data: PushEvent }
  | { type: 'tag_created'; data: TagEvent }
  | { type: 'tag_deleted'; data: TagEvent }
  | { type: 'installation'; data: InstallationEvent }
  | { type: 'installation_repos_added'; data: InstallationReposEvent }
  | { type: 'installation_repos_removed'; data: InstallationReposEvent };
```

**Key interfaces:**

- **`PushEvent`**: `ref`, `before`, `after`, `forced`, `pusher` (login, email), `commits[]` (sha, message, author, timestamp), `repository` (owner, name, full_name)
- **`TagEvent`**: `ref`, `tag_name`, `sha`, `action`, `sender`, `repository`
- **`InstallationEvent`**: `action`, `installation_id`, `sender`, `repositories[]`
- **`InstallationReposEvent`**: `installation_id`, `sender`, `repositories[]`

**Note:** Tag create events from GitHub do NOT include the SHA. The `sha` field is set to `''` and resolved later via the GitHub API in `tag-create-handler.ts`.

> ⚠️ **Debt (API-044):** All normalizer functions use unsafe `as` casts on the raw payload with no runtime Zod validation.

### 3.4 Commit Tracking (Push Handler)

**File:** `apps/api/src/queue/push-handler.ts`

1. Looks up `team_repos` by `github_owner` + `github_repo`
2. Inserts commits into `commit_log` (chunked by 10 to respect D1's 100-parameter limit)
3. Detects force pushes (`forced === true`):
   - Inserts into `force_push_events`
   - Sends `force_push_detected` notification to `NOTIFICATION_QUEUE`
   - Records audit event (`webhook.force_push`)

**Columns inserted into `commit_log`:** `id`, `team_repo_id`, `commit_sha`, `message` (truncated to 500 chars), `author_login`, `author_email`, `committed_at`, `pushed_at`

> ⚠️ **Debt (API-034, HIGH):** The push handler queries `team_repos` using `github_owner` and `github_repo` columns. If these columns don't exist in the actual D1 schema (the debt item states they are nonexistent columns), the entire webhook pipeline for push events is broken at runtime.

### 3.5 Tag-Based Submissions (Tag Create Handler)

**File:** `apps/api/src/queue/tag-create-handler.ts`

This is the **critical path** for hackathon submissions. Flow:

1. Find `team_repos` by `github_owner` + `github_repo`
2. Join `teams` → `hackathons` to get hackathon info and settings
3. Validate hackathon is in `active` status
4. Check tag matches the configured `tag_pattern` (via `matchesTagPattern()`)
5. Resolve tag SHA — if not in payload, fetch from GitHub API using cached installation token from KV
6. **Exactly-once submission** — call `HackathonStateMachine` Durable Object:
   - `POST http://do/accept-submission` with `{ submission_key, submission_id, team_id }`
   - DO returns `{ ok, data: { accepted, reason? } }`
   - If not accepted → return (duplicate or rejected)
7. Mark all previous submissions for this team as `is_final = 0` (resubmission logic)
8. Insert new submission with `is_final = 1`, `status = 'received'`
9. Detect late submissions by comparing current time to `settings.submission_deadline`
10. Record audit event (`submission.created`)
11. Send `submission.received` notification

### 3.6 Tag Deletion Handler

**File:** `apps/api/src/queue/tag-delete-handler.ts`

1. Find submission by `tag_name` + `github_owner` + `github_repo` (via join on `submissions` → `teams` → `team_repos`)
2. Set `status = 'tag_deleted'` and `is_final = 0`
3. Record audit event (`submission.tag_deleted`)
4. Send `submission.tag_deleted` notification

### 3.7 Installation Handler

**File:** `apps/api/src/queue/installation-handler.ts`

Handles GitHub App installation lifecycle:

**Installation / Repos Added:**
1. For each repo in the payload, check `pending_installations` joined with `team_repos`
2. If matched: update `team_repos` with `installation_id` and `bot_active = 1`
3. Delete the `pending_installations` record
4. Record audit event (`team.bot_activated`)

**Repos Removed:**
1. For each removed repo, set `bot_active = 0` and `installation_id = NULL` on matching `team_repos`

---

## 4. Notifications

### 4.1 Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| `judge.invited` | Judge invite created | The invited judge |
| `submission.received` | Tag-based submission accepted | Team members + organizers |
| `submission.validated` | Submission passes validation | Team members + organizers |
| `submission.tag_deleted` | Submission tag deleted from repo | Team members + organizers |
| `force_push_detected` | Force push to tracked repo | Organizers only |
| `hackathon.judging_started` | Hackathon transitions to judging | All participants + judges + organizers |
| `results.published` | Hackathon results are published | All participants + judges + organizers |
| `team_joined` | New member joins a team | All team members |
| `deadline_reminder` | Cron-triggered approaching deadline | Team members in ready teams |
| `hackathon.request.submitted` | New hackathon creation request | Platform admins |
| `hackathon.request.under_review` | Request status → under_review | Requesting organizer |
| `hackathon.request.approved` | Request approved | Requesting organizer + workspace members |
| `hackathon.request.rejected` | Request rejected | Requesting organizer |
| `hackathon.request.changes_requested` | Changes requested on request | Requesting organizer |
| `hackathon.request.building` | Hackathon infrastructure building | Requesting organizer |
| `hackathon.request.ready` | Hackathon ready for configuration | Requesting organizer + workspace members |

**Default fallback:** Unknown types are sent to hackathon organizers. The title is auto-generated from the type string (dots/underscores replaced, title-cased).

### 4.2 Recipient Resolution

**File:** `apps/api/src/queue/notification-logic.ts`

The `resolveNotificationRecipients()` function takes `(db, type, hackathonId, data)` and returns `Recipient[]` (each with `user_id` and `email`).

**Resolution logic by type:**

| Type | Query Strategy |
|------|----------------|
| `judge.invited` | Look up user by `data.user_id` |
| `submission.*` | Team members via `data.team_id` + hackathon organizers (union, deduped) |
| `force_push_detected` | Organizers only (`organizer_roles` table) |
| `hackathon.judging_started` / `results.published` | `UNION` of `organizer_roles` + `judges` + `team_members` — **unbounded query** |
| `team_joined` | Team members by `data.team_id` |
| `deadline_reminder` | Team members where `teams.ready = 1` |
| `hackathon.request.submitted` | All `platform_admins` |
| `hackathon.request.under_review` / `.building` | User by `data.requested_by` |
| `hackathon.request.approved` / `.ready` | User by `data.requested_by` + `workspace_members` |
| `hackathon.request.rejected` / `.changes_requested` | User by `data.requested_by` |
| Default | Organizers |

**Helper functions:**
- `getOrganizers(db, hackathonId)` — queries `organizer_roles` joined with `users`
- `dedup(recipients)` — removes duplicates by `user_id`

> ⚠️ **Debt (API-040):** The `hackathon.judging_started` / `results.published` case fetches ALL participants in a single unbounded query with no pagination. For large hackathons this could hit D1 row limits or cause timeouts.

### 4.3 In-App Notifications

**Route file:** `apps/api/src/routes/notifications.ts`

All endpoints require authentication (`authMiddleware`).

| Method | Path | Description |
|--------|------|-------------|
| `GET /` | `/api/v1/notifications` | List notifications (paginated, filterable by `hackathon_id`) |
| `GET /unread-count` | `/api/v1/notifications/unread-count` | Count of unread notifications |
| `PATCH /:notificationId/read` | `/api/v1/notifications/:id/read` | Mark one notification as read |
| `PATCH /read-all` | `/api/v1/notifications/read-all` | Mark all notifications as read |

**Pagination:** Offset-based with `limit` (max 100, default 20) and `offset` (default 0). Returns via `paginatedResponse()`.

**Read tracking:** Uses `read_at` timestamp — `NULL` means unread, set to ISO-8601 timestamp on read.

### 4.4 Email Notifications

**File:** `apps/api/src/services/email.ts`

**Pattern:** Fail-open — returns `boolean`, never throws.

**SMTP Configuration (from environment bindings):**
- `SMTP_URL` — e.g., `smtps://smtp.example.com:465` or `smtp://smtp.example.com:587`
- `SMTP_USERNAME` — SMTP auth username
- `SMTP_PASSWORD` — SMTP auth password
- `SMTP_EMAIL_ADDR` — From address (fallback: `EMAIL_FROM`)

**Port fallback strategy:**
1. Try configured port from `SMTP_URL`
2. If fails, try alternate port (`587 ↔ 465`)
3. If both fail, return `false`

**SMTP Client** (`apps/api/src/services/smtp.ts`):
- Uses Cloudflare Workers TCP sockets (`cloudflare:sockets`)
- `SmtpConnection` class handles line-oriented SMTP protocol (CRLF-terminated)
- Supports **direct TLS** (port 465) and **STARTTLS** (port 587)
- AUTH PLAIN authentication
- RFC 5321 dot-stuffing for message bodies
- RFC 2822 message construction (From, To, Subject, Date, Message-ID, MIME)
- 15-second timeout per connection

**Email Template System:**
- Dark-themed HTML emails matching DevSage branding
- Accent color: `#CCFF00` (lime green) on black background
- `wrapEmailTemplate(preheader, innerHtml)` — shared wrapper with logo + card + footer
- `simpleContent(title, body, link)` — generates both in-app and email content
- `buildJudgeInviteEmail(hackathonName, inviteLink)` — specialized judge invite template with CTA button + fallback link
- From address: `DevSage <{from}>`

### 4.5 Notification Preferences

**Table:** `hackathon_notification_config`

Per-user, per-hackathon preferences for notification channels:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `email_enabled` | integer (0/1) | 1 | Whether to send email notifications |
| `in_app_enabled` | integer (0/1) | 1 | Whether to create in-app notifications |

> **Note:** These preferences exist in the schema but are **NOT currently checked** by `notification-handler.ts`. All recipients receive both in-app and email notifications regardless of their preferences. This is a missing feature.

### 4.6 Idempotency

**Table:** `notification_idempotency`

The notification handler prevents duplicate processing using an idempotency key composed of `${type}:${hackathon_id}:${JSON.stringify(data)}`.

**Flow:**
1. Before processing: check if key exists in `notification_idempotency`
2. If exists → skip (already processed)
3. Process notification (fan-out to all recipients)
4. After processing: insert idempotency record **only if ALL emails succeeded**
5. If any email failed → no idempotency record → message will be retried by the queue

This means a partial failure (e.g., 3 of 5 emails sent) will cause the **entire notification to be retried**, potentially creating duplicate in-app notifications for recipients who were already processed.

---

## 5. Announcements

**Route file:** `apps/api/src/routes/announcements.ts`

Announcements are organizer-broadcast messages within a hackathon. They are **not** queue-driven — they are standard CRUD operations.

| Method | Path | Auth | Role Required |
|--------|------|------|---------------|
| `GET /` | `/api/v1/hackathons/:slug/announcements` | None (public) | — |
| `POST /` | `/api/v1/hackathons/:slug/announcements` | Required | `co_organizer` or higher |
| `PATCH /:id` | `/api/v1/hackathons/:slug/announcements/:id` | Required | `co_organizer` or higher |
| `DELETE /:id` | `/api/v1/hackathons/:slug/announcements/:id` | Required | `co_organizer` or higher |

**Features:**
- Pinned announcements sort first (`ORDER BY pinned DESC, created_at DESC`)
- Author name and avatar included via `LEFT JOIN users`
- No pagination (returns all announcements for a hackathon)

> ⚠️ **Debt (API-035):** Creating an announcement does NOT dispatch a notification to hackathon participants. Announcements are only visible when participants poll the announcements endpoint.

---

## 6. Data Model

### 6.1 `in_app_notifications`

**Schema:** `packages/db/src/schema/in-app-notifications.ts`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `user_id` | text (FK → users) | No | Recipient user |
| `hackathon_id` | text (FK → hackathons) | Yes | Associated hackathon (null for platform-level) |
| `type` | text | No | Notification type (e.g., `submission.received`) |
| `title` | text | No | Display title |
| `body` | text | Yes | Display body |
| `link` | text | Yes | Action URL |
| `read_at` | text | Yes | ISO-8601 timestamp when read (null = unread) |
| `created_at` | text | No | ISO-8601 timestamp (default: `strftime`) |

**Indexes:**
- `idx_notifications_user_read` — composite on `(user_id, read_at)` for unread count queries
- `idx_notifications_hackathon` — on `hackathon_id`

### 6.2 `notification_deliveries`

**Schema:** `packages/db/src/schema/notification-deliveries.ts`

Tracks email delivery attempts per notification.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `notification_type` | text | No | Type of notification |
| `channel` | text | No | Delivery channel (currently always `'email'`) |
| `recipient_id` | text (FK → users) | Yes | Recipient user ID |
| `recipient_email` | text | Yes | Recipient email address |
| `status` | text | No | `'sent'` or `'failed'` (default: `'sent'`) |
| `error_message` | text | Yes | Error details if failed |
| `created_at` | text | No | ISO-8601 timestamp |

**Indexes:**
- `idx_notification_deliveries_recipient` — on `recipient_id`
- `idx_notification_deliveries_status` — on `status`

> **Note:** The handler inserts with columns `(id, event_id, user_id, channel, notification_type, status, created_at)` but the Drizzle schema defines columns `(id, notification_type, channel, recipient_id, recipient_email, status, error_message, created_at)`. The `event_id` column written by the handler does not exist in the schema — this mismatch may cause runtime errors on the `notification_deliveries` INSERT.

### 6.3 `hackathon_notification_config`

**Schema:** `packages/db/src/schema/hackathon-notification-config.ts`

Per-user notification preferences for a hackathon.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `hackathon_id` | text (FK → hackathons) | No | Hackathon scope |
| `user_id` | text (FK → users) | No | User |
| `email_enabled` | integer (0/1) | No | Email notifications on/off (default: 1) |
| `in_app_enabled` | integer (0/1) | No | In-app notifications on/off (default: 1) |
| `created_at` | text | No | ISO-8601 timestamp |

**Unique index:** `uq_hackathon_notification_config_hackathon_user` on `(hackathon_id, user_id)`

### 6.4 `notification_idempotency`

**Schema:** `packages/db/src/schema/notification-idempotency.ts`

Prevents duplicate notification processing.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `idempotency_key` | text (unique) | No | Composite key: `${type}:${hackathon_id}:${JSON.stringify(data)}` |
| `created_at` | text | No | ISO-8601 timestamp |

### 6.5 `webhook_deliveries`

**Schema:** `packages/db/src/schema/webhook-deliveries.ts`

Records every GitHub webhook delivery for observability.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `github_delivery_id` | text (unique) | No | GitHub's `X-GitHub-Delivery` header |
| `event_type` | text | No | GitHub event type (e.g., `push`, `create`) |
| `status` | text | No | `'queued'` or `'ignored'` (default: `'queued'`) |
| `error_message` | text | Yes | Error details |
| `received_at` | text | No | ISO-8601 timestamp |
| `processed_at` | text | Yes | ISO-8601 timestamp when processing completed |

**Indexes:**
- `idx_webhook_deliveries_event` — on `event_type`
- `idx_webhook_deliveries_status` — on `status`

> **Note:** The webhook route inserts with column name `delivery_id` but the Drizzle schema defines it as `github_delivery_id`. The raw SQL in the route uses `delivery_id` directly, so this works at the SQL level if the D1 migration used `delivery_id` as the column name. Check the actual migration SQL.

### 6.6 `announcements`

**Schema:** `packages/db/src/schema/announcements.ts`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | text (PK) | No | UUID |
| `hackathon_id` | text (FK → hackathons) | Yes | Hackathon scope |
| `author_id` | text (FK → users) | Yes | Creating organizer |
| `title` | text | No | Announcement title |
| `content` | text | No | Announcement body |
| `pinned` | integer (0/1) | No | Whether pinned to top (default: 0) |
| `created_at` | text | No | ISO-8601 timestamp |
| `updated_at` | text | No | ISO-8601 timestamp |

**Index:** `idx_announcements_hackathon` on `hackathon_id`

### 6.7 Shared Zod Schema

**File:** `packages/shared/src/schemas/in-app-notification.ts`

```typescript
export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  read_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
```

> ⚠️ **Debt (PKG-021):** No Zod schema for webhook deliveries.  
> ⚠️ **Debt (PKG-023):** No Zod schema for notification config.

---

## 7. Queue Processing Details

### 7.1 Message Types

**`WebhookQueueMessage`** (`apps/api/src/lib/queue-utils.ts`):

```typescript
interface WebhookQueueMessage {
  type: 'github_push' | 'github_tag_created' | 'github_tag_deleted'
      | 'github_installation' | 'github_installation_repos_added'
      | 'github_installation_repos_removed';
  payload: unknown;
  hackathon_id?: string;
  received_at: string;
  delivery_id?: string;
}
```

**`NotificationQueueMessage`** (`apps/api/src/lib/queue-utils.ts`):

```typescript
interface NotificationQueueMessage {
  type: string;
  hackathon_id: string;
  actor_id?: string;
  data?: Record<string, unknown>;
}
```

### 7.2 Error Handling

The queue dispatcher wraps each message in a try/catch:
- **Success** → `message.ack()` — message removed from queue
- **Error** → `console.error()` + `message.retry()` — message re-enqueued

Cloudflare Queues will retry up to `max_retries: 3` times.

### 7.3 Retry Behavior

- **No exponential backoff** — Cloudflare Queues handle retry timing internally
- **No dead letter queue (DLQ)** — after 3 retries, messages are silently dropped
- **Notification idempotency** — prevents duplicate processing for notifications that fully succeeded
- **Partial failure risk** — if email fails for one recipient, the entire notification is retried, potentially creating duplicate in-app notifications

### 7.4 Environment Bindings

The `QueueEnv` interface in `queue/index.ts` declares all bindings needed by queue handlers:

| Binding | Type | Used By |
|---------|------|---------|
| `DB` | `D1Database` | All handlers |
| `KV` | `KVNamespace` | Tag create (installation token cache) |
| `HACKATHON_SM` | `DurableObjectNamespace` | Tag create (exactly-once submission) |
| `WEBHOOK_QUEUE` | `Queue` | Not used by consumer (only producer) |
| `NOTIFICATION_QUEUE` | `Queue` | Push, tag, installation handlers (produce notifications) |
| `SMTP_URL` | `string` | Notification handler (email) |
| `SMTP_USERNAME` | `string` | Notification handler (email) |
| `SMTP_PASSWORD` | `string` | Notification handler (email) |
| `SMTP_EMAIL_ADDR` | `string?` | Notification handler (email from address) |
| `EMAIL_FROM` | `string` | Notification handler (email fallback from) |
| `FRONTEND_URL` | `string` | Notification handler (link generation) |
| `PLATFORM_URL` | `string` | Notification handler (link generation) |
| `JUDGE_URL` | `string` | Notification handler (judge invite links) |

> ⚠️ **Debt (API-046):** Queue message bodies are cast with `as` — no runtime validation. A malformed message will cause an unhandled error and retry.

---

## 8. Email Service

### 8.1 Architecture

```
notification-handler.ts
        │
        ▼
   sendEmail(env, { to, subject, html })     ← apps/api/src/services/email.ts
        │
        ▼
   sendSmtp(config, from, to, subject, html) ← apps/api/src/services/smtp.ts
        │
        ▼
   Cloudflare Workers TCP socket (cloudflare:sockets)
        │
        ▼
   SMTP Server (port 465 direct TLS or port 587 STARTTLS)
```

### 8.2 SMTP Configuration

| Secret | Description |
|--------|-------------|
| `SMTP_URL` | SMTP server URL (`smtps://host:465` or `smtp://host:587`) |
| `SMTP_USERNAME` | Auth username |
| `SMTP_PASSWORD` | Auth password |
| `SMTP_EMAIL_ADDR` | From address override |
| `EMAIL_FROM` | Default from address (from `wrangler.jsonc` vars) |

### 8.3 SMTP Protocol Flow

1. **Connect** — TCP socket with direct TLS (465) or plaintext (587)
2. **Greeting** — Read `220` response
3. **EHLO** — Identify as `devsage.org`
4. **STARTTLS** (587 only) — Upgrade to TLS, re-EHLO
5. **AUTH PLAIN** — Base64-encoded `\0username\0password`
6. **MAIL FROM** — Envelope sender
7. **RCPT TO** — For each recipient
8. **DATA** — RFC 2822 message with dot-stuffing
9. **QUIT** — Best-effort

**Timeout:** 15 seconds (`TIMEOUT_MS`). Socket is force-closed after timeout.

### 8.4 Email Template Structure

```html
<!DOCTYPE html>
<html>
  <body style="background:#000">
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
      <!-- Logo: "DevSage" in #CCFF00 -->
      <!-- Card: #111 background, #222 border, 16px border-radius -->
        <!-- Content varies by notification type -->
        <!-- CTA buttons: #CCFF00 background, #000 text -->
      <!-- Footer: "DevSage — The edge-native hackathon platform" -->
    </div>
  </body>
</html>
```

### 8.5 Delivery Tracking

Each email attempt is recorded in `notification_deliveries` with:
- `channel`: always `'email'`
- `status`: `'sent'` or `'failed'`
- The `event_id` links back to the `in_app_notifications.id` for the same event

---

## 9. Known Issues & Future Plans

### 9.1 Critical Issues

| Debt ID | Severity | Issue | Location |
|---------|----------|-------|----------|
| **API-034** | 🔴 HIGH | Push handler queries `github_owner`/`github_repo` columns that may not exist in the actual D1 schema, breaking the entire push webhook pipeline | `push-handler.ts:18` |
| **PKG-038** | 🔴 HIGH | `hackathon_notification_config` unique index may be incorrectly defined (single column vs composite) in the migration | `packages/db/migrations/` |

### 9.2 Medium Issues

| Debt ID | Severity | Issue | Location |
|---------|----------|-------|----------|
| **API-040** | 🟡 MEDIUM | Unbounded query fetches ALL participants for `judging_started`/`results.published` notifications | `notification-logic.ts:51-59` |
| **API-035** | 🟡 MEDIUM | No notification dispatch when announcements are created | `announcements.ts:30` |
| **API-044** | 🟡 MEDIUM | Unsafe `as` casts on webhook payloads — no runtime Zod validation | `webhook-normalize.ts` |
| **API-046** | 🟡 MEDIUM | Queue message bodies cast with `as` — no runtime validation | `queue/index.ts:32,56` |
| **FE-035** | 🟡 MEDIUM | TopBar notification logic duplicated (~150 lines each) in Platform + Judge apps | Frontend apps |
| **FE-051** | 🟡 MEDIUM | TopBar notifications use raw `useEffect` instead of TanStack Query | Frontend apps |

### 9.3 Low Priority Issues

| Debt ID | Severity | Issue | Location |
|---------|----------|-------|----------|
| **API-016** | 🟢 LOW | Webhook route under CORS middleware unnecessarily | `webhooks.ts:65` |
| **API-031** | 🟢 LOW | Webhook route bypasses `{ ok, data }` response envelope | `webhooks.ts:32,48` |
| **PKG-021** | 🟢 LOW | No Zod schema for webhook deliveries | `packages/shared` |
| **PKG-023** | 🟢 LOW | No Zod schema for notification config | `packages/shared` |
| **FE-050** | 🟢 LOW | `notificationQueries.all()` uses `unknown[]` type | Frontend apps |

### 9.4 Plan Gaps

| Gap ID | Issue |
|--------|-------|
| **GAP-007** | No notification sent to eliminated teams — notification type missing, no automatic team status change to read-only |

### 9.5 Schema Mismatches

1. **`notification_deliveries` INSERT mismatch** — The handler inserts `(id, event_id, user_id, channel, notification_type, status, created_at)` but the Drizzle schema defines `(id, notification_type, channel, recipient_id, recipient_email, status, error_message, created_at)`. Column names `event_id`/`user_id` vs `recipient_id`/`recipient_email` don't match.
2. **Notification preferences not enforced** — `hackathon_notification_config.email_enabled` and `in_app_enabled` exist in the schema but are never checked during notification delivery.

### 9.6 Missing Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Dead Letter Queue (DLQ) | ❌ Not implemented | Failed messages after 3 retries are silently dropped |
| Retry with backoff | ❌ Not implemented | Relies on Cloudflare Queue's built-in retry timing |
| Notification preferences enforcement | ❌ Not implemented | Schema exists but handler ignores it |
| Announcement → notification dispatch | ❌ Not implemented | Announcements don't trigger notifications |
| Eliminated team notifications | ❌ Not implemented | Missing notification type and recipient logic |
| Per-type email unsubscribe | ❌ Not implemented | No unsubscribe mechanism |
| Webhook payload validation | ❌ Not implemented | All payloads use unsafe `as` casts |
| Idempotent in-app notifications | ❌ Partial | In-app notifications can be duplicated on retry if email fails for any recipient |
| `processed_at` on webhook deliveries | ❌ Not implemented | Column exists but is never updated after queue processing |
| Email delivery error details | ❌ Not captured | `error_message` column exists on `notification_deliveries` but is never populated |
