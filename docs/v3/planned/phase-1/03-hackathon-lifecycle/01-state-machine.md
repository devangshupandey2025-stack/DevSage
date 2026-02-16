# State Machine

> Five states with forward-only transitions. Each state defines which actions are allowed.

## States & Transitions

```
draft ──→ active ──→ judging ──→ completed ──→ archived
                                      ↑            |
                                      └────────────┘
```

### Transition Table

| From | To | Who | Preconditions |
|------|----|-----|--------------|
| `draft` | `active` | organizer | `submission_deadline` must be set |
| `active` | `judging` | organizer or auto (deadline) | Deadline passed OR manual trigger |
| `judging` | `completed` | organizer | At least one score submitted |
| `completed` | `archived` | organizer | None |
| `archived` | `completed` | organizer | Un-archive for score corrections |

All other transitions are rejected.

## Allowed Actions Per State

| Action | draft | active | judging | completed | archived |
|--------|:-----:|:------:|:-------:|:---------:|:--------:|
| Edit settings | ✅ | ✅¹ | ❌ | ❌ | ❌ |
| Create/edit teams | ✅ | ✅ | ❌ | ❌ | ❌ |
| Link GitHub repos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Accept submissions | ❌ | ✅ | ❌ | ❌ | ❌ |
| Score submissions | ❌ | ❌ | ✅ | ❌ | ❌ |
| Publish results | ❌ | ❌ | ❌ | ✅ | ❌ |
| View results | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit scores | ❌ | ❌ | ✅ | ✅² | ❌ |

¹ Limited settings only (cannot change slug, tracks after teams exist).
² Only after un-archiving back to `completed`.

## Optimistic Versioning

Every state transition includes a `version` field to prevent concurrent updates:

```ts
// Client sends:
{ target_status: 'active', version: 3 }

// DO checks:
if (request.version !== currentState.version) {
  return error(409, 'STATE_VERSION_CONFLICT', 'State has been modified');
}

// On success: atomic version increment in DO SQLite
const result = this.db.exec<{ version: number }>(
  `UPDATE lifecycle_state
   SET status = ?, version = version + 1, updated_at = ?
   WHERE hackathon_id = ? AND version = ?
   RETURNING version`,
  target_status, new Date().toISOString(), hackathon_id, request.version
);
if (!result.length) {
  return error(409, 'STATE_VERSION_CONFLICT', 'State has been modified');
}
```

## State Stored in DO

```ts
interface HackathonState {
  hackathon_id: string;
  status: 'draft' | 'active' | 'judging' | 'completed' | 'archived';
  version: number;
  submission_deadline: string | null; // ISO-8601
  judging_deadline: string | null;    // ISO-8601
  config: Record<string, unknown>;    // merged partial config
  updated_at: string;
}
```

## Side Effects on Transition

| Transition | Side Effects |
|-----------|-------------|
| draft → active | Schedule deadline alarm, notify participants |
| active → judging | Lock all submissions, notify judges |
| judging → completed | Finalize scores, compute leaderboard |
| completed → archived | No side effects |
| archived → completed | Re-enable score editing |

See [04-phase-transitions.md](./04-phase-transitions.md) for details.
