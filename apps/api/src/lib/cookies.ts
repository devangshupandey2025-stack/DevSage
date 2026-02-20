import type { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';

const IS_PROD = true; // Always treat as prod for cookie security; local dev uses different domain

export function setAccessTokenCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, 'access_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });
}

export function setRefreshTokenCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, 'refresh_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/auth/refresh',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function clearAuthCookies(c: Context<AppEnv>): void {
  deleteCookie(c, 'access_token', { path: '/' });
  deleteCookie(c, 'refresh_token', { path: '/auth/refresh' });
}
