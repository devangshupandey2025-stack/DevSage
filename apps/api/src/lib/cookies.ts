import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isProduction(frontendUrl: string): boolean {
  try {
    const url = new URL(frontendUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractRootDomain(frontendUrl: string): string | undefined {
  try {
    const hostname = new URL(frontendUrl).hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return `.${parts.slice(-2).join('.')}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function getSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function setSessionCookie(c: Context, token: string, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: production ? 'None' : 'Lax',
    secure: production,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context, frontendUrl: string): void {
  const production = isProduction(frontendUrl);

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: production,
    sameSite: production ? 'None' : 'Lax',
  });
}
