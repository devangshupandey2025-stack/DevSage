# Developer Setup

> Local development environment for the DevSage hackathon platform.

**Related docs:** [Deployment](./deployment.md) | [Secrets](./secrets.md) | [Contributing](./contributing.md) | [Architecture](./architecture/00-overview.md)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 20 | LTS recommended |
| pnpm | >= 8 | Project pins `pnpm@10.28.2` via the `packageManager` field |
| Wrangler CLI | -- | Installed as a devDependency; global install optional |
| gh CLI | -- | Required for hackathon site generation (`pnpm generate:site`) |

## Clone and Install

```bash
git clone https://github.com/qwertystars/DevSage.git
cd DevSage
pnpm install
```

`pnpm install` runs the `prepare` script automatically, which sets up Husky git hooks for secret scanning. No manual hook setup is needed.

---

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
PLATFORM_URL=http://localhost:5174
ADMIN_URL=http://localhost:5175
SMTP_URL=smtp://localhost:1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_EMAIL_ADDR=noreply@devsage.org
```

This file is gitignored and will never be committed.

### Required Secrets Reference

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | HMAC SHA-256 signing key for auth tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for verifying GitHub webhook HMAC signatures |
| `FRONTEND_URL` | Web app origin (`http://localhost:5173` locally) |
| `PLATFORM_URL` | Organizer platform origin (`http://localhost:5174` locally) |
| `ADMIN_URL` | Admin dashboard origin (`http://localhost:5175` locally) |
| `SMTP_URL` | SMTP server connection string |
| `SMTP_USERNAME` | SMTP authentication username |
| `SMTP_PASSWORD` | SMTP authentication password |
| `SMTP_EMAIL_ADDR` | Sender email address for outbound mail |

These match the `Env` interface in `apps/api/src/types/env.ts`.

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

For local email testing, use [Mailpit](https://github.com/axllent/mailpit) or [MailHog](https://github.com/mailhog/MailHog). The default `smtp://localhost:1025` works with either. Leave `SMTP_USERNAME` and `SMTP_PASSWORD` empty for local testing.

---

## Local D1 Database

Wrangler automatically creates a local D1 SQLite database on first run. Migrations are sourced from `packages/db/migrations` (configured in `apps/api/wrangler.jsonc`).

No manual migration step is needed for local development. Starting the API worker provisions the local database and applies all pending migrations.

---

## Start Development

```bash
pnpm dev
```

This starts all apps in parallel via Turborepo:

| App | URL | Source |
|-----|-----|--------|
| API | `http://localhost:8787` | `apps/api/` (Cloudflare Worker via Wrangler) |
| Web | `http://localhost:5173` | `apps/web/` (Vite dev server) |
| Platform | `http://localhost:5174` | `apps/platform/` (Vite dev server) |
| Admin | `http://localhost:5175` | `apps/admin/` (Vite dev server) |

The Vite dev servers proxy API requests (`/api/v1/*`, `/auth/*`, `/hackathons/*`, `/webhooks/*`) to `http://localhost:8787`, so the frontend apps talk to the API seamlessly during development.

To start a single app:

```bash
pnpm --filter @devsage/api dev        # API only
pnpm --filter @devsage/web dev        # Web only
pnpm --filter @devsage/platform dev   # Platform only
pnpm --filter @devsage/admin dev      # Admin only
```

---

## Running Tests

```bash
pnpm test                          # All tests (via Turborepo)
pnpm --filter @devsage/api test    # API tests only
pnpm --filter @devsage/web test    # Web tests only
```

API tests use `@cloudflare/vitest-pool-workers` and run inside the Workers runtime with real D1, KV, and Durable Object bindings. Web tests use jsdom with `@testing-library/react`.

---

## Type Checking and Linting

```bash
pnpm typecheck    # TypeScript strict checking across all packages
pnpm lint         # ESLint flat config (ESLint 9+)
```

Both commands run across the entire monorepo via Turborepo.

---

## Creating a Test Hackathon Site

The CLI tool generates a new hackathon site from the template at `templates/hackathon-site/`:

```bash
pnpm generate:site --config "$(echo '{"slug":"hack001","title":"Hack 001"}' | base64)"
```

This copies the template, writes `site.config.json` and `wrangler.jsonc`, installs dependencies, builds the site, creates a GitHub repo under `SHIKDD-org/{slug}-site`, and deploys to Cloudflare Workers.

Prerequisites: `gh` CLI authenticated (`gh auth login`) and Wrangler authenticated (`wrangler login`).

Run `pnpm generate:site --help` for the full list of config fields.

---

## Secret Scanning

DevSage enforces secret scanning at multiple stages:

- **Pre-commit hook:** `secretlint` scans all staged files. Commits containing secrets are blocked.
- **Pre-push hook:** Full repository scan runs before any push.
- **Manual scan:** `pnpm secrets:scan` (full repo) or `pnpm secrets:staged` (staged files only).

See [secrets.md](./secrets.md) for the full secret handling conventions.

---

## Troubleshooting

**"wrangler not found"** -- Wrangler is a devDependency of `@devsage/api`. Run commands from `apps/api/` or use `pnpm --filter @devsage/api exec wrangler ...`. Do not run wrangler from the repo root.

**D1 migration errors** -- Verify that `packages/db/migrations` exists and contains `.sql` files. The migration path in `apps/api/wrangler.jsonc` is relative: `../../packages/db/migrations`.

**OAuth callback errors** -- Ensure `FRONTEND_URL` in `.dev.vars` matches your Vite dev server origin exactly (`http://localhost:5173`). Confirm the callback URLs registered with GitHub/Google match `http://localhost:8787/auth/callback/{provider}`.

**Port conflicts** -- The API defaults to port 8787, web to 5173, platform to 5174, admin to 5175. If any port is in use, stop the conflicting process.

**Husky hooks not running** -- Run `pnpm install` again to re-trigger the `prepare` script. Verify that `.husky/` contains the hook files.
