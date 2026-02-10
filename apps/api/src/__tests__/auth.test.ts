import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { signJWT, verifyJWT } from '../lib/jwt.js';

const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signArbitraryToken(payload: unknown, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${signingInput}.${encodedSignature}`;
}

describe('auth critical paths', () => {
  it('signJWT produces a valid 3-part token', async () => {
    const token = await signJWT(
      {
        sub: crypto.randomUUID(),
        email: 'organizer@example.com',
        role: 'organizer',
      },
      JWT_SECRET
    );

    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyJWT accepts token signed with same secret', async () => {
    const userId = crypto.randomUUID();
    const token = await signJWT(
      {
        sub: userId,
        email: 'organizer@example.com',
        role: 'organizer',
      },
      JWT_SECRET
    );

    const verified = await verifyJWT(token, JWT_SECRET);

    expect(verified?.sub).toBe(userId);
    expect(verified?.email).toBe('organizer@example.com');
    expect(verified?.role).toBe('organizer');
  });

  it('verifyJWT rejects token signed with different secret', async () => {
    const token = await signJWT(
      {
        sub: crypto.randomUUID(),
        email: 'participant@example.com',
        role: 'participant',
      },
      JWT_SECRET
    );

    const verified = await verifyJWT(token, 'different-secret-key-min-32-chars!!');

    expect(verified).toBeNull();
  });

  it('verifyJWT rejects expired token', async () => {
    const token = await signJWT(
      {
        sub: crypto.randomUUID(),
        email: 'participant@example.com',
        role: 'participant',
      },
      JWT_SECRET,
      -1
    );

    const verified = await verifyJWT(token, JWT_SECRET);

    expect(verified).toBeNull();
  });

  it('verifyJWT rejects malformed tokens', async () => {
    const wrongFormat = await verifyJWT('not.a.jwt.token.extra', JWT_SECRET);
    const missingParts = await verifyJWT('only-two-parts.token', JWT_SECRET);
    const missingFieldsToken = await signArbitraryToken({ sub: crypto.randomUUID() }, JWT_SECRET);
    const missingFields = await verifyJWT(missingFieldsToken, JWT_SECRET);

    expect(wrongFormat).toBeNull();
    expect(missingParts).toBeNull();
    expect(missingFields).toBeNull();
  });

  it('auth middleware rejects requests without session cookie', async () => {
    const response = await SELF.fetch('http://localhost/hackathons');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('NO_TOKEN');
  });

  it('auth middleware rejects requests with invalid JWT', async () => {
    const response = await SELF.fetch('http://localhost/hackathons', {
      headers: {
        Cookie: 'session=invalid-token',
      },
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('INVALID_TOKEN');
  });
});
