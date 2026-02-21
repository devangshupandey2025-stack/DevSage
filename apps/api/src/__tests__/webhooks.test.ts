import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  ensureSchema,
  resetDb,
  env,
} from './helpers.js';

const WEBHOOK_SECRET = 'test-webhook-secret-min-32-chars!!';

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

function makePushPayload(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    ref: 'refs/heads/main',
    before: 'a'.repeat(40),
    after: 'b'.repeat(40),
    forced: false,
    pusher: { name: 'testuser' },
    commits: [],
    repository: {
      owner: { login: 'test-org' },
      name: 'test-repo',
      full_name: 'test-org/test-repo',
    },
    ...overrides,
  });
}

describe('Webhooks – POST /webhooks/github', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('accepts a valid webhook with correct HMAC signature', async () => {
    const payload = makePushPayload();
    const signature = await signPayload(payload, WEBHOOK_SECRET);

    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': crypto.randomUUID(),
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean };
    expect(json.received).toBe(true);
  });

  it('rejects an invalid HMAC signature with 401', async () => {
    const payload = JSON.stringify({ action: 'opened' });

    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': crypto.randomUUID(),
      },
      body: payload,
    });

    expect(res.status).toBe(401);
  });

  it('returns error when X-Hub-Signature-256 header is missing', async () => {
    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': crypto.randomUUID(),
      },
      body: JSON.stringify({ action: 'opened' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns error when X-GitHub-Event header is missing', async () => {
    const payload = JSON.stringify({ action: 'opened' });
    const signature = await signPayload(payload, WEBHOOK_SECRET);

    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Delivery': crypto.randomUUID(),
      },
      body: payload,
    });

    expect(res.status).toBe(400);
  });

  it('returns error when X-GitHub-Delivery header is missing', async () => {
    const payload = JSON.stringify({ action: 'opened' });
    const signature = await signPayload(payload, WEBHOOK_SECRET);

    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
      },
      body: payload,
    });

    expect(res.status).toBe(400);
  });

  it('records delivery in webhook_deliveries for a push event', async () => {
    const deliveryId = crypto.randomUUID();
    const payload = makePushPayload();
    const signature = await signPayload(payload, WEBHOOK_SECRET);

    await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': deliveryId,
      },
      body: payload,
    });

    // waitUntil runs async — give it a moment
    await new Promise(r => setTimeout(r, 300));

    const row = await env.DB.prepare(
      'SELECT * FROM webhook_deliveries WHERE delivery_id = ?'
    ).bind(deliveryId).first();

    expect(row).toBeTruthy();
    expect(row!.event_type).toBe('push');
  });

  it('handles unknown event type gracefully (returns ignored)', async () => {
    const payload = JSON.stringify({ something: 'irrelevant' });
    const signature = await signPayload(payload, WEBHOOK_SECRET);

    const res = await SELF.fetch('http://localhost/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'totally_unknown_event',
        'X-GitHub-Delivery': crypto.randomUUID(),
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { received: boolean; action: string };
    expect(json.received).toBe(true);
    expect(json.action).toBe('ignored');
  });
});
