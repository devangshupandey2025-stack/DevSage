import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyJWT(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64urlDecode(sig).buffer as ArrayBuffer,
    encoder.encode(`${header}.${body}`),
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/**
 * Global middleware: extracts and validates JWT from Authorization header.
 * Sets c.set('user', ...) on success, c.set('user', null) on failure.
 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    c.set('user', null);
    return next();
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    c.set('user', null);
    return next();
  }

  c.set('user', {
    id: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
    image: (payload.image as string) || null,
    platformAdmin: (payload.platformAdmin as boolean) || false,
    hackathonRoles: (payload.hackathonRoles || {}) as Record<string, string[]>,
    workspaceRoles: (payload.workspaceRoles || {}) as Record<string, string>,
  });
  return next();
};

/**
 * Per-route middleware: requires authenticated user.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401,
    );
  }
  return next();
};
