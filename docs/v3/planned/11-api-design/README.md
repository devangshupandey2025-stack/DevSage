# 11 — API Design

> REST API conventions, response envelope, error codes, rate limiting, and route table.

## URL Structure

```
https://api.devsage.org/api/v1/hackathons/{slug}/...
                       └─ prefix  └─ resource └─ slug-based addressing
```

All hackathon resources are addressed by slug (not UUID) in URLs.

## Response Envelope

Every response follows this shape:

```ts
// Success
{ ok: true, data: T, meta?: { etag?, timestamp?, total?, limit?, offset?, has_more? } }

// Error
{ ok: false, error: { code: string, message: string, details?: unknown } }
```

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-response-envelope.md](./01-response-envelope.md) | Success/error envelope, pagination |
| [02-error-codes.md](./02-error-codes.md) | Complete error code catalog |
| [03-route-table.md](./03-route-table.md) | All routes with method, auth, role |
| [04-validation.md](./04-validation.md) | Zod schema pattern for requests |
| [05-rate-limiting.md](./05-rate-limiting.md) | Per-IP/per-user limits via KV |
| [06-caching-etags.md](./06-caching-etags.md) | ETag generation, conditional requests |

## Dependencies

- `apps/api/src/lib/response.ts` — `successResponse()`, `errorResponse()`, `paginatedResponse()`
- `apps/api/src/middleware/rate-limit.ts`
- `apps/api/src/lib/etag.ts`
