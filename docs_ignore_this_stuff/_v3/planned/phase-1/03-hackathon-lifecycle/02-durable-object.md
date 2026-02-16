# Durable Object Design

> `apps/api/src/durable-objects/hackathon-state-machine.ts` — Single-writer concurrency for hackathon lifecycle.

## Overview

Each hackathon gets its own DO instance. The Worker communicates with the DO via typed RPC methods (compatibility date >= 2024-04-03).

```ts
// Getting a DO stub — use getByName() for deterministic routing
const stub = env.HACKATHON_SM.getByName(hackathonId);
const state = await stub.getState();
```

## RPC Methods

The DO class extends `DurableObject<Env>` and exposes typed RPC methods (called by the Worker, not by clients directly):

```ts
export class HackathonStateMachine extends DurableObject<Env> {
  async initialize(hackathonId: string, config?: HackathonConfig): Promise<HackathonState> { ... }
  async transition(targetStatus: string, version: number): Promise<HackathonState> { ... }
  async getState(): Promise<HackathonState> { ... }
  async acceptSubmission(teamId: string, submissionKey: string): Promise<{ accepted: boolean; reason?: string }> { ... }
}
```

### `initialize(hackathonId, config?)`

Creates initial state. Idempotent — safe to call multiple times.

```ts
// Creates lifecycle_state row:
{ hackathon_id, status: 'draft', version: 1, config: {}, updated_at: now }
```

### `transition(targetStatus, version)`

Executes a state transition with optimistic versioning.

```ts
// Validates:
// 1. If version === -1, skip version check (force transition — used by cron/alarm only)
// 2. Otherwise, version must match current (optimistic locking)
// 3. Transition is allowed (from current → target)
// 4. Preconditions met (e.g., deadline set for draft→active)
// Returns: updated state or rejection reason

// Version bypass:
// version: -1 is a sentinel value used exclusively by automated systems (cron, DO alarm)
// to force a transition without knowing the current version. This is safe because:
// - DO is single-writer (no concurrent transitions possible)
// - Only system actors (cron/alarm) use this — user-facing routes always pass real versions
```

### `getState()`

Returns current state (status, version, config, deadlines).

### `acceptSubmission(teamId, submissionKey)`

Locks a submission slot for a team. Exactly-once via submission key.

```ts
// Checks:
// 1. Status is 'active'
// 2. Submission key not already used (idempotent)
// 3. Team hasn't exceeded max_submissions_per_team
// 4. Deadline hasn't passed
// Returns: { accepted: true } or rejection reason
```

## Constructor & SQLite Schema Init

The DO uses SQLite (not KV) with three tables. Schema is created in the constructor via `blockConcurrencyWhile()` to guarantee tables exist before any RPC method runs:

```ts
constructor(ctx: DurableObjectState, env: Env) {
  super(ctx, env);
  ctx.blockConcurrencyWhile(async () => {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS lifecycle_state (
        hackathon_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS submission_locks (
        team_id TEXT NOT NULL,
        submission_key TEXT NOT NULL,
        locked_at TEXT NOT NULL,
        PRIMARY KEY (team_id, submission_key)
      );
      CREATE TABLE IF NOT EXISTS team_submissions (
        team_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
  });
}
```

Additional columns (`submission_deadline`, `judging_deadline`, `config`) can be added to `lifecycle_state` as needed.

## Alarm Handling

DOs support alarms for scheduled execution. The alarm is the **primary** deadline enforcement mechanism (exact-to-the-second). The hourly cron is a backup safety net.

### Setting the Alarm

Alarms are set on `draft → active` transition:
```ts
if (targetStatus === 'active' && state.submission_deadline) {
  const deadline = new Date(state.submission_deadline).getTime();
  await this.ctx.storage.setAlarm(deadline);
}
```

### Alarm Fires → DO Coordinates with Worker

When the alarm fires, the DO transitions its own state and then **calls the Worker's fetch handler** to handle D1 updates and notifications. DOs can access their own bindings via `this.env`:

```ts
async alarm(): Promise<void> {
  const state = await this.getState();

  if (state.status !== 'active') return; // Already transitioned (cron beat us)

  // 1. Transition DO state (single-writer, always safe)
  await this.executeTransition('judging');

  // 2. Enqueue notifications via binding (DOs CAN access env bindings)
  await this.env.NOTIFICATION_QUEUE.send({
    type: 'hackathon.judging_started',
    hackathon_id: state.hackathon_id,
  });

  // 3. Sync D1 via the Worker's internal endpoint
  //    (DOs cannot directly use Drizzle, but CAN use D1 binding)
  await this.env.DB.prepare(`
    UPDATE hackathons SET status = 'judging', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(state.hackathon_id).run();
}
```

**Key insight:** DOs *can* access `this.env` bindings (D1, KV, Queues, etc.) — they just can't use Drizzle ORM directly since it's a runtime dependency. Raw D1 prepared statements work fine.

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

- DO instances are lazily created — first RPC method call creates it
- All DO methods are synchronous within the DO (single-writer guarantee)
- DO survives between requests — state persists in SQLite
- If DO crashes, it restores from SQLite on next request
- Alarms survive DO restarts
