import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';

function isSecureRequest(c: Context<AppEnv>): boolean {
  return c.req.url.startsWith('https://');
}

export function getAccessTokenCookie(c: Context<AppEnv>): string | undefined {
  return getCookie(c, 'access_token');
}

export function getRefreshTokenCookie(c: Context<AppEnv>): string | undefined {
  return getCookie(c, 'refresh_token');
}

export function setAccessTokenCookie(c: Context<AppEnv>, token: string): void {
  const secure = isSecureRequest(c);
  setCookie(c, 'access_token', token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'None' : 'Lax',
    path: '/',
    maxAge: 15 * 60,
  });
}

export function setRefreshTokenCookie(c: Context<AppEnv>, token: string): void {
  const secure = isSecureRequest(c);
  setCookie(c, 'refresh_token', token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'None' : 'Lax',
    path: '/auth/refresh',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(c: Context<AppEnv>): void {
  deleteCookie(c, 'access_token', { path: '/' });
  deleteCookie(c, 'refresh_token', { path: '/auth/refresh' });
}
