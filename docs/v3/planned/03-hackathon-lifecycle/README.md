# 03 — Hackathon Lifecycle

> 5-state forward-only state machine managed by a Durable Object. Each hackathon gets its own DO instance for single-writer concurrency.

## State Machine

```
draft → active → judging → completed → archived
                                  ↑          |
                                  └──────────┘
                                  (un-archive only)
```

| State | What Happens |
|-------|-------------|
| `draft` | Configure hackathon, set up teams, invite judges. No submissions accepted |
| `active` | Submissions accepted. Participants push code, create tags. Deadline enforced |
| `judging` | Submissions locked. Judges score teams. No new submissions |
| `completed` | Scores finalized. Results published. Read-only |
| `archived` | Historical record. Can un-archive back to `completed` for corrections |

## Durable Object

One `HackathonStateMachine` DO per hackathon, keyed by hackathon ID.

**Responsibilities:**
- Validate and execute state transitions
- Lock/accept submissions (exactly-once)
- Schedule deadline alarms
- Track submission counts per team

**Storage:** SQLite-backed (3 tables: `lifecycle_state`, `submission_locks`, `team_submissions`)

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-state-machine.md](./01-state-machine.md) | States, transitions, allowed actions per state |
| [02-durable-object.md](./02-durable-object.md) | DO design, HTTP API, SQLite storage |
| [03-creating-hackathon.md](./03-creating-hackathon.md) | POST endpoint, validation, slug, defaults |
| [04-phase-transitions.md](./04-phase-transitions.md) | Transition rules, preconditions, side effects |
| [05-configuration.md](./05-configuration.md) | Settings, tracks, prizes, branding, deadlines |
| [06-templates.md](./06-templates.md) | Template CRUD, cloning, platform defaults |
| [07-automated-transitions.md](./07-automated-transitions.md) | Cron + alarm-based deadline enforcement |

## Dependencies

- `apps/api/src/durable-objects/hackathon-state-machine.ts`
- `apps/api/src/routes/hackathons.ts`
- `apps/api/src/lib/do-client.ts` — DO stub helper
- `packages/db/src/schema/hackathons.ts`
- `packages/db/src/schema/hackathon-tracks.ts`
- `packages/db/src/schema/hackathon-rounds.ts`
- **HACKATHON_SM** binding in `wrangler.jsonc`
