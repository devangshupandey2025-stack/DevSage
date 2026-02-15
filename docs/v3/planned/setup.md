# Developer Setup Guide

> Complete local environment setup with Docker Compose for dependencies, automated seed data, VS Code workspace configuration, and multi-service development — everything you need from clone to running hackathon in under 10 minutes.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone and Install](#clone-and-install)
3. [Environment Configuration](#environment-configuration)
4. [Docker Compose (Optional)](#docker-compose-optional)
5. [Database Setup](#database-setup)
6. [Seed Data](#seed-data)
7. [Start Development](#start-development)
8. [VS Code Configuration](#vs-code-configuration)
9. [Running Tests](#running-tests)
10. [Type Checking and Linting](#type-checking-and-linting)
11. [Secret Scanning](#secret-scanning)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Required | Notes |
|------|---------|----------|-------|
| Node.js | >= 20 | Yes | LTS recommended. Required for all packages |
| pnpm | >= 10 | Yes | Pinned via `packageManager` field in root `package.json` |
| Docker + Docker Compose | Latest | Optional | For local SMTP, Redis, and other service dependencies |
| Cloudflare account | Free tier | Yes | Required for Wrangler CLI authentication |
| GitHub account | — | Yes | Needed for OAuth testing and contributions |
| Git | >= 2.40 | Yes | Worktree support for parallel development |

### Install pnpm

```bash
# Using corepack (recommended — bundled with Node.js 20+)
corepack enable
corepack prepare pnpm@latest --activate

# Or standalone install
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### Authenticate Wrangler

```bash
npx wrangler login
```

This opens a browser for OAuth. Credentials are stored locally in `~/.wrangler/`. No API tokens needed.

---

## Clone and Install

```bash
git clone https://github.com/SHIKDD-org/DevSage.git
cd DevSage
pnpm install
```

`pnpm install` automatically:
- Installs all workspace dependencies
- Runs the `prepare` script (sets up Husky git hooks)
- Configures pre-commit hooks for secret scanning and lint checks

### Repository Structure After Clone

```
DevSage/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono API
│   └── web/          # React SPA — Vite
├── packages/
│   ├── config/       # Shared tsconfig + ESLint config
│   ├── db/           # Drizzle ORM schemas + migrations
│   └── shared/       # Zod schemas, types, constants
├── docs/             # Documentation
├── turbo.json        # Turborepo pipeline configuration
├── pnpm-workspace.yaml
└── package.json      # Root workspace config
```

---

## Environment Configuration

### API Secrets (`.dev.vars`)

Create `apps/api/.dev.vars` with the following variables:

```env
# Authentication
JWT_SECRET=dev-jwt-secret-minimum-32-characters-long
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_WEBHOOK_SECRET=dev-webhook-secret

# Frontend URL (must match Vite dev server)
FRONTEND_URL=http://localhost:5173

# Email (local SMTP via Docker Compose or Mailpit)
SMTP_URL=smtp://localhost:1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_EMAIL_ADDR=noreply@devsage.local

# AI Provider (optional — for AI-assisted code reviews)
AI_PROVIDER_API_KEY=
AI_PROVIDER_MODEL=

# Analytics (optional)
POSTHOG_API_KEY=
```

This file is gitignored. Never commit secrets.

### Quick Setup Script

```bash
# Copy the template and fill in your values
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

### Obtaining OAuth Credentials

**GitHub OAuth App:**

1. Go to GitHub → Settings → Developer Settings → OAuth Apps
2. Click "New OAuth App"
3. Homepage URL: `http://localhost:5173`
4. Authorization callback URL: `http://localhost:8787/auth/callback/github`
5. Copy Client ID and Client Secret to `.dev.vars`

**Google OAuth Credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized JavaScript origins: `http://localhost:5173`
5. Authorized redirect URIs: `http://localhost:8787/auth/callback/google`
6. Copy Client ID and Client Secret to `.dev.vars`

### Web Environment

The web app uses `apps/web/.env.development`:

```env
VITE_API_ORIGIN=http://localhost:8787
VITE_WS_ORIGIN=ws://localhost:8787
VITE_APP_ENV=development
```

This file is committed to the repository (no secrets — only `VITE_*` public values).

---

## Docker Compose (Optional)

Docker Compose provides local service dependencies (SMTP, etc.) without manual installation.

### docker-compose.yml

```yaml
version: '3.8'
services:
  # Local SMTP server with web UI for viewing sent emails
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  # (Future) Redis for session caching, rate limiting
  # redis:
  #   image: redis:7-alpine
  #   ports:
  #     - "6379:6379"
```

### Start Services

```bash
docker compose up -d
```

**Mailpit Web UI**: Open `http://localhost:8025` to view all emails sent by the local API.

### Without Docker

If you prefer not to use Docker:
- **SMTP**: Install [Mailpit](https://github.com/axllent/mailpit) standalone, or leave SMTP unconfigured (email features won't work locally)
- All other services (D1, KV, Durable Objects, Queues) are provided by Wrangler's local emulation

---

## Database Setup

### Local D1 (Automatic)

Wrangler automatically creates a local D1 SQLite database on first run. Migrations from `packages/db/migrations` are applied automatically.

```bash
# Start the API to provision local D1 and apply migrations
pnpm --filter @devsage/api dev
```

No manual migration step needed for local development.

### Manual Migration (if needed)

```bash
# Generate a new migration after schema changes
pnpm --filter @devsage/db drizzle-kit generate

# Apply migrations to remote D1 (production)
pnpm --filter @devsage/api exec wrangler d1 migrations apply devsage-db --remote
```

---

## Seed Data

### Quick Seed

The seed script populates the local D1 with sample data for development:

```bash
pnpm seed
```

This creates:
- **3 sample hackathons** (one in each phase: draft, active, completed)
- **10 sample users** with various roles
- **5 teams** with members across the active hackathon
- **3 submissions** with validation results
- **Sample judging scores** and leaderboard data
- **Announcement and notification records**
- **Sponsor entries** with tier configurations

### Seed Accounts

| Username | Role | Password/Auth |
|----------|------|---------------|
| `admin@devsage.local` | Platform admin (super_admin) | OAuth bypass in dev mode |
| `organizer@devsage.local` | Hackathon organizer | OAuth bypass in dev mode |
| `judge1@devsage.local` | Judge | OAuth bypass in dev mode |
| `participant1@devsage.local` | Team lead | OAuth bypass in dev mode |

In development mode, a dev-only auth endpoint allows logging in as any seed user without OAuth:

```
POST /auth/dev-login
{ "email": "admin@devsage.local" }
```

This endpoint is disabled in production builds.

### Reset Seed Data

```bash
pnpm seed:reset   # Drops all data and re-seeds
```

---

## Start Development

```bash
pnpm dev
```

This starts all services in parallel via Turborepo:

| Service | URL | Description |
|---------|-----|-------------|
| API Worker | `http://localhost:8787` | Hono API + Durable Objects + Queue consumer |
| Web SPA | `http://localhost:5173` | React app via Vite dev server |
| Mailpit UI | `http://localhost:8025` | Email viewer (if Docker Compose running) |

### Dev Proxy

Vite automatically proxies API requests to the local Worker:

| Path Prefix | Proxy Target | Purpose |
|-------------|-------------|---------|
| `/api/v1/` | `http://localhost:8787` | REST API endpoints |
| `/auth/` | `http://localhost:8787` | OAuth flows |
| `/ws/` | `ws://localhost:8787` | WebSocket connections |
| `/webhooks/` | `http://localhost:8787` | Webhook endpoints |

### Start Individual Services

```bash
pnpm --filter @devsage/api dev    # API only
pnpm --filter @devsage/web dev    # Web only
```

### Hot Module Replacement

- **Web**: Vite HMR — changes appear instantly without page reload
- **API**: Wrangler watches for changes and restarts the Worker automatically

---

## VS Code Configuration

### Recommended Extensions

Create `.vscode/extensions.json` (committed to repo):

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer",
    "unifiedjs.vscode-mdx",
    "redhat.vscode-yaml",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Workspace Settings

Create `.vscode/settings.json` (committed to repo):

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.defaultFormatter": "dbaeumer.vscode-eslint",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.workingDirectories": [
    { "pattern": "apps/*" },
    { "pattern": "packages/*" }
  ],
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.associations": {
    "*.jsonc": "jsonc"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.wrangler": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["--run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/apps/api",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Web Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["--run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/apps/web",
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Running Tests

```bash
pnpm test                          # All tests (via Turborepo)
pnpm --filter @devsage/api test    # API tests only
pnpm --filter @devsage/web test    # Web tests only
pnpm --filter @devsage/shared test # Shared package tests
```

### API Tests

API tests use `@cloudflare/vitest-pool-workers` and run inside the Workers runtime with real D1, KV, and Durable Object bindings. Test secrets are configured in the miniflare bindings config.

```bash
# Run with coverage
pnpm --filter @devsage/api test -- --coverage

# Run specific test file
pnpm --filter @devsage/api test -- src/__tests__/auth.test.ts

# Watch mode
pnpm --filter @devsage/api test -- --watch
```

### Web Tests

Web tests use jsdom with `@testing-library/react`.

```bash
# Run with coverage
pnpm --filter @devsage/web test -- --coverage

# Run specific test
pnpm --filter @devsage/web test -- src/__tests__/Dashboard.test.tsx
```

---

## Type Checking and Linting

```bash
pnpm typecheck    # TypeScript strict checking across all packages
pnpm lint         # ESLint flat config (ESLint 9+)
pnpm lint:fix     # Auto-fix lint issues
```

Both commands run across the entire monorepo via Turborepo.

---

## Secret Scanning

DevSage enforces secret scanning at multiple stages:

| Stage | Tool | Behavior |
|-------|------|----------|
| Pre-commit | `secretlint` | Scans staged files. Blocks commits containing secrets |
| Pre-push | `secretlint` | Full repo scan. Blocks pushes if secrets detected |
| CI | `gitleaks` | Runs on every PR and push to `main` |
| Manual | `secretlint` | On-demand scanning |

```bash
pnpm secrets:scan     # Full repo scan
pnpm secrets:staged   # Scan staged files only
```

See [secrets.md](./secrets.md) for full conventions.

---

## Troubleshooting

### Common Issues

**"wrangler not found"**

Wrangler is a devDependency of `@devsage/api`. Run commands from `apps/api/` or use `pnpm --filter @devsage/api exec wrangler ...`. Do not run wrangler from the repo root.

**D1 migration errors**

Verify that `packages/db/migrations` exists and contains `.sql` files. The migration path in `apps/api/wrangler.jsonc` is relative: `../../packages/db/migrations`.

**OAuth callback errors**

Ensure `FRONTEND_URL` in `.dev.vars` matches your Vite dev server origin exactly (`http://localhost:5173`). Confirm callback URLs registered with GitHub/Google match.

**Port conflicts**

| Service | Default Port | Alternative |
|---------|-------------|-------------|
| API Worker | 8787 | Set `--port` in wrangler dev command |
| Web SPA | 5173 | Set `--port` in vite config |
| Mailpit SMTP | 1025 | Change in docker-compose.yml |
| Mailpit UI | 8025 | Change in docker-compose.yml |

**Husky hooks not running**

Run `pnpm install` to re-trigger the `prepare` script. Verify `.husky/` contains hook files.

**Seed data not loading**

Ensure the API is running (`pnpm --filter @devsage/api dev`) before running `pnpm seed`. The seed script connects to the local D1 database via the running Worker.

**WebSocket connection refused in dev**

Check that the Vite proxy configuration includes the `/ws/` prefix. Ensure the API Worker is running on port 8787.

**TypeScript errors in VS Code but not in terminal**

Restart the TypeScript server: Cmd+Shift+P → "TypeScript: Restart TS Server". Ensure VS Code is using the workspace TypeScript version (check bottom-right status bar).
