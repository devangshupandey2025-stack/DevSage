# Local Development Setup

> How to set up the DevSage monorepo for local development.

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9
- **Git**
- GitHub account (for OAuth testing)
- Google Cloud project (for Google OAuth testing, optional)

## Steps

### 1. Clone & Install

```bash
git clone https://github.com/your-org/DevSage.git
cd DevSage
pnpm install
```

### 2. Configure API Secrets

Create `apps/api/.dev.vars`:

```bash
JWT_SECRET=dev-secret-at-least-32-characters-long
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=whsec_dev_secret
FRONTEND_URL=http://localhost:5173
PLATFORM_URL=http://localhost:5174
ADMIN_URL=http://localhost:5175
SMTP_URL=smtp://localhost:1025
SMTP_USERNAME=dev
SMTP_PASSWORD=dev
SMTP_EMAIL_ADDR=noreply@devsage.local
```

### 3. GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create new OAuth App:
   - Homepage URL: `http://localhost:5173`
   - Callback URL: `http://localhost:8787/auth/callback/github`
3. Copy Client ID and Secret into `.dev.vars`

### 4. Run D1 Migrations

```bash
cd apps/api
npx wrangler d1 migrations apply devsage-db --local
```

### 5. Start Development

```bash
# From repo root — starts all apps
pnpm dev
```

This runs:
| App | URL |
|-----|-----|
| API (Wrangler) | `http://localhost:8787` |
| Web (Vite) | `http://localhost:5173` |
| Platform (Vite) | `http://localhost:5174` |
| Admin (Vite) | `http://localhost:5175` |

### 6. Seed Platform Admin (First Time)

```bash
cd apps/api
npx wrangler d1 execute devsage-db --local --command \
  "INSERT INTO platform_admins (id, user_id, granted_by, created_at) VALUES ('admin-1', '<your-user-id>', 'seed', strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
```

## Useful Commands

```bash
pnpm dev              # All apps in parallel
pnpm build            # Build all
pnpm test             # Test all (vitest)
pnpm lint             # Lint all
pnpm typecheck        # Type-check all
pnpm secrets:scan     # Scan for leaked secrets
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| D1 errors | Run migrations: `wrangler d1 migrations apply devsage-db --local` |
| OAuth callback fails | Check callback URL matches GitHub app config |
| CORS errors | Ensure `FRONTEND_URL` in `.dev.vars` matches Vite dev URL |
| Port conflicts | Kill existing processes on 5173/5174/5175/8787 |

## Notes

- Wrangler dev provides local D1/KV/DO/Queues (no Cloudflare account needed for dev)
- `.dev.vars` is gitignored — never commit it
- Email in dev: use Mailpit (`docker run -p 1025:1025 -p 8025:8025 axllent/mailpit`) for SMTP capture
