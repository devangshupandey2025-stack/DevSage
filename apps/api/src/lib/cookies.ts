import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { JWT_EXPIRY_SECONDS, REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_EXPIRY_SECONDS } from './constants.js';

const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

function isSecure(frontendUrl: string): boolean {
  try {
    return new URL(frontendUrl).protocol === 'https:';
  } catch {
    return false;
  }
}

// workers.dev is on the Public Suffix List — subdomains are cross-site.
// SameSite=None is required for cross-origin cookie sending.
function isCrossSite(frontendUrl: string): boolean {
  try {
    return new URL(frontendUrl).hostname.endsWith('.workers.dev');
  } catch {
    return false;
  }
}

function sameSitePolicy(frontendUrl: string): 'Strict' | 'Lax' | 'None' {
  if (!isSecure(frontendUrl)) return 'Lax';
  if (isCrossSite(frontendUrl)) return 'None';
  return 'Strict';
}

// ─── Access Token Cookie ─────────────────────────────────────

export function getAccessTokenCookie(c: Context): string | undefined {
  return getCookie(c, ACCESS_TOKEN_COOKIE_NAME);
}

export function setAccessTokenCookie(c: Context, token: string, frontendUrl: string): void {
  setCookie(c, ACCESS_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: sameSitePolicy(frontendUrl),
    secure: isSecure(frontendUrl),
    path: '/',
    maxAge: JWT_EXPIRY_SECONDS,
  });
}

export function clearAccessTokenCookie(c: Context, frontendUrl: string): void {
  deleteCookie(c, ACCESS_TOKEN_COOKIE_NAME, {
    path: '/',
    secure: isSecure(frontendUrl),
    sameSite: sameSitePolicy(frontendUrl),
  });
}

// ─── Refresh Token Cookie ────────────────────────────────────

export function getRefreshTokenCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
}

export function setRefreshTokenCookie(c: Context, token: string, frontendUrl: string): void {
  setCookie(c, REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: sameSitePolicy(frontendUrl),
    secure: isSecure(frontendUrl),
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS,
  });
}

export function clearRefreshTokenCookie(c: Context, frontendUrl: string): void {
  deleteCookie(c, REFRESH_TOKEN_COOKIE_NAME, {
    path: '/auth/refresh',
    secure: isSecure(frontendUrl),
    sameSite: sameSitePolicy(frontendUrl),
  });
}

// ─── Legacy Cleanup ──────────────────────────────────────────

export function clearLegacySessionCookie(c: Context, frontendUrl: string): void {
  deleteCookie(c, 'session', {
    path: '/',
    secure: isSecure(frontendUrl),
    sameSite: sameSitePolicy(frontendUrl),
  });
}
