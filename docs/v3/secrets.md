# Secrets Management

> How DevSage handles secrets across local development, CI, and production.

**Related docs:** [Developer Setup](./setup.md) | [Deployment](./deployment.md)

---

## Overview

API secrets live in two places depending on the environment:

| Environment | Location | Format |
|-------------|----------|--------|
| Local dev | `apps/api/.dev.vars` | Key-value pairs, read by Wrangler |
| Production | Cloudflare Worker secrets | Uploaded via `wrangler secret put` or `wrangler secret bulk` |

Web apps (`apps/web`, `apps/platform`, `apps/admin`) use only `VITE_*` environment variables. These are client-visible and embedded in the build output. Never put secrets in `VITE_*` variables.

---

## Required API Secrets

| Secret | Description | Example (local) |
|--------|-------------|-----------------|
| `JWT_SECRET` | HMAC SHA-256 signing key for auth tokens | `dev-jwt-secret-change-in-prod` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | From Google Cloud Console |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | From GitHub Developer Settings |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for verifying GitHub webhook HMAC signatures | Any random string |
| `FRONTEND_URL` | Web app origin | `http://localhost:5173` |
| `PLATFORM_URL` | Organizer platform origin | `http://localhost:5174` |
| `ADMIN_URL` | Admin dashboard origin | `http://localhost:5175` |
| `SMTP_URL` | SMTP server connection string | `smtp://localhost:1025` |
| `SMTP_USERNAME` | SMTP authentication username | (empty for local) |
| `SMTP_PASSWORD` | SMTP authentication password | (empty for local) |
| `SMTP_EMAIL_ADDR` | Sender email address for outbound mail | `noreply@devsage.org` |

These match the `Env` interface in `apps/api/src/types/env.ts` and the bindings in `apps/api/wrangler.jsonc`.

---

## Local Development

Create `apps/api/.dev.vars`:

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

Wrangler reads this file automatically during `wrangler dev`. The file is gitignored.

---

## Production Secrets

Upload secrets to Cloudflare using either method:

**Bulk upload** (from a file):

```bash
pnpm deploy:api:secrets
```

This runs `wrangler secret bulk .env.production` from `apps/api/`. Create `apps/api/.env.production` with production values first. This file is gitignored.

**Individual upload:**

```bash
cd apps/api
wrangler secret put JWT_SECRET
```

Each command prompts for the value interactively.

---

## What is Gitignored

The `.gitignore` blocks common secret files:

- `.env*` (all `.env` variants)
- `.dev.vars`
- `.wrangler/` (Wrangler local state)

**Exception:** `apps/web/.env.production` is committed because it contains only `VITE_API_ORIGIN` (a public URL, not a secret).

---

## Secret Scanning

DevSage enforces secret scanning at three levels to prevent accidental credential leaks:

### Pre-Commit Hook

`secretlint` scans all staged files before every commit. If a secret pattern is detected, the commit is blocked with an error message identifying the file and line.

### Pre-Push Hook

A full repository scan runs before any push. Pushes are blocked if secrets are detected anywhere in the working tree.

### CI Pipeline

`gitleaks` runs on every PR and push to master via `.github/workflows/secret-scan.yml`. PRs with detected secrets cannot be merged.

### Manual Scanning

```bash
pnpm secrets:scan      # Full repo scan
pnpm secrets:staged    # Scan staged files only
```

---

## If You Accidentally Commit a Secret

1. **Rotate immediately.** Assume the secret is compromised, even if the commit was not pushed.
2. **Revoke the old value** in the relevant service (GitHub, Google, SMTP provider).
3. **Generate a new secret** and update it in `.dev.vars` (local) and Cloudflare (production).
4. **Remove from history** if the commit was pushed. Coordinate with maintainers -- history rewrites affect all contributors.

---

## Per-Environment Isolation

Secrets are never shared between environments:

| Environment | Secret Source | Shared |
|-------------|--------------|--------|
| Local dev | `apps/api/.dev.vars` | Never |
| Dev deploy | Cloudflare secrets (`--env dev`) | Never |
| Production | Cloudflare secrets (top-level) | Never |

Each environment should have independently generated values. Use different OAuth apps for local dev vs. production.
