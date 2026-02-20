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
      },
    }),
    emailAndPassword: {
      enabled: true,
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
