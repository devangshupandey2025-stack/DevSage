import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { JWT_EXPIRY_SECONDS, REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_EXPIRY_SECONDS } from './constants.js';

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

function isProduction(frontendUrl: string): boolean {
  try {
    const url = new URL(frontendUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Access Token Cookie ─────────────────────────────────────

export function getAccessTokenCookie(c: Context): string | undefined {
  return getCookie(c, ACCESS_TOKEN_COOKIE_NAME);
}

export function setAccessTokenCookie(c: Context, token: string, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  setCookie(c, ACCESS_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: production ? 'Strict' : 'Lax',
    secure: production,
    path: '/',
    maxAge: JWT_EXPIRY_SECONDS,
  });
}

export function clearAccessTokenCookie(c: Context, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  deleteCookie(c, ACCESS_TOKEN_COOKIE_NAME, {
    path: '/',
    secure: production,
    sameSite: production ? 'Strict' : 'Lax',
  });
}

// ─── Refresh Token Cookie ────────────────────────────────────

export function getRefreshTokenCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
}

export function setRefreshTokenCookie(c: Context, token: string, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  setCookie(c, REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: production ? 'Strict' : 'Lax',
    secure: production,
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
  });
}

export function clearRefreshTokenCookie(c: Context, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  deleteCookie(c, REFRESH_TOKEN_COOKIE_NAME, {
    path: '/auth/refresh',
    secure: production,
    sameSite: production ? 'Strict' : 'Lax',
  });
}

// ─── Legacy Cleanup ──────────────────────────────────────────

/** Clear the v2 'session' cookie if it still exists. */
export function clearLegacySessionCookie(c: Context, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  deleteCookie(c, 'session', {
    path: '/',
    secure: production,
    sameSite: production ? 'Strict' : 'Lax',
  });
}
