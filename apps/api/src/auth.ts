import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@devsage/db/schema';

/**
 * Creates a Better Auth instance bound to the current request's D1 database.
 *
 * CRITICAL: D1 bindings are only available inside a request handler on
 * Cloudflare Workers. This function MUST be called per-request, never at
 * module top-level.
 */
export function createAuth(env: {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
}) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [env.FRONTEND_URL, env.PLATFORM_URL, env.ADMIN_URL].filter(Boolean),
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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Mirror new Better Auth user into legacy `users` table.
            // 20+ tables FK to users.id — keeping them in sync is required.
            try {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO users (id, email, name, password_hash, avatar_url, created_at)
                 VALUES (?, ?, ?, '', ?, ?)`
              ).bind(
                user.id,
                user.email,
                user.name,
                user.image ?? null,
                new Date().toISOString(),
              ).run();
            } catch {
              // Best-effort: if the legacy row already exists (e.g. migration),
              // the INSERT OR IGNORE silently succeeds. Log unexpected errors.
              console.error('Failed to mirror BA user to legacy users table:', user.id);
            }
          },
        },
      },
    },
  });
}
