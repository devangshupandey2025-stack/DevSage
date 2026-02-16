# Audit Trail

Source: `apps/api/src/lib/audit.ts`

The audit system provides tamper-evident logging of all mutations via a SHA-256 hash chain. Every state-changing operation in the API records an audit event.

---

## Event Structure

Each audit event is stored in the `audit_events` table with the following fields:

| Field              | Type                                   | Description                                        |
|--------------------|----------------------------------------|----------------------------------------------------|
| `id`               | string (UUID)                          | Unique event identifier                            |
| `sequence`         | number                                 | Global monotonically increasing sequence number    |
| `hackathon_id`     | string \| null                         | Scoped hackathon, or `null` for global events      |
| `actor_id`         | string \| null                         | UUID of the acting user, or `null` for system/cron |
| `actor_type`       | `"user"` \| `"system"` \| `"bot"` \| `"cron"` | Type of actor that triggered the event      |
| `actor_ip`         | string \| null                         | IP address of the actor (optional)                 |
| `actor_user_agent` | string \| null                         | User-Agent header (optional)                       |
| `action`           | string                                 | Action identifier (e.g., `organizer.added`)        |
| `entity_type`      | string                                 | Type of entity affected (e.g., `team`, `judge`)    |
| `entity_id`        | string                                 | UUID of the affected entity                        |
| `details`          | JSON object                            | Additional context (defaults to `{}`)              |
| `changes`          | JSON object \| null                    | Before/after diff for updates                      |
| `hash`             | string                                 | SHA-256 hash for chain integrity                   |
| `prev_hash`        | string \| null                         | Hash of the previous event in the chain            |
| `created_at`       | string (ISO-8601)                      | UTC timestamp of the event                         |

---

## Hash Chain Integrity

Every audit event includes a SHA-256 hash that chains to the previous event, creating a tamper-evident log. If any event is modified or deleted, the chain breaks and can be detected.

### Hash Computation

```
hash = SHA-256( "{id}:{prev_hash}:{hackathon_id}" )
```

- **Input format:** `{event_id}:{previous_hash_or_"genesis"}:{hackathon_id_or_"global"}`
- **First event in a chain:** uses `"genesis"` as the previous hash value
- **Global events** (no hackathon): uses `"global"` as the hackathon identifier
- **Output:** lowercase hex-encoded SHA-256 digest (64 characters)

### Chain Scoping

Hash chains are scoped **per hackathon**. Each hackathon maintains its own independent chain. Global events (where `hackathon_id` is `null`) form a separate global chain. This means:

- The `prev_hash` for a new event is the `hash` of the most recent event with the **same `hackathon_id`** (or `null` for global events).
- Chains can be verified independently per hackathon.

### Example Chain

```
Event 1 (genesis):
  id:        "aaa-111"
  prev_hash: null
  hash:      SHA-256("aaa-111:genesis:h-001") → "3f2a..."

Event 2:
  id:        "bbb-222"
  prev_hash: "3f2a..."
  hash:      SHA-256("bbb-222:3f2a...:h-001") → "7c8d..."

Event 3:
  id:        "ccc-333"
  prev_hash: "7c8d..."
  hash:      SHA-256("ccc-333:7c8d...:h-001") → "a1b2..."
```

---

## `insertAuditEvent(db, input)`

Records a new audit event with hash chain computation.

### Input Parameters

| Field              | Type                                   | Required | Description                         |
|--------------------|----------------------------------------|----------|-------------------------------------|
| `hackathon_id`     | string \| null                         | No       | Hackathon scope (null = global)     |
| `actor_id`         | string \| null                         | No       | Acting user UUID                    |
| `actor_type`       | `"user"` \| `"system"` \| `"bot"` \| `"cron"` | Yes | Actor type                    |
| `actor_ip`         | string \| null                         | No       | Actor IP address                    |
| `actor_user_agent` | string \| null                         | No       | Actor User-Agent                    |
| `action`           | string                                 | Yes      | Action identifier                   |
| `entity_type`      | string                                 | Yes      | Affected entity type                |
| `entity_id`        | string                                 | Yes      | Affected entity UUID                |
| `details`          | Record\<string, unknown\> \| null      | No       | Additional context (defaults to {}) |
| `changes`          | Record\<string, unknown\> \| null      | No       | Before/after diff                   |

### Return Value

Returns the UUID of the newly created audit event.

### Behavior

1. Generates a new UUID and timestamp.
2. Retrieves the next global sequence number (`MAX(sequence) + 1`).
3. Looks up the most recent `hash` for events with the same `hackathon_id` to get `prev_hash`.
4. Computes `SHA-256("{id}:{prev_hash_or_genesis}:{hackathon_id_or_global}")`.
5. Inserts the complete event record.

---

## `backfillAuditHashes(db, limit?)`

Retroactively computes and stores hashes for audit events that have `hash IS NULL`. Used to repair chains after bulk imports or migration issues.

### Parameters

| Param   | Type   | Default | Description                            |
|---------|--------|---------|----------------------------------------|
| `db`    | D1Database | —   | Database binding                       |
| `limit` | number | `100`   | Maximum events to process per call     |

### Return Value

Returns the number of events processed (number).

### Behavior

1. Queries up to `limit` events where `hash IS NULL`, ordered by `sequence ASC`.
2. For each event, finds the most recent hashed event in the same chain (`hackathon_id` match, `sequence <` current, `hash IS NOT NULL`).
3. Computes the SHA-256 hash using the same formula as `insertAuditEvent`.
4. Updates the event with the computed `hash` and `prev_hash`.
5. Events are processed sequentially to maintain chain ordering.

### Admin API Endpoint

Exposed via `POST /api/v1/admin/audit/backfill` (platform admin only) with a fixed limit of 500. See [Admin API](./admin.md#post-auditbackfill).

---

## Known Audit Actions

These are the audit actions currently used across the codebase:

| Action                   | Entity Type      | Triggered By                  |
|--------------------------|------------------|-------------------------------|
| `organizer.added`        | `organizer_role` | Adding an organizer           |
| `organizer.removed`      | `organizer_role` | Removing an organizer         |
| `team.invite_accepted`   | `team`           | Accepting a team invite       |
| `judge.invite_accepted`  | `judge`          | Accepting a judge invite      |

> Additional actions exist in other route files not covered here (e.g., hackathon lifecycle, submissions, judging).
