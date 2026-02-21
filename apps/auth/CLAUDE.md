# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/auth

Cloudflare Worker running the authentication service at `auth.devsage.org` (port 8788). Uses `better-auth` for session management, OAuth, magic links, passkeys, and 2FA. Issues role-enriched JWTs consumed by the API worker.

## Commands

```bash
# From repo root
pnpm --filter @devsage/auth run dev       # wrangler dev on port 8788
pnpm --filter @devsage/auth run deploy    # Deploy to Cloudflare
pnpm --filter @devsage/auth run build     # Type-check (tsc --noEmit)
```

## Source Layout

```
src/
├── index.ts              # Hono app — health check, better-auth handler, /token endpoint
├── auth.ts               # better-auth configuration (plugins, OAuth, email, trusted origins)
├── lib/
│   ├── jwt.ts            # Custom HS256 JWT sign/verify via crypto.subtle
│   └── roles.ts          # getUserRoles() — queries DB for platform admin, hackathon, workspace roles
├── services/
│   ├── email.ts          # Email composition (magic links, verification)
│   └── smtp.ts           # Minimal SMTP client using Cloudflare Sockets API
└── types/
    └── env.ts            # AuthEnv bindings interface
```

## Architecture

### better-auth Configuration (`src/auth.ts`)
- **Plugins**: twoFactor (TOTP), magicLink, passkey (WebAuthn), jwt
- **OAuth providers**: GitHub, Google
- **Email/password**: Enabled
- **Database**: Drizzle adapter on D1 with better-auth schema tables (`user`, `session`, `account`, `verification`, `twoFactor`, `passkey`)
- **Trusted origins**: `devsage.org`, `platform.devsage.org`, `shikdd.devsage.org`
- **Cross-subdomain cookies**: Enabled on `.devsage.org`

### Endpoints
- `GET /` — Health check
- `ALL /api/auth/**` — Delegated to better-auth (login, signup, OAuth callbacks, 2FA, magic links, etc.)
- `GET /token` — Custom endpoint: requires active better-auth session, queries roles from DB, returns a 15-min JWT containing `{ sub, email, name, image, platformAdmin, hackathonRoles, workspaceRoles }`

### Role-Enriched JWT (`/token`)
The `/token` endpoint is the bridge between auth and API:
1. Validates the better-auth session cookie
2. Calls `getUserRoles(db, userId)` which queries `platform_admins`, `organizer_roles`, `judges`, and `workspace_members` tables
3. Signs a 15-min JWT with all role data embedded
4. Frontend stores this token and sends it as `Authorization: Bearer` to the API worker

### SMTP
Custom minimal SMTP client (no npm packages) using `cloudflare:sockets`. Supports direct TLS (465) and STARTTLS (587) with fallback. 15-second timeout.

## Wrangler Configuration
- **D1 binding**: `DB` (same `devsage-db` database as the API worker)
- **Secrets**: `BETTER_AUTH_SECRET`, `JWT_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `SMTP_*`
- **Vars**: `AUTH_URL`, `FRONTEND_URL`, `PLATFORM_URL`, `ADMIN_URL`, `API_URL`, `EMAIL_FROM`
- **Compatibility**: Node.js compatibility flag enabled

## Key Patterns

- better-auth manages its own tables (`user`, `session`, `account`, etc.) — don't manually write to these
- Role queries in `lib/roles.ts` read from business tables (`platform_admins`, `organizer_roles`, `judges`, `workspace_members`) which are managed by the API worker
- JWT signing uses the same `JWT_SECRET` as the API worker for verification
- CORS configured for cross-subdomain auth (all three frontend origins)
