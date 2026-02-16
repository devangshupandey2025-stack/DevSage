# Response Envelope

> `apps/api/src/lib/response.ts` — Consistent response format for all endpoints.

## Success Response

```ts
function successResponse<T>(c: Context, data: T, meta?: ResponseMeta, status = 200) {
  return c.json({ ok: true, data, meta: { timestamp: new Date().toISOString(), ...meta } }, status);
}
```

```json
{
  "ok": true,
  "data": { "id": "uuid", "name": "Spring Hack 2026" },
  "meta": { "timestamp": "2026-02-15T19:30:00Z" }
}
```

## Error Response

```ts
function errorResponse(c: Context, status: number, code: string, message: string, details?: unknown) {
  return c.json({ ok: false, error: { code, message, details } }, status);
}
```

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "path": "name", "message": "Required" }]
  }
}
```

## Paginated Response (Offset)

```ts
function paginatedResponse<T>(c: Context, data: T[], pagination: { total: number; limit: number; offset: number }) {
  return c.json({
    ok: true,
    data,
    meta: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      has_more: pagination.offset + pagination.limit < pagination.total,
      timestamp: new Date().toISOString(),
    },
  });
}
```

## Paginated Response (Cursor)

For append-only data (audit trail, commit log):

```ts
function cursorPaginatedResponse<T>(c: Context, data: T[], meta: { limit: number; cursor: string | null; has_more: boolean }) {
  return c.json({ ok: true, data, meta: { ...meta, timestamp: new Date().toISOString() } });
}
```

## Pagination Defaults

| Param | Default | Min | Max |
|-------|---------|-----|-----|
| `limit` | 20 | 1 | 100 |
| `offset` | 0 | 0 | — |

## HTTP Status Codes

| Status | When |
|--------|------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Validation error, bad request |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate, version mismatch) |
| 429 | Rate limited |
| 500 | Internal server error |
| 502 | External service error (GitHub, SMTP) |
