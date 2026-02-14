# Deployment

> Production deployment for all DevSage surfaces to Cloudflare.

**Related docs:** [Developer Setup](./setup.md) | [Secrets](./secrets.md) | [Infrastructure](./architecture/13-infrastructure.md)

---

## Production URLs

| Surface | URL | Source | Deploy Command |
|---------|-----|--------|----------------|
| API | `https://api.devsage.org` | `apps/api/` | `pnpm deploy:api` |
| Web (main site) | `https://devsage.org` | `apps/web/` | `pnpm deploy:web` |
| Organizer Platform | `https://platform.devsage.org` | `apps/platform/` | `pnpm deploy:platform` |
| Admin Dashboard | `https://admin.devsage.org` | `apps/admin/` | `pnpm deploy:admin` |
| Hackathon Sites | `https://{slug}.devsage.org` | `templates/hackathon-site/` | `pnpm generate:site` |

---

## First-Time Cloudflare Setup

### Authenticate

```bash
wrangler login
```

This opens a browser for OAuth authentication. No API tokens are needed -- Wrangler stores credentials locally. The `account_id` is baked into `apps/api/wrangler.jsonc`.

### Create the D1 Database

```bash
wrangler d1 create devsage-db
```

This outputs a `database_id`. The value is already configured in `apps/api/wrangler.jsonc`.

### Run Migrations

```bash
cd apps/api
wrangler d1 migrations apply devsage-db --remote
```

Migrations are located in `packages/db/migrations`. The migration path is configured in `apps/api/wrangler.jsonc` as a relative path (`../../packages/db/migrations`).

---

## Deploy API

```bash
# Production
pnpm deploy:api

# Dev environment
pnpm deploy:api:dev
```

This runs `pnpm --filter @devsage/api deploy`, which invokes `wrangler deploy` from the `apps/api/` directory.

The API Worker includes:
- Hono HTTP routes
- HackathonStateMachine Durable Object (SQLite-backed)
- Queue consumers (github-webhooks, devsage-notifications)
- Cron trigger (hourly deadline checks)

**Important:** Never run `wrangler deploy` from the repo root. There is no `wrangler.jsonc` at the root level.

---

## Deploy Web Apps

```bash
# Main site (devsage.org)
pnpm deploy:web

# Organizer platform (platform.devsage.org)
pnpm deploy:platform

# Admin dashboard (admin.devsage.org)
pnpm deploy:admin
```

Each command runs `tsc --noEmit && vite build` followed by `wrangler deploy` from the respective app directory. The output is a static bundle deployed to Cloudflare Workers Static Assets.

Dev environment variants are available:

```bash
pnpm deploy:web:dev
pnpm deploy:platform:dev
pnpm deploy:admin:dev
```

### Web Environment Variables

The production environment file `apps/web/.env.production` is committed to the repository. It contains only client-visible `VITE_*` variables:

```
VITE_API_ORIGIN=https://api.devsage.org
```

Never place secrets in web environment variables. `VITE_*` values are embedded in the client bundle.

---

## Deploy Hackathon Sites

Each hackathon gets its own Cloudflare Worker at `{slug}.devsage.org`. Sites are created via the CLI:

```bash
pnpm generate:site --config "$(echo '{"slug":"hack2026","title":"Hack 2026"}' | base64)"
```

The CLI:
1. Copies the template from `templates/hackathon-site/`
2. Writes `site.config.json` with hackathon-specific config
3. Writes `wrangler.jsonc` with the Worker name `hackathon-{slug}`
4. Installs dependencies and builds the site
5. Creates a GitHub repo at `SHIKDD-org/{slug}-site`
6. Deploys to Cloudflare Workers

Run `pnpm generate:site --help` for all config fields (accent color, dates, prize pool, etc.).

### Custom Domain Setup

After the initial deployment, set up the custom domain in the Cloudflare dashboard:

1. Go to Workers & Pages > `hackathon-{slug}` > Settings > Domains & Routes.
2. Add `{slug}.devsage.org` as a custom domain.
3. Cloudflare handles DNS and SSL automatically if the zone is managed in the same account.

---

## Upload API Secrets

Production secrets are stored in Cloudflare and are separate from the code deployment.

### Bulk Upload

Create `apps/api/.env.production` with all production values, then:

```bash
pnpm deploy:api:secrets
```

This runs `wrangler secret bulk .env.production` from `apps/api/`. Never commit `.env.production` to version control.

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
wrangler secret put PLATFORM_URL
wrangler secret put ADMIN_URL
wrangler secret put SMTP_URL
wrangler secret put SMTP_USERNAME
wrangler secret put SMTP_PASSWORD
wrangler secret put SMTP_EMAIL_ADDR
```

Each command prompts for the secret value interactively. See [secrets.md](./secrets.md) for the full list with descriptions.

---

## D1 Migrations

Apply migrations to the remote production database:

```bash
cd apps/api
wrangler d1 migrations apply devsage-db --remote
```

Migrations are Drizzle-generated SQL files in `packages/db/migrations`. Generate new migrations after schema changes:

```bash
cd packages/db
npx drizzle-kit generate
```

---

## Environment Configuration

The API Worker supports multiple environments defined in `apps/api/wrangler.jsonc`:

| Environment | Trigger | D1 Database | Notes |
|-------------|---------|-------------|-------|
| Production | `pnpm deploy:api` | `devsage-db` | Top-level config |
| Dev | `pnpm deploy:api:dev` | `devsage-db-dev` | `env.dev` section, separate secrets |
| Local | `pnpm dev` | Local SQLite | Automatic, no setup needed |

Key `wrangler.jsonc` settings:
- `account_id` is baked in (no env var needed)
- `compatibility_flags: ["nodejs_compat"]`
- `observability.enabled: true`
- Cron trigger: `0 * * * *` (hourly)

---

## Monitoring

**Real-time logs:**

```bash
cd apps/api
wrangler tail
```

**Cloudflare dashboard:** Workers & Pages > your worker > Logs. Observability is enabled in `wrangler.jsonc`.

**Cron trigger:** Runs hourly to check submission deadlines and auto-transition hackathon phases.

---

## Rollback

Cloudflare Workers support instant rollback via the dashboard. Navigate to Workers & Pages > your worker > Deployments, and roll back to any previous deployment.

---

## CI/CD

- `gitleaks` runs on every PR and push to master (`.github/workflows/secret-scan.yml`).
- Deployment is currently manual via the `pnpm deploy:*` commands.
- Ensure all secrets are uploaded before the first production deployment.
