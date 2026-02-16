# Durable Object Design

> `apps/api/src/durable-objects/hackathon-state-machine.ts` — Single-writer concurrency for hackathon lifecycle.

## Overview

Each hackathon gets its own DO instance. The Worker communicates with the DO via `stub.fetch()`.

```ts
// Getting a DO stub
const id = env.HACKATHON_SM.idFromName(hackathonId);
const stub = env.HACKATHON_SM.get(id);
const response = await stub.fetch(request);
```

## HTTP API

The DO exposes these endpoints (called by the Worker, not by clients directly):

### `POST /initialize`

Creates initial state. Idempotent — safe to call multiple times.

```ts
// Body:
{ hackathon_id: string, config?: Record<string, unknown> }

// Creates lifecycle_state row:
{ hackathon_id, status: 'draft', version: 1, config: {}, updated_at: now }
```

### `POST /transition`

Executes a state transition with optimistic versioning.

```ts
// Body:
{ target_status: string, version: number, submission_deadline?: string, judging_deadline?: string }

// Validates:
// 1. Version matches current
// 2. Transition is allowed (from current → target)
// 3. Preconditions met (e.g., deadline set for draft→active)
// Returns: updated state
```

### `POST /update-config`

Merges partial configuration into state.

```ts
// Body: partial config object
// Deep-merges with existing config
// Increments version
```

### `GET /state`

Returns current state (status, version, config, deadlines).

### `POST /accept-submission`

Locks a submission slot for a team. Exactly-once via submission key.

```ts
// Body:
{ team_id: string, submission_key: string, round_id?: string }

// Checks:
// 1. Status is 'active'
// 2. Submission key not already used (idempotent)
// 3. Team hasn't exceeded max_submissions_per_team
// 4. Deadline hasn't passed
// Returns: { accepted: true } or rejection reason
```

### `GET /can-accept-submissions`

Quick check: is status `active` and deadline not passed?

## SQLite Storage

The DO uses SQLite (not KV) with three tables:

```sql
-- Core state
CREATE TABLE lifecycle_state (
  hackathon_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  submission_deadline TEXT,
  judging_deadline TEXT,
  config TEXT DEFAULT '{}',  -- JSON
  updated_at TEXT NOT NULL
);

-- Submission locking (exactly-once)
CREATE TABLE submission_locks (
  submission_key TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  locked_at TEXT NOT NULL
);

-- Team submission counts
CREATE TABLE team_submissions (
  team_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
```

## Alarm Handling

DOs support alarms for scheduled execution:

```ts
async alarm(): Promise<void> {
  const state = await this.getState();

  if (state.status === 'active' && state.submission_deadline) {
    const deadline = new Date(state.submission_deadline);
    if (Date.now() >= deadline.getTime()) {
      // Auto-transition to judging
      await this.transition('judging');
      // Notify via queue
    }
  }
}
```

Alarms are set on `draft → active` transition:
```ts
const deadline = new Date(submission_deadline);
await this.ctx.storage.setAlarm(deadline.getTime());
```

## Wrangler Config

```jsonc
// apps/api/wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "HACKATHON_SM", "class_name": "HackathonStateMachine" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["HackathonStateMachine"] }
  ]
}
```

## Re-export Requirement

The DO class MUST be re-exported from `apps/api/src/index.ts`:

```ts
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
```

Without this, wrangler cannot find the DO class.

## Implementation Notes

- DO instances are lazily created — first `stub.fetch()` call creates it
- All DO methods are synchronous within the DO (single-writer guarantee)
- DO survives between requests — state persists in SQLite
- If DO crashes, it restores from SQLite on next request
- Alarms survive DO restarts
