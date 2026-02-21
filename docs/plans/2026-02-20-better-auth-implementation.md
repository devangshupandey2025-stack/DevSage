# Better Auth Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom auth with Better Auth as a dedicated Cloudflare Worker at `auth.devsage.org`, with 2FA, magic links, passkeys, GitHub/Google OAuth, and role-enriched JWTs for stateless API access.

**Architecture:** Separate auth worker (Better Auth + Hono) shares D1 database with API worker. Auth handles sessions/login, issues 15-min JWTs with embedded roles. API validates JWTs locally via shared secret — zero DB calls for auth checks.

**Tech Stack:** better-auth, @better-auth/passkey, Hono, Drizzle ORM, Cloudflare D1, Web Crypto API (JWT signing)

---

## Task 1: Scaffold `apps/auth` Worker

**Files:**
- Create: `apps/auth/package.json`
- Create: `apps/auth/tsconfig.json`
- Create: `apps/auth/wrangler.jsonc`

**Step 1: Create package.json**

```json
{
  "name": "@devsage/auth",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "wrangler dev --local",
    "deploy": "wrangler deploy",
    "deploy:secrets": "wrangler secret bulk .env.production",
    "build": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.14",
    "better-auth": "^1.2.0",
    "@better-auth/passkey": "^1.2.0",
    "drizzle-orm": "^0.36.4",
    "@devsage/db": "workspace:*"
  },
  "devDependencies": {
    "@devsage/config": "workspace:*",
    "@cloudflare/workers-types": "^4.20241218.0",
    "@cloudflare/vitest-pool-workers": "^0.12.10",
    "vitest": "^3.2.4",
    "wrangler": "4.63.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "@devsage/config/tsconfig.worker.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "rootDir": ".",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

**Step 3: Create wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "auth",
  "account_id": "cf3386ad6d48a38a199781a39b2324ad",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"],

  // Same D1 database as API worker
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "devsage-db",
      "database_id": "dddf6034-11ca-4d49-a838-cd45fbc6bd86"
    }
  ],

  "observability": {
    "enabled": true
  },

  "vars": {
    "AUTH_URL": "https://auth.devsage.org",
    "FRONTEND_URL": "https://devsage.org",
    "PLATFORM_URL": "https://platform.devsage.org",
    "ADMIN_URL": "https://shikdd.devsage.org",
    "API_URL": "https://api.devsage.org",
    "EMAIL_FROM": "noreply@devsage.org"
  }
}
```

**Step 4: Install dependencies**

Run: `cd apps/auth && pnpm install`

**Step 5: Commit**

```bash
git add apps/auth/package.json apps/auth/tsconfig.json apps/auth/wrangler.jsonc
git commit -m "feat(auth): scaffold auth worker at apps/auth"
```

---

## Task 2: Create Better Auth Database Schemas

Better Auth needs specific tables. We create them as Drizzle schemas in `packages/db` so both workers share them.

**Files:**
- Create: `packages/db/src/schema/auth-user.ts`
- Create: `packages/db/src/schema/auth-session.ts`
- Create: `packages/db/src/schema/auth-account.ts`
- Create: `packages/db/src/schema/auth-verification.ts`
- Create: `packages/db/src/schema/auth-two-factor.ts`
- Create: `packages/db/src/schema/auth-passkey.ts`
- Modify: `packages/db/src/schema/index.ts`
- Remove export: `users` from `packages/db/src/schema/users.ts` (replaced)
- Remove export: `refreshTokens` from `packages/db/src/schema/refresh-tokens.ts` (replaced)
- Remove export: `deletionRequests` from `packages/db/src/schema/deletion-requests.ts` (replaced)

**Step 1: Create auth-user.ts (replaces users.ts)**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**Step 2: Create auth-session.ts**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth-user.js';

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id),
});
```

**Step 3: Create auth-account.ts**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth-user.js';

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**Step 4: Create auth-verification.ts**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

**Step 5: Create auth-two-factor.ts**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { user } from './auth-user.js';

export const twoFactor = sqliteTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
});
```

**Step 6: Create auth-passkey.ts**

```ts
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { user } from './auth-user.js';

export const passkey = sqliteTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  credentialID: text('credential_id').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
  transports: text('transports'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

**Step 7: Update schema/index.ts**

Remove old auth exports, add new Better Auth exports. Update all FK references from `users` to `user`:

```ts
// Better Auth tables
export { user } from './auth-user.js';
export { session } from './auth-session.js';
export { account } from './auth-account.js';
export { verification } from './auth-verification.js';
export { twoFactor } from './auth-two-factor.js';
export { passkey } from './auth-passkey.js';

// Keep all business tables (update FK imports in each)
export { platformAdmins } from './platform-admins.js';
export { workspaces } from './workspaces.js';
// ... rest unchanged
```

**Step 8: Update FK references in business tables**

Every schema file that imports `users` needs to import `user` from `./auth-user.js` instead. Files to update:
- `platform-admins.ts`: `users` → `user`
- `organizer-roles.ts`: `users` → `user`
- `workspace-members.ts`: `users` → `user`
- `workspace-invites.ts`: `users` → `user`
- `team-members.ts`: `users` → `user`
- `team-invites.ts`: `users` → `user`
- `judges.ts`: `users` → `user`
- `scores.ts`: `users` → `user`
- `submissions.ts`: `users` → `user`
- `audit-events.ts`: `users` → `user`
- `deletion-requests.ts`: (DELETE this file)
- `in-app-notifications.ts`: `users` → `user`

For each: change `import { users } from './users.js'` to `import { user } from './auth-user.js'` and update `.references(() => users.id)` to `.references(() => user.id)`.

**Step 9: Delete old auth schema files**

Delete: `packages/db/src/schema/users.ts`, `packages/db/src/schema/refresh-tokens.ts`, `packages/db/src/schema/deletion-requests.ts`

**Step 10: Generate D1 migration**

Run: `cd packages/db && pnpm generate`

This generates a new SQL migration in `packages/db/migrations/` with the new Better Auth tables and updated FKs.

**Step 11: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add Better Auth schemas, remove old auth tables"
```

---

## Task 3: Create Better Auth Configuration

**Files:**
- Create: `apps/auth/src/auth.ts`
- Create: `apps/auth/src/types/env.ts`

**Step 1: Create types/env.ts**

```ts
export interface AuthEnv {
  Bindings: {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    JWT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    SMTP_URL: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    AUTH_URL: string;
    FRONTEND_URL: string;
    PLATFORM_URL: string;
    ADMIN_URL: string;
    API_URL: string;
    EMAIL_FROM: string;
  };
}
```

**Step 2: Create auth.ts — Better Auth factory**

```ts
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { magicLink } from 'better-auth/plugins';
import { jwt } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@devsage/db/schema';
import type { AuthEnv } from './types/env.js';

// Factory: creates auth instance per-request with env bindings
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
        sendMagicLink: async ({ email, token, url }) => {
          // Uses the auth worker's SMTP service — implemented in Task 4
          await (globalThis as any).__sendEmail?.({
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
  BETTER_AUTH_SECRET: 'cli-placeholder',
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
```

**Step 3: Commit**

```bash
git add apps/auth/src/
git commit -m "feat(auth): add Better Auth config with all plugins"
```

---

## Task 4: Create JWT Token Endpoint & Email Service

Custom `/token` endpoint that issues role-enriched JWTs for API consumption.

**Files:**
- Create: `apps/auth/src/lib/jwt.ts`
- Create: `apps/auth/src/lib/roles.ts`
- Create: `apps/auth/src/lib/email.ts`
- Create: `apps/auth/src/index.ts`

**Step 1: Create lib/jwt.ts — JWT signing with Web Crypto API**

```ts
function base64url(data: ArrayBuffer | string): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));

  return `${header}.${body}.${base64url(signature)}`;
}

export async function verifyJWT(
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
    base64urlDecode(sig),
    encoder.encode(`${header}.${body}`),
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
```

**Step 2: Create lib/roles.ts — Role aggregation from DB**

```ts
import type { D1Database } from '@cloudflare/workers-types';

export interface UserRoles {
  platformAdmin: boolean;
  hackathonRoles: Record<string, string[]>; // slug → [role, ...]
  workspaceRoles: Record<string, string>;   // workspace_id → role
}

export async function getUserRoles(db: D1Database, userId: string): Promise<UserRoles> {
  const [adminRow, orgRows, judgeRows, wsRows] = await Promise.all([
    db.prepare('SELECT 1 FROM platform_admins WHERE user_id = ?').bind(userId).first(),
    db.prepare(`
      SELECT h.slug, o.role FROM organizer_roles o
      JOIN hackathons h ON h.id = o.hackathon_id
      WHERE o.user_id = ?
    `).bind(userId).all(),
    db.prepare(`
      SELECT h.slug FROM judges j
      JOIN hackathons h ON h.id = j.hackathon_id
      WHERE j.user_id = ?
    `).bind(userId).all(),
    db.prepare(`
      SELECT workspace_id, role FROM workspace_members WHERE user_id = ?
    `).bind(userId).all(),
  ]);

  const hackathonRoles: Record<string, string[]> = {};

  // Organizer roles
  for (const row of (orgRows.results || []) as Array<{ slug: string; role: string }>) {
    if (!hackathonRoles[row.slug]) hackathonRoles[row.slug] = [];
    hackathonRoles[row.slug].push(row.role);
  }

  // Judge roles
  for (const row of (judgeRows.results || []) as Array<{ slug: string }>) {
    if (!hackathonRoles[row.slug]) hackathonRoles[row.slug] = [];
    if (!hackathonRoles[row.slug].includes('judge')) {
      hackathonRoles[row.slug].push('judge');
    }
  }

  const workspaceRoles: Record<string, string> = {};
  for (const row of (wsRows.results || []) as Array<{ workspace_id: string; role: string }>) {
    workspaceRoles[row.workspace_id] = row.role;
  }

  return {
    platformAdmin: !!adminRow,
    hackathonRoles,
    workspaceRoles,
  };
}
```

**Step 3: Create lib/email.ts — Minimal email for magic links**

Copy the SMTP logic from `apps/api/src/services/smtp.ts` and `email.ts`. The auth worker needs its own email capability for magic links and verification emails.

```ts
// Reuse the same SMTP implementation from apps/api/src/services/smtp.ts
// Copy sendSmtp, parseSmtpUrl, SmtpConfig, SmtpConnection from there.
// Then wrap with:

interface EmailEnv {
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  EMAIL_FROM: string;
}

export async function sendEmail(
  env: EmailEnv,
  options: { to: string; subject: string; html: string },
): Promise<boolean> {
  try {
    const config = parseSmtpUrl(env.SMTP_URL);
    config.username = env.SMTP_USERNAME;
    config.password = env.SMTP_PASSWORD;
    return await sendSmtp(
      config,
      env.EMAIL_FROM,
      [options.to],
      options.subject,
      options.html,
    );
  } catch {
    console.error('Failed to send email');
    return false;
  }
}
```

> **Note:** Copy the full `SmtpConnection`, `sendSmtp`, `parseSmtpUrl` implementations from `apps/api/src/services/smtp.ts`. Consider extracting shared email code into `packages/shared` in a future refactor.

**Step 4: Create index.ts — Main Hono app**

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AuthEnv } from './types/env.js';
import { createAuth } from './auth.js';
import { getUserRoles } from './lib/roles.js';
import { signJWT } from './lib/jwt.js';
import { sendEmail } from './lib/email.js';

const app = new Hono<AuthEnv>();

// CORS for all frontend origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'https://devsage.org',
        'https://platform.devsage.org',
        'https://shikdd.devsage.org',
      ];
      // Also allow localhost for dev
      if (allowed.includes(origin) || origin.startsWith('http://localhost:')) {
        return origin;
      }
      return '';
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
    maxAge: 600,
  }),
);

// Health check
app.get('/', (c) => c.json({ service: 'devsage-auth', ok: true }));

// Mount Better Auth handler
app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  // Wire up email sending for magic links
  const env = c.env;
  (globalThis as any).__sendEmail = (opts: { to: string; subject: string; html: string }) =>
    sendEmail(env, opts);

  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Custom token endpoint: issues role-enriched JWT for API consumption
app.get('/token', async (c) => {
  const auth = createAuth(c.env);
  const authSession = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!authSession) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const roles = await getUserRoles(c.env.DB, authSession.user.id);

  const token = await signJWT(
    {
      sub: authSession.user.id,
      email: authSession.user.email,
      name: authSession.user.name,
      image: authSession.user.image,
      platformAdmin: roles.platformAdmin,
      hackathonRoles: roles.hackathonRoles,
      workspaceRoles: roles.workspaceRoles,
    },
    c.env.JWT_SECRET,
    900, // 15 minutes
  );

  return c.json({ token });
});

export default {
  fetch: app.fetch,
};
```

**Step 5: Commit**

```bash
git add apps/auth/src/
git commit -m "feat(auth): add Hono app with Better Auth handler, JWT token endpoint, and email service"
```

---

## Task 5: Refactor API Auth Middleware

Replace the custom JWT verification with verification of tokens from the auth service.

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/src/types/env.ts`

**Step 1: Write the new auth middleware**

Replace `apps/api/src/middleware/auth.ts` entirely:

```ts
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

// Inline JWT verification (same Web Crypto approach as auth worker)
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
    base64urlDecode(sig),
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
    platformAdmin: payload.platformAdmin as boolean,
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
```

**Step 2: Update types/env.ts**

Update `UserContext` to reflect JWT-based roles. Remove auth-only secrets (SMTP, GITHUB_WEBHOOK_SECRET can stay if webhooks still need it). Add `AUTH_URL`.

```ts
import type { Hono } from 'hono';

export interface AppEnv {
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    HACKATHON_SM: DurableObjectNamespace;
    WEBHOOK_QUEUE: Queue;
    NOTIFICATION_QUEUE: Queue;
    // Secrets
    JWT_SECRET: string;
    GITHUB_WEBHOOK_SECRET: string;
    SMTP_URL: string;
    SMTP_USERNAME: string;
    SMTP_PASSWORD: string;
    SMTP_EMAIL_ADDR?: string;
    GEMINI_API_KEY?: string;
    // Vars
    NODE_ENV?: string;
    FRONTEND_URL: string;
    PLATFORM_URL: string;
    ADMIN_URL: string;
    AUTH_URL: string;
    API_URL: string;
    EMAIL_FROM: string;
    HACKATHON_ORIGIN_PATTERN?: string;
    PAGES_ORIGIN_PATTERN?: string;
  };
  Variables: {
    user: UserContext | null;
    requestId: string;
    hackathon?: HackathonContext;
    role?: HackathonRole;
  };
}

export interface UserContext {
  id: string;
  email: string;
  name: string;
  image: string | null;
  platformAdmin: boolean;
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
}

export interface HackathonContext {
  id: string;
  workspace_id: string;
  slug: string;
  status: string;
}

export type HackathonRole = 'organizer' | 'co_organizer' | 'judge' | 'leader' | 'member' | 'anonymous';
```

**Step 3: Add AUTH_URL to wrangler.jsonc**

Add `"AUTH_URL": "https://auth.devsage.org"` to the `vars` section of `apps/api/wrangler.jsonc`.

**Step 4: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/types/env.ts apps/api/wrangler.jsonc
git commit -m "refactor(api): update auth middleware for Better Auth JWT validation"
```

---

## Task 6: Remove Old Auth Code from API

**Files:**
- Delete: `apps/api/src/routes/auth.ts`
- Delete: `apps/api/src/lib/jwt.ts`
- Delete: `apps/api/src/lib/password.ts`
- Delete: `apps/api/src/lib/refresh-token.ts`
- Delete: `apps/api/src/lib/cookies.ts`
- Delete: `apps/api/src/types/auth.ts` (if it exists separately)
- Modify: `apps/api/src/index.ts`
- Update: `apps/api/src/__tests__/helpers.ts` (remove JWT import)
- Delete: `apps/api/src/__tests__/auth.test.ts` (old auth tests)

**Step 1: Delete old auth files**

```bash
rm apps/api/src/routes/auth.ts
rm apps/api/src/lib/jwt.ts
rm apps/api/src/lib/password.ts
rm apps/api/src/lib/refresh-token.ts
rm apps/api/src/lib/cookies.ts
```

**Step 2: Update index.ts — remove auth route mount**

In `apps/api/src/index.ts`:
- Remove: `import auth from './routes/auth.js';`
- Remove: `app.route('/auth', auth);`
- Keep everything else the same

**Step 3: Update test helpers**

In `apps/api/src/__tests__/helpers.ts`:
- Remove: `import { signJWT } from '../lib/jwt.js';`
- Replace test JWT signing with the inline Web Crypto approach (same as the new middleware) or mock the JWT_SECRET.

**Step 4: Delete old auth tests**

```bash
rm apps/api/src/__tests__/auth.test.ts
```

**Step 5: Verify build**

Run: `cd apps/api && pnpm build`
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add -A apps/api/
git commit -m "refactor(api): remove old custom auth system"
```

---

## Task 7: Update API Route Files for New UserContext

The `UserContext` type changed — it now has `platformAdmin`, `hackathonRoles`, `workspaceRoles` instead of the old shape. Route files that check roles via DB queries can now check JWT claims directly.

**Files to update (14 route files that import authMiddleware):**
- `apps/api/src/routes/admin.ts` — use `user.platformAdmin` instead of DB query
- `apps/api/src/routes/hackathons.ts` — use `user.hackathonRoles[slug]` for organizer checks
- `apps/api/src/routes/teams.ts`
- `apps/api/src/routes/submissions.ts`
- `apps/api/src/routes/judging.ts`
- `apps/api/src/routes/organizers.ts`
- `apps/api/src/routes/rounds.ts`
- `apps/api/src/routes/team-repos.ts`
- `apps/api/src/routes/workspaces.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/invites.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/announcements.ts`

**Step 1: For each route file**

Update role-checking logic. The `authMiddleware` import stays the same. But anywhere the code does a DB query to check if the user is an admin or organizer, replace with:

```ts
// OLD: DB query for platform admin
const admin = await env.DB.prepare('SELECT 1 FROM platform_admins WHERE user_id = ?').bind(user.id).first();
if (!admin) return c.json({ error: 'Forbidden' }, 403);

// NEW: JWT claim check
if (!user.platformAdmin) return c.json({ error: 'Forbidden' }, 403);
```

```ts
// OLD: DB query for organizer role
const role = await env.DB.prepare('SELECT role FROM organizer_roles WHERE hackathon_id = ? AND user_id = ?')
  .bind(hackathonId, user.id).first();

// NEW: JWT claim check
const roles = user.hackathonRoles[hackathonSlug] || [];
const isOrganizer = roles.includes('organizer') || roles.includes('co_organizer');
```

**Step 2: Update any references to old UserContext fields**

- `user.avatar_url` → `user.image`
- `user.github_username` → removed (available via Better Auth account table if needed)
- `user.created_at` → removed from JWT (query DB if needed)

**Step 3: Verify build**

Run: `cd apps/api && pnpm build`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/api/src/routes/
git commit -m "refactor(api): update routes to use JWT-based role checks"
```

---

## Task 8: Update Frontend Auth — Platform App

**Files:**
- Modify: `apps/platform/src/contexts/auth-context.tsx`
- Modify: `apps/platform/src/lib/api.ts`

**Step 1: Install Better Auth client in platform app**

Add to `apps/platform/package.json` dependencies:
```json
"better-auth": "^1.2.0",
"@better-auth/passkey": "^1.2.0"
```

Run: `cd apps/platform && pnpm install`

**Step 2: Create auth client**

Create `apps/platform/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient, magicLinkClient, jwtClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || 'https://auth.devsage.org',
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/2fa';
      },
    }),
    passkeyClient(),
    magicLinkClient(),
    jwtClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  twoFactor,
  passkey,
} = authClient;
```

**Step 3: Rewrite auth-context.tsx**

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authClient } from '../lib/auth-client';

interface AuthState {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  } | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isOrganizer: boolean;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_AUTH_URL || 'https://auth.devsage.org'}/token`,
        { credentials: 'include' },
      );
      if (!res.ok) return null;
      const data = await res.json();
      setToken(data.token);

      // Decode JWT payload to extract roles (no verification needed on client)
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      setIsPlatformAdmin(!!payload.platformAdmin);
      setIsOrganizer(
        Object.values(payload.hackathonRoles || {}).some((roles: any) =>
          roles.includes('organizer') || roles.includes('co_organizer'),
        ),
      );

      return data.token;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const session = await authClient.getSession();
        if (session.data?.user) {
          setUser(session.data.user);
          await refreshToken();
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshToken]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isPlatformAdmin,
        isOrganizer,
        refreshToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

**Step 4: Update api.ts to use Bearer token**

```ts
const API_URL = import.meta.env.VITE_API_URL || 'https://api.devsage.org';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token: string | null = null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new ApiError(res.status, body.error?.message || res.statusText);
  }

  return res.json();
}
```

**Step 5: Add VITE_AUTH_URL to platform's env**

Add to `apps/platform/.env` (or `.env.production`):
```
VITE_AUTH_URL=https://auth.devsage.org
VITE_API_URL=https://api.devsage.org
```

**Step 6: Commit**

```bash
git add apps/platform/
git commit -m "feat(platform): integrate Better Auth client with role-enriched JWTs"
```

---

## Task 9: Update Frontend Auth — Admin App

Same pattern as Task 8 but for `apps/admin`.

**Files:**
- Modify: `apps/admin/src/contexts/auth-context.tsx` (same as platform)
- Modify: `apps/admin/src/lib/api.ts` (same as platform)
- Create: `apps/admin/src/lib/auth-client.ts` (same as platform)

**Step 1: Install deps**

Add `better-auth` and `@better-auth/passkey` to `apps/admin/package.json`.

**Step 2: Create auth-client.ts** (identical to platform's)

**Step 3: Update auth-context.tsx** (identical to platform's)

**Step 4: Update api.ts** (identical to platform's)

**Step 5: Add env vars**

```
VITE_AUTH_URL=https://auth.devsage.org
VITE_API_URL=https://api.devsage.org
```

**Step 6: Commit**

```bash
git add apps/admin/
git commit -m "feat(admin): integrate Better Auth client with role-enriched JWTs"
```

---

## Task 10: Verify & Deploy

**Step 1: Install all deps from root**

Run: `cd /path/to/DevSage && pnpm install`

**Step 2: Build everything**

Run: `pnpm build`
Expected: All packages and apps build without errors

**Step 3: Run existing tests**

Run: `pnpm test`
Fix any test failures caused by schema/type changes.

**Step 4: Deploy auth worker secrets**

Create `apps/auth/.env.production` with:
```
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
JWT_SECRET=<same as API worker's JWT_SECRET>
GITHUB_CLIENT_ID=<from existing .env.production>
GITHUB_CLIENT_SECRET=<from existing .env.production>
GOOGLE_CLIENT_ID=<from existing .env.production>
GOOGLE_CLIENT_SECRET=<from existing .env.production>
SMTP_URL=<from existing .env.production>
SMTP_USERNAME=<from existing .env.production>
SMTP_PASSWORD=<from existing .env.production>
```

Run: `cd apps/auth && pnpm deploy:secrets`

**Step 5: Apply D1 migration**

Run: `cd packages/db && wrangler d1 migrations apply devsage-db --remote`

**Step 6: Deploy auth worker**

Run: `cd apps/auth && pnpm deploy`

**Step 7: Configure DNS**

Add a CNAME record for `auth.devsage.org` pointing to the auth worker's `*.workers.dev` URL, or configure a custom domain route in Cloudflare.

**Step 8: Deploy updated API worker**

Run: `cd apps/api && pnpm deploy`

**Step 9: Smoke test**

1. Visit `auth.devsage.org` — should return `{ service: "devsage-auth", ok: true }`
2. Test signup: POST to `auth.devsage.org/api/auth/sign-up/email`
3. Test login: POST to `auth.devsage.org/api/auth/sign-in/email`
4. Test token: GET `auth.devsage.org/token` with session cookie
5. Test API: GET `api.devsage.org/health` with Bearer token

**Step 10: Commit any fixes and tag release**

```bash
git add -A
git commit -m "feat: complete Better Auth integration"
```
