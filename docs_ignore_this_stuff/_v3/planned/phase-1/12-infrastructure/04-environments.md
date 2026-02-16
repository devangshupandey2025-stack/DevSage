# Environments

> Dev, staging, and production configuration for the API Worker.

## Local Development

```bash
# From repo root
pnpm dev              # Runs all apps via turbo --parallel

# From apps/api/
pnpm dev              # wrangler dev with local D1/KV/DO/Queues
```

Local dev uses `wrangler dev` which provides:
- Local D1 (SQLite file in `.wrangler/`)
- Local KV (in-memory)
- Local DO (in-process)
- Local Queues (in-process, immediate delivery)

### Dev Secrets

```bash
# apps/api/.dev.vars (gitignored)
JWT_SECRET=dev-secret-min-32-chars-long-enough
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_WEBHOOK_SECRET=whsec_dev...
FRONTEND_URL=http://localhost:5173
PLATFORM_URL=http://localhost:5174
ADMIN_URL=http://localhost:5175
SMTP_URL=smtp://localhost:1025
SMTP_USERNAME=dev
SMTP_PASSWORD=dev
SMTP_EMAIL_ADDR=noreply@devsage.local
```

### Vite Proxy

Frontend apps proxy API requests to the local Worker:

```ts
// vite.config.ts (all frontend apps)
server: {
  proxy: {
    '/api/v1': 'http://localhost:8787',
    '/auth': 'http://localhost:8787',
    '/hackathons': 'http://localhost:8787',
    '/webhooks': 'http://localhost:8787',
  }
}
```

## Production

```bash
# Deploy from repo root
pnpm deploy:api           # wrangler deploy
pnpm deploy:api:secrets   # wrangler secret bulk .env.production
```

Production URLs:
- API: `https://api.devsage.org`
- Web: `https://devsage.org`
- Platform: `https://platform.devsage.org`
- Admin: `https://shikdd.devsage.org`

### Production Secrets

Set via Wrangler CLI (never in wrangler.jsonc):

```bash
# Individual
wrangler secret put JWT_SECRET

# Bulk from file
wrangler secret bulk .env.production
```

## Environment Variables vs Secrets

| Type | Where | Example |
|------|-------|---------|
| **Binding** | wrangler.jsonc | `DB`, `KV`, `HACKATHON_SM` |
| **Secret** | `wrangler secret put` | `JWT_SECRET`, `GITHUB_CLIENT_SECRET` |
| **Dev secret** | `.dev.vars` | Same as secrets, for local dev |
| **Frontend env** | `.env.production` | `VITE_API_ORIGIN` |

**Rule**: Never put secrets in wrangler.jsonc. Frontend env vars are `VITE_*` only (client-visible).

## Implementation Notes

- `account_id` is in wrangler.jsonc — no env var needed
- Auth via `wrangler login` (OAuth) — no API tokens needed
- Never run `wrangler` from repo root — must be from `apps/api/`
- D1 migrations path in wrangler.jsonc: `../../packages/db/migrations` (relative from apps/api)
