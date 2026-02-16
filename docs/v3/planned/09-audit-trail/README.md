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

## Dependencies

- `apps/api/src/lib/audit.ts` — `insertAuditEvent()`
- `packages/db/src/schema/audit-events.ts`
- `apps/api/src/routes/audit.ts`
