# Ingest Pipeline

> `POST /webhooks/github` — Verify, normalize, enqueue. Return fast.

## Endpoint

```
POST /webhooks/github
Auth: None (HMAC signature verification)
Rate limit: webhook tier (1000 req/60s)
```

## Implementation

```ts
app.post('/webhooks/github', async (c) => {
  const signature = c.req.header('x-hub-signature-256');
  const deliveryId = c.req.header('x-github-delivery');
  const event = c.req.header('x-github-event');
  const body = await c.req.text();

  // 1. Verify HMAC-SHA256 signature
  const isValid = await verifyWebhookSignature(body, signature, c.env.WEBHOOK_SECRET);
  if (!isValid) {
    return errorResponse(c, 401, 'WEBHOOK_INVALID_SIGNATURE', 'Invalid signature');
  }

  // 2. Idempotency check (optional — queue handles retries)
  // Could check webhook_deliveries table, but adds latency

  // 3. Normalize event
  const payload = JSON.parse(body);
  const normalized = normalizeGitHubEvent(event, payload, deliveryId);

  if (!normalized) {
    // Event type we don't care about (e.g., star, fork)
    return c.json({ ok: true, message: 'ignored' });
  }

  // 4. Enqueue for async processing
  await c.env.WEBHOOK_QUEUE.send(normalized);

  // 5. Record delivery (async — don't block response)
  c.executionCtx.waitUntil(
    c.env.DB.prepare(`
      INSERT INTO webhook_deliveries (id, github_delivery_id, event_type, status, received_at)
      VALUES (?, ?, ?, 'queued', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(crypto.randomUUID(), deliveryId, event).run()
  );

  return c.json({ ok: true });
});
```

## HMAC Verification

```ts
async function verifyWebhookSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = 'sha256=' + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison via double-HMAC
  // crypto.subtle.timingSafeEqual does NOT exist in the Web Crypto API.
  // Instead, compare by computing HMAC of both strings with a random key —
  // HMAC comparison is constant-time for same-length inputs.
  if (expected.length !== signature.length) return false;

  const compareKey = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', compareKey, new TextEncoder().encode(expected)),
    crypto.subtle.sign('HMAC', compareKey, new TextEncoder().encode(signature)),
  ]);

  return arrayBuffersEqual(a, b);
}

function arrayBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  if (viewA.length !== viewB.length) return false;
  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= viewA[i] ^ viewB[i];
  }
  return result === 0;
}
```

## Webhook Deliveries Table

```sql
CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  github_delivery_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processed', 'failed', 'ignored')),
  error_message TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT
);
```

## Handled Events

| GitHub Event | Normalized Type | Handler |
|-------------|----------------|---------|
| `push` | `push` | push-handler |
| `create` (ref_type=tag) | `tag_created` | tag-create-handler |
| `delete` (ref_type=tag) | `tag_deleted` | tag-delete-handler |
| `installation` | `installation` | installation-handler |
| Others | `null` (ignored) | — |

## Edge Cases

- **Invalid HMAC signature.** Return 401, do NOT enqueue. This is the security boundary.
- **Missing `x-github-delivery` header.** Generate a synthetic delivery ID (UUID) and log a warning. Processing continues normally.
- **Unrecognized event type (e.g., star, fork).** Return 200 with `{ ok: true, message: 'ignored' }`. Already handled by `normalizeGitHubEvent` returning null.
- **Queue is full or unavailable.** Return 500. GitHub will retry (up to 3 times with exponential backoff).
- **Duplicate delivery (GitHub retries).** The queue handler uses `delivery_id` for idempotency. Duplicate enqueues are harmless.
- **Massive payload (>100KB push event with many commits).** Truncate the commit list during normalization and log a warning. Keep the event processable.

## Done When

- [ ] POST /webhooks/github returns 200 in <50ms for valid webhooks
- [ ] Invalid HMAC returns 401
- [ ] Event normalized and enqueued correctly
- [ ] Delivery recorded in webhook_deliveries (via waitUntil)
- [ ] Ignored events return 200 with message
- [ ] Constant-time HMAC comparison (no timing attacks)
- [ ] Integration test: valid webhook -> queued, invalid signature -> rejected

## Implementation Notes

- Response MUST be < 10 seconds (GitHub timeout). Our target: < 50ms
- `waitUntil()` for non-critical DB writes (delivery logging)
- Queue retry handles transient failures — no need for complex retry logic in ingestion
- The `WEBHOOK_SECRET` is configured in GitHub App settings and stored as a Cloudflare secret
