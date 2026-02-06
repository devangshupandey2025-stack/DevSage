import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function githubSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `sha256=${toHex(signed)}`;
}

describe('webhooks critical paths', () => {
  it('accepts valid signature and push event', async () => {
    const payload = {
      repository: { full_name: 'devsage/platform' },
      head_commit: { id: 'a'.repeat(40) },
      ref: 'refs/heads/main',
      pusher: { name: 'srijan' },
    };
    const body = JSON.stringify(payload);
    const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

    const response = await SELF.fetch('http://localhost/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-GitHub-Event': 'push',
      },
      body,
    });

    expect(response.status).toBe(202);
  });

  it('rejects invalid signature', async () => {
    const payload = {
      repository: { full_name: 'devsage/platform' },
      head_commit: { id: 'b'.repeat(40) },
      ref: 'refs/heads/main',
      pusher: { name: 'srijan' },
    };

    const response = await SELF.fetch('http://localhost/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-GitHub-Event': 'push',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(401);
  });

  it('acknowledges non-push event without processing', async () => {
    const payload = {
      action: 'opened',
      pull_request: { number: 1 },
    };
    const body = JSON.stringify(payload);
    const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

    const response = await SELF.fetch('http://localhost/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-GitHub-Event': 'pull_request',
      },
      body,
    });
    const responseBody = await response.json<{ acknowledged: boolean; processed: boolean }>();

    expect(response.status).toBe(200);
    expect(responseBody.acknowledged).toBe(true);
    expect(responseBody.processed).toBe(false);
  });

  it('rejects requests missing required headers', async () => {
    const response = await SELF.fetch('http://localhost/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
