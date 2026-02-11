import { env as rawEnv, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types/env.js';

const env = rawEnv as Env;

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

describe('webhook ingestion v2', () => {
  describe('signature verification', () => {
    it('rejects missing headers', async () => {
      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('MISSING_WEBHOOK_HEADERS');
    });

    it('rejects invalid signature', async () => {
      const payload = {
        repository: { full_name: 'devsage/platform' },
        head_commit: { id: 'b'.repeat(40) },
        ref: 'refs/heads/main',
        pusher: { name: 'srijan' },
      };

      const response = await SELF.fetch('http://localhost/webhooks/github', {
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
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('push events', () => {
    it('accepts valid push event and enqueues', async () => {
      const payload = {
        repository: { full_name: 'devsage/platform' },
        head_commit: { id: 'a'.repeat(40) },
        ref: 'refs/heads/main',
        pusher: { name: 'srijan' },
        forced: false,
        before: 'b'.repeat(40),
        commits: [
          {
            id: 'c'.repeat(40),
            message: 'Initial commit',
            author: { name: 'srijan', email: 'srijan@example.com' },
            timestamp: '2024-01-01T00:00:00Z',
          },
          {
            id: 'd'.repeat(40),
            message: 'Second commit',
            author: { name: 'alice', email: 'alice@example.com' },
            timestamp: '2024-01-02T00:00:00Z',
          },
        ],
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
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
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('accepted');
    });

    it('limits commits to 20 entries', async () => {
      const commits = Array.from({ length: 30 }, (_, i) => ({
        id: i.toString().padStart(40, '0'),
        message: `Commit ${i}`,
        author: { name: 'bot', email: 'bot@example.com' },
        timestamp: '2024-01-01T00:00:00Z',
      }));

      const payload = {
        repository: { full_name: 'devsage/platform' },
        head_commit: { id: 'a'.repeat(40) },
        ref: 'refs/heads/main',
        pusher: { name: 'bot' },
        forced: false,
        before: 'b'.repeat(40),
        commits,
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
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

    it('handles force push correctly', async () => {
      const payload = {
        repository: { full_name: 'devsage/platform' },
        head_commit: { id: 'a'.repeat(40) },
        ref: 'refs/heads/main',
        pusher: { name: 'srijan' },
        forced: true,
        before: 'b'.repeat(40),
        commits: [],
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
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
  });

  describe('tag events', () => {
    it('accepts tag create event', async () => {
      const payload = {
        ref: 'v1.0.0',
        ref_type: 'tag',
        repository: { full_name: 'devsage/platform' },
        master_branch: 'main',
        sender: { login: 'srijan' },
        pusher_type: 'user',
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'create',
        },
        body,
      });

      expect(response.status).toBe(202);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('accepted');
    });

    it('acknowledges branch create without enqueuing', async () => {
      const payload = {
        ref: 'feature-branch',
        ref_type: 'branch',
        repository: { full_name: 'devsage/platform' },
        master_branch: 'main',
        sender: { login: 'srijan' },
        pusher_type: 'user',
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'create',
        },
        body,
      });

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('acknowledged');
    });

    it('accepts tag delete event', async () => {
      const payload = {
        ref: 'v1.0.0',
        ref_type: 'tag',
        repository: { full_name: 'devsage/platform' },
        sender: { login: 'srijan' },
        pusher_type: 'user',
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'delete',
        },
        body,
      });

      expect(response.status).toBe(202);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('accepted');
    });

    it('acknowledges branch delete without enqueuing', async () => {
      const payload = {
        ref: 'feature-branch',
        ref_type: 'branch',
        repository: { full_name: 'devsage/platform' },
        sender: { login: 'srijan' },
        pusher_type: 'user',
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'delete',
        },
        body,
      });

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('acknowledged');
    });
  });

  describe('installation events', () => {
    it('accepts installation created event', async () => {
      const payload = {
        action: 'created',
        installation: {
          id: 12345,
        },
        repositories: [
          { full_name: 'devsage/platform' },
          { full_name: 'devsage/docs' },
        ],
        sender: { login: 'srijan' },
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'installation',
        },
        body,
      });

      expect(response.status).toBe(202);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('accepted');
    });

    it('accepts installation_repositories event', async () => {
      const payload = {
        action: 'added',
        installation: {
          id: 12345,
        },
        repositories_added: [
          { full_name: 'devsage/new-repo' },
        ],
        sender: { login: 'srijan' },
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'installation_repositories',
        },
        body,
      });

      expect(response.status).toBe(202);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('accepted');
    });
  });

  describe('unknown events', () => {
    it('acknowledges pull_request event without processing', async () => {
      const payload = {
        action: 'opened',
        pull_request: { number: 1 },
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'pull_request',
        },
        body,
      });

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('acknowledged');
    });

    it('acknowledges issues event without processing', async () => {
      const payload = {
        action: 'opened',
        issue: { number: 1 },
      };
      const body = JSON.stringify(payload);
      const signature = await githubSignature(env.GITHUB_WEBHOOK_SECRET, body);

      const response = await SELF.fetch('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
          'X-GitHub-Delivery': crypto.randomUUID(),
          'X-GitHub-Event': 'issues',
        },
        body,
      });

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(responseBody.ok).toBe(true);
      expect(responseBody.data.message).toContain('acknowledged');
    });
  });
});
