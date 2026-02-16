# Audit Query API

> `apps/api/src/routes/audit.ts` — REST endpoints for querying audit events.

## Endpoints

### `GET /api/v1/hackathons/:slug/audit`

List audit events for a hackathon. Uses cursor-based pagination (append-only data).

```
Auth: organizer or co_organizer
Query: ?event_type=&entity_type=&entity_id=&actor_id=&limit=20&cursor=
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "rowid": 42,
      "actor_type": "user",
      "actor_id": "uuid",
      "actor_name": "Jane Doe",
      "event_type": "hackathon.transitioned",
      "entity_type": "hackathon",
      "entity_id": "uuid",
      "changes": { "status": { "old": "draft", "new": "active" } },
      "created_at": "2026-02-15T19:30:00Z"
    }
  ],
  "meta": { "limit": 20, "cursor": "row:42", "has_more": true }
}
```

### `GET /api/v1/hackathons/:slug/audit/export`

Export full audit log as JSON.

```
Auth: organizer only
```

Returns all audit events for the hackathon. For large logs, streams response.

### `GET /api/v1/hackathons/:slug/audit/entity/:entityType/:entityId`

Audit history for a specific entity (e.g., a team or submission).

```
Auth: organizer or co_organizer
```

## Cursor Pagination

Audit events use cursor-based pagination since they're append-only:

```ts
const cursor = c.req.query('cursor'); // e.g., "row:42"
const limit = parseInt(c.req.query('limit') ?? '20');

let query = `
  SELECT ae.*, ae.rowid, u.name as actor_name FROM audit_events ae
  LEFT JOIN users u ON ae.actor_id = u.id
  WHERE ae.hackathon_id = ?
`;
const params: unknown[] = [hackathonId];

if (cursor) {
  const rowid = parseInt(cursor.split(':')[1]);
  query += ` AND ae.rowid < ?`;
  params.push(rowid);
}

query += ` ORDER BY ae.rowid DESC LIMIT ?`;
params.push(limit);
```

Next cursor = `row:{last_rowid}`. Client passes it as `?cursor=row:42` to get the next page.

**Note:** SQLite's implicit `rowid` provides guaranteed insertion order without an explicit `sequence` column. See [01-event-structure.md](./01-event-structure.md) for the design rationale.

## Filters

| Filter | Query Param | Example |
|--------|------------|---------|
| Event type | `event_type` | `hackathon.transitioned` |
| Entity type | `entity_type` | `submission` |
| Entity ID | `entity_id` | UUID |
| Actor ID | `actor_id` | UUID |
| Date range | `since`, `until` | ISO-8601 timestamps |

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `INSUFFICIENT_ROLE` | 403 | User is not organizer/co_organizer |
| `INVALID_CURSOR` | 400 | Malformed cursor parameter |
