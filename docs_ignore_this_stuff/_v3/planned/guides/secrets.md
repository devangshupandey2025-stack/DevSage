# Secret Management

> How secrets are stored, scanned, and rotated in DevSage.

## Secret Locations

| Context | Location | Format |
|---------|----------|--------|
| API dev | `apps/api/.dev.vars` | `KEY=value` (gitignored) |
| API prod | Cloudflare Workers secrets | `wrangler secret put KEY` |
| Frontend | `apps/web/.env.production` | `VITE_*` only (committed, public) |

## Required Secrets

| Secret | Purpose | Where |
|--------|---------|-------|
| `JWT_SECRET` | HMAC SHA-256 signing key (≥32 chars) | API |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID | API |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | API |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | API |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | API |
| `GITHUB_WEBHOOK_SECRET` | HMAC webhook verification | API |
| `FRONTEND_URL` | `https://devsage.org` | API |
| `PLATFORM_URL` | `https://platform.devsage.org` | API |
| `ADMIN_URL` | `https://shikdd.devsage.org` | API |
| `SMTP_URL` | SMTP server URL | API |
| `SMTP_USERNAME` | SMTP auth username | API |
| `SMTP_PASSWORD` | SMTP auth password | API |
| `SMTP_EMAIL_ADDR` | Sender email address | API |

## Secret Scanning

Three layers of protection:

### 1. Pre-commit Hook

```bash
# Runs secretlint on staged files
pnpm secrets:staged
```

Blocks commits if secrets are detected. Configured via `.secretlintrc.json`.

### 2. Pre-push Hook

```bash
# Full repo scan
pnpm secrets:scan
```

Blocks pushes if any secrets are found anywhere in the repo.

### 3. CI Pipeline

`.github/workflows/secret-scan.yml` runs `gitleaks` on every PR and push to `main`.

## Setting Production Secrets

```bash
# From apps/api/
wrangler secret put JWT_SECRET
# Prompts for value interactively (not stored in shell history)

# Bulk upload from file
wrangler secret bulk .env.production
# File format: KEY=value, one per line
```

## Rotation

1. Generate new secret value
2. `wrangler secret put KEY` with new value
3. Deploy: `wrangler deploy` (picks up new secret immediately)
4. For JWT_SECRET: existing tokens continue to work until they expire (15 min)

## Rules

- **Never** put secrets in `wrangler.jsonc`
- **Never** put secrets in frontend code (only `VITE_*` which are public)
- **Never** commit `.dev.vars` or `.env.production` (API)
- `apps/web/.env.production` is committed — it only contains `VITE_API_ORIGIN` (public URL)
- `.env*` files are gitignored (except `apps/web/.env.production`)
