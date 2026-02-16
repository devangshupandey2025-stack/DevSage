# Deployment

> CI/CD, production deployment, and rollback procedures.

## Deployment Commands

```bash
# From repo root
pnpm deploy:api           # Deploy API Worker
pnpm deploy:api:secrets   # Upload secrets to production
pnpm deploy:web           # Deploy web app to Cloudflare Pages
pnpm deploy:platform      # Deploy platform app
pnpm deploy:admin         # Deploy admin app
```

## API Worker Deployment

```bash
cd apps/api
wrangler deploy           # Deploys to api.devsage.org
```

### D1 Migrations (Production)

```bash
cd apps/api
npx wrangler d1 migrations apply devsage-db --remote
```

**Always run migrations before deploying** if schema has changed.

### Secrets

```bash
# Individual secret
wrangler secret put JWT_SECRET

# Bulk from file
wrangler secret bulk .env.production
```

## Frontend Deployment

Each frontend app deploys to Cloudflare Pages:

```bash
# Build then deploy
pnpm --filter @devsage/web build
wrangler pages deploy apps/web/dist --project-name devsage-web

# Or use the shortcut
pnpm deploy:web
```

## CI/CD Pipeline

### On Push to `main`

1. **Secret scan** — gitleaks checks for leaked secrets
2. **Lint** — ESLint across all packages
3. **Type check** — TypeScript strict across all packages
4. **Test** — Vitest across all packages
5. **Build** — Turbo builds all apps
6. **Deploy** — Wrangler deploys API + Pages apps

### On Pull Request

1. Steps 1–5 (no deploy)
2. Preview deploy on Cloudflare Pages (automatic URL per branch)

## Rollback

### API Worker

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

### Frontend (Pages)

Redeploy from a previous commit:

```bash
git checkout <commit>
pnpm --filter @devsage/web build
wrangler pages deploy apps/web/dist --project-name devsage-web
```

### D1 Migrations

D1 migrations are **not reversible**. If a migration breaks production:
1. Write a new migration that reverts the changes
2. Apply it: `wrangler d1 migrations apply devsage-db --remote`

## Implementation Notes

- `wrangler deploy` must run from `apps/api/` (wrangler.jsonc is there)
- `account_id` is baked into wrangler.jsonc — no env var needed
- Auth via `wrangler login` (OAuth) — no API tokens
- Turbo handles build ordering (shared packages first, then apps)
- Preview deploys are ephemeral — deleted after PR merge
