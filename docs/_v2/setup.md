# Developer Setup Guide

This guide walks you through setting up a local DevSage development environment from scratch.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 20 | LTS recommended |
| pnpm | >= 8 | Project pins pnpm@10.28.2 via `packageManager` field |
| Cloudflare account | Free tier | Required for Wrangler CLI authentication |
| GitHub account | -- | Needed for OAuth testing and contributions |
| Wrangler CLI | -- | Installed as a devDependency; global install optional |

## Clone and Install

```bash
git clone https://github.com/qwertystars/DevSage.git
cd DevSage
pnpm install
```

`pnpm install` triggers the `prepare` script automatically, which sets up Husky git hooks for secret scanning and lint checks. No manual hook setup is needed.

## Configure API Secrets

Create the file `apps/api/.dev.vars` with the following variables:

```
JWT_SECRET=dev-jwt-secret-change-in-prod
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret
FRONTEND_URL=http://localhost:5173
SMTP_URL=smtp://localhost:1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_EMAIL_ADDR=noreply@devsage.org
```

This file is gitignored and will never be committed.

### Obtaining OAuth Credentials

**GitHub OAuth App:**

1. Go to GitHub > Settings > Developer Settings > OAuth Apps.
2. Click "New OAuth App".
3. Set the homepage URL to `http://localhost:5173`.
4. Set the authorization callback URL to `http://localhost:8787/auth/callback/github`.
5. Copy the Client ID and Client Secret into `.dev.vars`.

**Google OAuth Credentials:**

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to APIs & Services > Credentials.
3. Create an OAuth 2.0 Client ID (Web application type).
4. Add `http://localhost:5173` to authorized JavaScript origins.
5. Add `http://localhost:8787/auth/callback/google` to authorized redirect URIs.
6. Copy the Client ID and Client Secret into `.dev.vars`.

**SMTP (optional for local dev):**

For local email testing, use a tool like [Mailpit](https://github.com/axllent/mailpit) or [MailHog](https://github.com/mailhog/MailHog). The default `smtp://localhost:1025` works with either. Leave `SMTP_USERNAME` and `SMTP_PASSWORD` empty for local testing.

## Set Up Local D1 Database

Wrangler automatically creates a local D1 SQLite database on first run. Migrations are sourced from `packages/db/migrations` (configured in `apps/api/wrangler.jsonc`).

```bash
# Start the API worker locally -- this provisions the local D1 and applies migrations
pnpm --filter @devsage/api dev
```

No manual migration step is needed for local development.

## Start Development

```bash
pnpm dev
```

This starts both services in parallel via Turborepo:

- **API** on `http://localhost:8787` (Cloudflare Worker via Wrangler)
- **Web** on `http://localhost:5173` (Vite dev server)

The Vite dev server proxies API requests (`/api/v1/*`, `/auth`, `/hackathons`, `/webhooks`) to `http://localhost:8787`, so the frontend talks to the API seamlessly during development.

## Running Tests

```bash
pnpm test                          # All tests (via Turborepo)
pnpm --filter @devsage/api test    # API tests only
pnpm --filter @devsage/web test    # Web tests only
```

API tests use `@cloudflare/vitest-pool-workers` and run inside the Workers runtime with real D1, KV, and Durable Object bindings. Web tests use jsdom with `@testing-library/react`.

## Type Checking and Linting

```bash
pnpm typecheck    # TypeScript strict checking across all packages
pnpm lint         # ESLint flat config (ESLint 9+)
```

Both commands run across the entire monorepo via Turborepo.

## Secret Scanning

DevSage enforces secret scanning at multiple stages to prevent accidental credential leaks:

- **Pre-commit hook:** `secretlint` scans all staged files. Commits containing secrets are blocked.
- **Pre-push hook:** A full repository scan runs before any push. Pushes are blocked if secrets are detected.
- **Manual scan:** Run `pnpm secrets:scan` for a full repo scan, or `pnpm secrets:staged` to scan only staged files.

See [secrets.md](./secrets.md) for the full secret handling conventions.

## Troubleshooting

**"wrangler not found"**
Wrangler is a devDependency of `@devsage/api`. Run commands from `apps/api/` or use `pnpm --filter @devsage/api exec wrangler ...`. Do not run wrangler from the repo root -- there is no `wrangler.jsonc` there.

**D1 migration errors**
Verify that `packages/db/migrations` exists and contains `.sql` files. The migration path in `apps/api/wrangler.jsonc` is relative: `../../packages/db/migrations`.

**OAuth callback errors**
Ensure `FRONTEND_URL` in `.dev.vars` matches your Vite dev server origin exactly (`http://localhost:5173`). Also confirm the callback URLs registered with GitHub/Google match.

**Port conflicts**
The API defaults to port 8787 and the web app to port 5173. If either port is in use, stop the conflicting process or configure an alternative port in the respective config.

**Husky hooks not running**
Run `pnpm install` again to re-trigger the `prepare` script. Verify that `.husky/` contains the hook files.
