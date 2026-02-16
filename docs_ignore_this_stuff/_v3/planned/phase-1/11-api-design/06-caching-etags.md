# Caching & ETags

> `apps/api/src/lib/etag.ts` — Conditional requests with ETag support.

## How ETags Work

1. Server generates ETag from response data hash
2. Response includes `ETag` header
3. Client sends `If-None-Match: {etag}` on next request
4. If data unchanged → 304 Not Modified (no body)

## ETag Generation

```ts
async function generateETag(data: unknown): Promise<string> {
  const json = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `"${hex.substring(0, 16)}"`;  // short hash, quoted per HTTP spec
}
```

## Usage in Route Handlers

```ts
app.get('/hackathons/:slug', async (c) => {
  const hackathon = await db.select().from(hackathons).where(eq(hackathons.slug, slug)).get();

  const etag = await generateETag(hackathon);
  const ifNoneMatch = c.req.header('if-none-match');

  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }

  c.header('ETag', etag);
  c.header('Cache-Control', 'private, no-cache'); // must revalidate
  return successResponse(c, hackathon, { etag });
});
```

## Cache-Control Strategy

| Resource | Cache-Control | ETags |
|----------|--------------|-------|
| Public hackathon info | `public, max-age=60` | ✅ |
| User-specific data | `private, no-cache` | ✅ |
| Leaderboard | `private, max-age=30` | ✅ |
| Audit trail | `private, no-cache` | ✅ |
| Auth endpoints | `no-store` | ❌ |

## CORS Exposed Headers

ETags are exposed to the frontend via CORS:

```ts
'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, ETag'
```

## Implementation Notes

- ETags use weak comparison (prefix `W/` not used but short hash is effectively weak)
- `no-cache` means "always revalidate" not "don't cache" — browser caches but checks ETag
- Only GET endpoints support ETags — mutations always return fresh data
- The `meta.etag` field in the response envelope mirrors the header for convenience
