# Better Auth Integration Design

## Overview

Replace the custom JWT/refresh-token auth system with Better Auth, deployed as a dedicated Cloudflare Worker at `auth.devsage.org`. Add 2FA (TOTP), magic links, passkeys, and GitHub/Google OAuth.

## Architecture

```
Frontend apps (platform.*, shikd.*, devsage.org)
    │
    ├─ Auth operations ──► auth.devsage.org (Better Auth worker)
    │                       • Login/signup (email, OAuth, magic link, passkey)
    │                       • 2FA enrollment & verification
    │                       • Session management
    │                       • JWT issuance with role claims
    │
    └─ API calls ──────► api.devsage.org (Hono worker)
         Bearer JWT          • JWT validation (shared secret, no DB)
                             • Business logic only
                             │
                        ┌────┴────┐
                        │ D1 (SQLite) │
                        │ devsage-db  │
                        └─────────────┘
                     (shared by both workers)
```

Both workers bind to the same D1 database.

## Two-Token System

1. **Session cookie** — `auth.devsage.org` domain, HttpOnly, managed by Better Auth. Used for auth operations.
2. **Access JWT** — 15-minute expiry Bearer token for `api.devsage.org`. Contains identity + role claims. Frontend caches and refreshes automatically.

### JWT Payload

```json
{
  "sub": "user-id",
  "platformAdmin": true,
  "hackathonRoles": { "hack-slug": "organizer" },
  "workspaceRoles": { "ws-id": "owner" },
  "exp": 1234567890
}
```

Roles aggregated from `platform_admins`, `organizer_roles`, `judges`, `workspace_members` at token issuance. Stale for at most 15 minutes.

## New App: `apps/auth`

Cloudflare Worker at `auth.devsage.org`.

### Dependencies

- `better-auth` — core
- `@better-auth/passkey` — WebAuthn
- `drizzle-orm` — D1 adapter
- `hono` — HTTP handler

### Better Auth Config

```ts
betterAuth({
  baseURL: "https://auth.devsage.org",
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  plugins: [
    twoFactor({ issuer: "DevSage" }),
    magicLink({ sendMagicLink: /* SMTP integration */ }),
    passkey(),
    jwt({ expirationTime: "15m" }),
  ],
  advanced: {
    crossSubDomainCookies: { enabled: true, domain: ".devsage.org" },
  },
})
```

### Wrangler Config

```jsonc
{
  "name": "auth",
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "devsage-db", "database_id": "dddf6034-..." }],
  "vars": {
    "AUTH_URL": "https://auth.devsage.org",
    "FRONTEND_URL": "https://devsage.org",
    "PLATFORM_URL": "https://platform.devsage.org",
    "ADMIN_URL": "https://shikdd.devsage.org"
  }
}
```

## API Changes (`apps/api`)

### Remove

- `src/routes/auth.ts` — all auth endpoints
- `src/lib/jwt.ts`, `password.ts`, `refresh-token.ts`, `cookies.ts`
- `src/types/auth.ts` partially

### Replace

**`middleware/auth.ts`** — verify Better Auth JWTs using shared secret instead of custom JWT verification. Extract roles from JWT claims.

### Update

- `UserContext` type — include role fields from JWT
- All route files — use JWT-derived roles instead of DB lookups for permission checks

## Database Schema Changes

### Better Auth Creates

- `user` — replaces `users`
- `session` — replaces `refresh_tokens`
- `account` — OAuth provider links
- `verification` — email verification, magic link tokens
- `twoFactor` — TOTP secrets, backup codes
- `passkey` — WebAuthn credentials

### We Remove

- `users` schema (replaced by Better Auth `user`)
- `refresh_tokens` schema (replaced by Better Auth `session`)
- `deletion_requests` schema (Better Auth handles account lifecycle)

### We Keep (FK update)

All business tables — update foreign keys from `users.id` → `user.id`.

## Frontend Auth Clients

For `platform.*` and `shikd.*`:

```ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient, passkeyClient, magicLinkClient, jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "https://auth.devsage.org",
  plugins: [
    twoFactorClient({ onTwoFactorRedirect: () => navigate("/2fa") }),
    passkeyClient(),
    magicLinkClient(),
    jwtClient(),
  ],
});
```

API calls: `authClient.token()` → cache JWT → send as `Authorization: Bearer <token>`.

## CORS

Auth worker allows origins: `https://devsage.org`, `https://platform.devsage.org`, `https://shikdd.devsage.org`, `https://*.hackathon.devsage.org`.

Cross-subdomain cookies via `domain: ".devsage.org"` in Better Auth's advanced config.
