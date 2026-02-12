# Production Deployment

DevSage deploys entirely to Cloudflare: the API runs as a Cloudflare Worker and the web app is served via Workers Static Assets. This guide covers both.

## Overview

| Component | Platform | Command |
|-----------|----------|---------|
| API | Cloudflare Worker (Hono + D1 + Durable Objects + Queues) | `pnpm deploy:api` |
| Web | Cloudflare Workers Static Assets (Vite build) | `pnpm deploy:web` |

Production URLs:
- Web: `https://devsage.org`
- API: `https://api.devsage.org`

## First-Time Cloudflare Setup

### Authenticate

```bash
wrangler login
```

This opens a browser for OAuth authentication. No API tokens are needed -- Wrangler stores credentials locally.

### Create the D1 Database

```bash
wrangler d1 create devsage-db
```

This outputs a `database_id`. Update the D1 binding in `apps/api/wrangler.jsonc` with this value.

### Run Migrations

```bash
wrangler d1 migrations apply devsage-db --remote
```

Migrations are located in `packages/db/migrations`. The migration path is configured in `apps/api/wrangler.jsonc` as a relative path (`../../packages/db/migrations`).

## Deploy API

From the repository root:

```bash
# Production deployment
pnpm deploy:api

# Dev environment deployment
pnpm deploy:api:dev
```

This runs `pnpm --filter @devsage/api deploy`, which invokes `wrangler deploy` from the `apps/api/` directory.

Important: Never run `wrangler deploy` from the repo root. There is no `wrangler.jsonc` at the root level.

## Upload API Secrets

Production secrets must be uploaded to Cloudflare separately from the code deployment.

### Bulk Upload

Create an `apps/api/.env.production` file with all production values, then run:

```bash
pnpm deploy:api:secrets
```

### Individual Secrets

```bash
cd apps/api
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_WEBHOOK_SECRET
wrangler secret put FRONTEND_URL
wrangler secret put SMTP_URL
wrangler secret put SMTP_USERNAME
wrangler secret put SMTP_PASSWORD
wrangler secret put SMTP_EMAIL_ADDR
```

Each command prompts for the secret value interactively.

### Required Production Secrets

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | HMAC SHA-256 signing key for auth tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for verifying GitHub webhook payloads |
| `FRONTEND_URL` | Production frontend origin (e.g., `https://devsage.org`) |
| `SMTP_URL` | SMTP server connection string |
| `SMTP_USERNAME` | SMTP authentication username |
| `SMTP_PASSWORD` | SMTP authentication password |
| `SMTP_EMAIL_ADDR` | Sender email address for outbound mail |

Never commit `.env.production` to version control. It is gitignored by default.

## Deploy Web

```bash
pnpm deploy:web
```

This runs the build step (`tsc --noEmit && vite build`) followed by `wrangler deploy` from `apps/web/`.

The production environment file `apps/web/.env.production` is committed to the repository. It contains only client-visible `VITE_*` variables (e.g., `VITE_API_ORIGIN=https://api.devsage.org`). Never place secrets in web environment variables.

## DNS Setup

Configure DNS records in your Cloudflare dashboard:

| Record | Name | Target |
|--------|------|--------|
| CNAME or Worker Route | `devsage.org` | Web Worker |
| CNAME or Worker Route | `api.devsage.org` | API Worker |

Exact configuration depends on your Cloudflare zone setup. Both Workers are bound to custom domains via the Cloudflare dashboard or `wrangler.jsonc` route configuration.

## Environment Configuration

The API Worker supports multiple environments defined in `apps/api/wrangler.jsonc`:

- **Production** (top-level config): Used by `pnpm deploy:api`.
- **Dev** (`env.dev` section): Used by `pnpm deploy:api:dev`. Has its own D1 database binding and separate secrets.

Key configuration in `wrangler.jsonc`:
- `account_id`: Baked into the config file (no environment variable needed).
- `d1_databases`: Binds the D1 database with the migration path.
- `durable_objects`: Declares all Durable Object bindings.
- `queues`: Configures producer and consumer bindings.
- `observability.enabled`: Set to `true` for production logging.

## Monitoring

**Logs:**
View real-time logs from a deployed Worker:

```bash
cd apps/api
wrangler tail
```

Or use the Cloudflare dashboard under Workers & Pages > your worker > Logs.

**Observability:**
Observability is enabled in `wrangler.jsonc`. Cloudflare captures request logs, exceptions, and performance metrics automatically.

**Cron Triggers:**
A cron trigger runs hourly to process deadline checks. This is configured in `wrangler.jsonc` under the `triggers` section.

## Rollback

Cloudflare Workers support instant rollback via the dashboard. Navigate to Workers & Pages > your worker > Deployments, and roll back to any previous deployment.

## CI/CD Notes

- `gitleaks` runs on every PR and push to master in CI to catch leaked secrets.
- Deployment is currently manual via the `pnpm deploy:*` commands.
- Ensure all secrets are uploaded before the first production deployment.
