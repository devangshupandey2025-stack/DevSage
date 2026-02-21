import { betterAuth } from 'better-auth';
import { twoFactor, magicLink, jwt } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@devsage/db/schema';
import type { AuthEnv } from './types/env.js';
import { sendEmail } from './services/email.js';

export function createAuth(env: AuthEnv['Bindings']) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    baseURL: env.AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        passkey: schema.passkey,
        jwks: schema.jwks,
      },
    }),
    emailAndPassword: {
      enabled: true,
      password: {
        // Use PBKDF2 via Web Crypto API — hardware-accelerated on Cloudflare Workers.
        // Default scrypt (N:16384, r:16) exceeds Workers CPU time limits.
        hash: async (password: string): Promise<string> => {
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits'],
          );
          const derived = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            256,
          );
          const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
          const hashHex = [...new Uint8Array(derived)]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return `pbkdf2:100000:${saltHex}:${hashHex}`;
        },
        verify: async ({
          hash,
          password,
        }: {
          hash: string;
          password: string;
        }): Promise<boolean> => {
          if (!hash.startsWith('pbkdf2:')) return false;
          const [, iterStr, saltHex, keyHex] = hash.split(':');
          const iterations = parseInt(iterStr, 10);
          const salt = new Uint8Array(
            saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
          );
          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits'],
          );
          const derived = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
            keyMaterial,
            256,
          );
          const derivedHex = [...new Uint8Array(derived)]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return derivedHex === keyHex;
        },
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [
      twoFactor({
        issuer: 'DevSage',
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(env, {
            to: email,
            subject: 'Sign in to DevSage',
            html: `<p>Click <a href="${url}">here</a> to sign in to DevSage. This link expires in 10 minutes.</p>`,
          });
        },
      }),
      passkey(),
      jwt(),
    ],
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
        domain: '.devsage.org',
      },
    },
    trustedOrigins: [
      'https://devsage.org',
      'https://platform.devsage.org',
      'https://shikdd.devsage.org',
      'https://judge.devsage.org',
      // Dev origins
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ],
  });
}

// Static export for Better Auth CLI schema generation (no runtime env)
export const auth = createAuth({
  DB: {} as any,
  BETTER_AUTH_SECRET: 'cli-placeholder-secret-at-least-32-chars',
  JWT_SECRET: 'cli-placeholder',
  GITHUB_CLIENT_ID: '',
  GITHUB_CLIENT_SECRET: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  SMTP_URL: '',
  SMTP_USERNAME: '',
  SMTP_PASSWORD: '',
  AUTH_URL: 'http://localhost:8788',
  FRONTEND_URL: 'http://localhost:5173',
  PLATFORM_URL: 'http://localhost:5174',
  ADMIN_URL: 'http://localhost:5175',
  API_URL: 'http://localhost:8787',
  EMAIL_FROM: 'noreply@devsage.org',
});
