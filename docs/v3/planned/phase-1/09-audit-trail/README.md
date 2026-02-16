# 09 — Audit Trail

> Append-only audit log with hash chain integrity for every state-changing operation.

## Architecture

Every mutation in the system produces an audit event via `insertAuditEvent()`. Events are append-only with SHA-256 hash chain linking.

```
Mutation → insertAuditEvent() → D1 insert (audit_events table)
                                  ↓
                            Hash chain: SHA-256(current + prev_hash)
```

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-event-structure.md](./01-event-structure.md) | Schema, actor model, hash chain |
| [02-event-catalog.md](./02-event-catalog.md) | Full list of auditable actions |
| [03-ingestion.md](./03-ingestion.md) | insertAuditEvent() implementation |
| [04-query-api.md](./04-query-api.md) | REST endpoints, filters, cursor pagination |

### Retention & Cleanup

Audit events are append-only. On D1 free tier (5GB storage), at ~500 bytes/row, the table can hold ~10M events before hitting the storage limit.

**Phase 1 strategy:**
- Events are retained indefinitely (expected volume: <100K events/month)
- No automatic cleanup in Phase 1

**Phase 2 strategy (when needed):**
- Archive events older than 90 days to R2 as NDJSON files
- Cron trigger: `0 3 * * 0` (weekly at 3am Sunday)
- Keep chain anchor records (last hash per hackathon) in D1 for chain verification continuity
- Archive query: `SELECT * FROM audit_events WHERE created_at < date('now', '-90 days') ORDER BY rowid`
- After archival, delete archived rows from D1

**Note:** Hash chain verification across archived segments requires loading the anchor hash from the previous archive. This is documented in Phase 2.

## Dependencies

- `apps/api/src/lib/audit.ts` — `insertAuditEvent()`
- `packages/db/src/schema/audit-events.ts`
- `apps/api/src/routes/audit.ts`
