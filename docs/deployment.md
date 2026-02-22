# DevSage — Deployment Guide

## Overview

DevSage runs entirely on Cloudflare's edge infrastructure. Each app is a Cloudflare Worker with both a `workers.dev` URL and a custom domain.

## Prerequisites

- Node.js >= 20, pnpm >= 10
- Cloudflare account with Workers, D1, KV, Queues, and Durable Objects enabled
- `wrangler` CLI authenticated (`npx wrangler login`)
- GitHub CLI (`gh`) for hackathon site deployments
- Custom domain `devsage.org` configured in Cloudflare DNS

## Deployment Targets

| App | workers.dev | Custom Domain | Deploy Command |
|-----|-------------|---------------|----------------|
| API | `api.devsage-org.workers.dev` | `api.devsage.org` | `pnpm deploy:api` |
| Web | `web.devsage-org.workers.dev` | `devsage.org` | `pnpm deploy:web` |
| Platform | `platform.devsage-org.workers.dev` | `platform.devsage.org` | `pnpm deploy:platform` |
| Admin | `admin.devsage-org.workers.dev` | `shikdd.devsage.org` | `pnpm deploy:admin` |
| Judge | `judge.devsage-org.workers.dev` | `judge.devsage.org` | `pnpm deploy:judge` |

## CI/CD

### GitHub Actions

The repo includes two GitHub Actions workflows:

#### `.github/workflows/deploy.yml`
Triggers on push to `main`. Uses `dorny/paths-filter` to detect which apps changed and only deploys those. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

#### `.github/workflows/deploy-hackathon-site.yml`
Manual workflow dispatch for deploying individual hackathon sites. Inputs: hackathon slug, workspace slug, accent color.

### Manual Deploy

```bash
# Deploy everything
pnpm deploy:all

# Deploy individual apps
pnpm deploy:api
pnpm deploy:web
pnpm deploy:platform
pnpm deploy:admin
pnpm deploy:judge
```

## Database (D1)

### Migrations

Two consolidated migration files in `packages/db/migrations/`:

| File | Purpose |
|------|---------|
| `0000_schema.sql` | All 49 tables + 148 indexes |
| `0001_seed.sql` | Platform admins, dev/test accounts, sample workspace/hackathon |

### Applying Migrations

```bash
# Apply to remote (production)
cd apps/api
npx wrangler d1 migrations apply devsage-db --remote

# Apply to local (dev)
npx wrangler d1 migrations apply devsage-db --local
```

### Direct D1 Queries

```bash
npx wrangler d1 execute devsage-db --remote --command "SELECT COUNT(*) FROM users;"
```

## KV Namespace

Used for:
- Rate limiting counters (TTL-based)
- Role resolution cache (60s TTL)
- Leaderboard cache (variable TTL)
- OAuth state parameters

## Secrets

Set via Wrangler (not committed to repo):

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SMTP_PASSWORD
npx wrangler secret put GITHUB_WEBHOOK_SECRET
```

Environment variables (non-secret) are in `wrangler.jsonc`.

## Hackathon Site Deployment

### CLI Tool

The `scripts/generate-hackathon-site.js` tool deploys branded hackathon frontends:

```bash
# Interactive mode
node scripts/generate-hackathon-site.js --interactive

# Config mode (base64-encoded JSON)
node scripts/generate-hackathon-site.js --config <base64>
```

Config JSON format:
```json
{
  "hackathon_slug": "code-sprint",
  "hackathon_name": "Code Sprint 2026",
  "workspace_slug": "ieee-vit",
  "accent_color": "#FF6B35",
  "api_url": "https://api.devsage.org",
  "organizer_name": "IEEE-VIT"
}
```

### What the CLI Does

1. Clones the `SHIKDD-org/hackathon-template` repo
2. Applies branding (accent color, title, meta tags, OG tags)
3. Creates a new GitHub repo in `SHIKDD-org` org
4. Builds with `pnpm build`
5. Deploys to Cloudflare Workers

### URL Patterns

- **Club hackathon**: `{slug}.{workspace}.devsage.org`
- **Individual**: `{slug}.hackathon.devsage.org`
- **Custom domain**: Organizer CNAMEs their domain to the Worker

## Performance

### Caching Strategy

| Data | Cache | TTL |
|------|-------|-----|
| Role resolution | KV | 60s |
| Leaderboard (judging) | KV + ETag | 30s |
| Leaderboard (completed) | KV + ETag | 300s |
| Hackathon detail | ETag + Cache-Control | 10s + 30s SWR |
| Rate limit counters | KV | Per-window |

### Database Indexes

148 indexes covering:
- All foreign key columns
- Common query filter/sort columns
- Composite indexes for hot-path JOINs
- Unique constraints for dedup

### SQLite PRAGMAs

D1 manages SQLite PRAGMAs automatically. `ANALYZE` is run after index changes to update query planner statistics.

## Monitoring

- Wrangler tail: `npx wrangler tail` for real-time logs
- Cloudflare Dashboard: Workers analytics, D1 metrics, KV usage
- Health check: `GET https://api.devsage.org/health`
