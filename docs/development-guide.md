# Development Guide — DevSage

**Generated:** 2026-02-18

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥20.0.0 | Runtime |
| pnpm | ≥8.0.0 (recommended 10.28.2) | Package manager |
| Wrangler | 4.63.0 (dev dependency) | Cloudflare Workers CLI |
| Git | Latest | Version control |

---

## Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd DevSage
pnpm install

# Set up API dev secrets
cp apps/api/.dev.vars.example apps/api/.dev.vars  # if example exists
# Or create apps/api/.dev.vars with required secrets:
# JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET,
# FRONTEND_URL, PLATFORM_URL, ADMIN_URL, SMTP_*

# Build shared packages first (required by apps)
pnpm build
```

---

## Development Commands

### Root-Level (Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in parallel |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm secrets:scan` | Full repo secret scan |
| `pnpm secrets:staged` | Scan staged files only |

### Per-App Commands

| App | Dev | Build | Test |
|-----|-----|-------|------|
| API | `pnpm --filter @devsage/api dev` | `pnpm --filter @devsage/api build` | `pnpm --filter @devsage/api test` |
| Web | `pnpm --filter @devsage/web dev` | `pnpm --filter @devsage/web build` | `pnpm --filter @devsage/web test` |
| Platform | `pnpm --filter @devsage/platform dev` | `pnpm --filter @devsage/platform build` | `pnpm --filter @devsage/platform test` |
| Admin | `pnpm --filter @devsage/admin dev` | `pnpm --filter @devsage/admin build` | `pnpm --filter @devsage/admin test` |

### Package Commands

| Package | Build | Notes |
|---------|-------|-------|
| Shared | `pnpm --filter @devsage/shared build` | Must build before apps |
| DB | `pnpm --filter @devsage/db build` | Must build before API |
| DB Generate | `pnpm --filter @devsage/db generate` | Generate Drizzle migrations |

---

## Development Ports

| App | Port | URL |
|-----|------|-----|
| API (Wrangler) | 8787 | `http://localhost:8787` |
| Web (Vite) | 5173 | `http://localhost:5173` |
| Platform (Vite) | 5174 | `http://localhost:5174` |
| Admin (Vite) | 5175 | `http://localhost:5175` |

Frontend Vite dev servers proxy API routes to `http://localhost:8787`:
- `/api/v1/*`, `/auth/*`, `/hackathons/*`, `/webhooks/*`

---

## Database Workflow

```bash
# 1. Edit schema in packages/db/src/schema/*.ts
# 2. Build the db package
pnpm --filter @devsage/db build

# 3. Generate migration
pnpm --filter @devsage/db generate

# 4. Migrations auto-apply on next wrangler dev (local)
# 5. For production: wrangler d1 migrations apply devsage-db --remote
```

**Local DB reset on dev:** The API dev script runs `scripts/dev-reset-db.mjs` before starting wrangler, which resets the local D1 database.

---

## Testing

### API Tests
- **Framework:** Vitest with `@cloudflare/vitest-pool-workers`
- **Environment:** Real Workers runtime with D1/KV/DO bindings
- **Config:** `singleWorker: true`, test secrets in miniflare bindings
- **Location:** `apps/api/src/__tests__/**/*.test.ts`
- **Style:** Integration-first, minimal mocking

### Frontend Tests
- **Framework:** Vitest with `@testing-library/react` + jsdom
- **Location:** `apps/*/src/__tests__/**/*.test.ts(x)`

### Running Tests
```bash
pnpm test                              # All tests
pnpm --filter @devsage/api test        # API tests only
pnpm --filter @devsage/web test        # Web tests only
```

---

## Environment Variables

### API (apps/api/.dev.vars — gitignored)
```
JWT_SECRET=dev-secret-at-least-32-chars
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=...
FRONTEND_URL=http://localhost:5173
PLATFORM_URL=http://localhost:5174
ADMIN_URL=http://localhost:5175
SMTP_URL=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_EMAIL_ADDR=noreply@devsage.org
```

### Web Apps (VITE_* only — client-visible)
- `VITE_API_ORIGIN` — API base URL (production only; dev uses proxy)

### Production Secrets
```bash
# Individual secret
cd apps/api && wrangler secret put JWT_SECRET

# Bulk from file
cd apps/api && wrangler secret bulk .env.production
```

---

## Code Conventions

| Rule | Details |
|------|---------|
| ESM strict | Explicit `.js` extensions in barrel exports |
| No console.log | Use `console.warn`/`console.error` only |
| Unused vars | Prefix with `_` (e.g., `_unused`) |
| Timestamps | UTC ISO-8601 (`new Date().toISOString()`) |
| UUIDs | `crypto.randomUUID()` |
| Response envelope | `{ ok, data, meta }` / `{ ok, error: { code, message } }` |
| Pagination | Offset-based default (limit 1-100, default 20) |
| No `as any` | Avoid `@ts-ignore` / `@ts-expect-error` |

---

## Git Hooks (Husky)

| Hook | Action |
|------|--------|
| Pre-commit | `secretlint` scans staged files — blocks commits with secrets |
| Pre-push | Full repo secret scan — blocks pushes with secrets |

---

## CI/CD

| Workflow | File | Trigger | Description |
|----------|------|---------|-------------|
| Secret Scan | `.github/workflows/secret-scan.yml` | PR + push to master | `gitleaks` secret detection |

---

## Deployment

```bash
# Deploy API
pnpm deploy:api                  # Production
pnpm deploy:api:dev              # Dev environment

# Deploy frontends
pnpm deploy:web                  # devsage.org
pnpm deploy:platform             # platform.devsage.org
pnpm deploy:admin                # shikdd.devsage.org

# Upload API secrets
pnpm deploy:api:secrets          # Bulk from .env.production
```

All deployments use **Cloudflare Workers** (including frontends via Workers Static Assets).

**Important:** Never run `wrangler` from the repo root — each app has its own `wrangler.jsonc`.
