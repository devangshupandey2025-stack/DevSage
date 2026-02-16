# Cloudflare Bindings

> `apps/api/wrangler.jsonc` — All runtime bindings for the API Worker.

## wrangler.jsonc Structure

```jsonc
{
  "name": "devsage-api",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "...",

  // D1 Database
  "d1_databases": [{
    "binding": "DB",
    "database_name": "devsage-db",
    "database_id": "...",
    "migrations_dir": "../../packages/db/migrations"
  }],

  // KV Namespace
  "kv_namespaces": [{
    "binding": "KV",
    "id": "..."
  }],

  // Durable Objects
  "durable_objects": {
    "bindings": [{
      "name": "HACKATHON_SM",
      "class_name": "HackathonStateMachine"
    }]
  },
  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["HackathonStateMachine"]
  }],

  // Queues
  "queues": {
    "producers": [
      { "binding": "WEBHOOK_QUEUE", "queue": "github-webhooks" },
      { "binding": "NOTIFICATION_QUEUE", "queue": "devsage-notifications" }
    ],
    "consumers": [
      { "queue": "github-webhooks", "max_batch_size": 10, "max_retries": 3 },
      { "queue": "devsage-notifications", "max_batch_size": 10, "max_retries": 3 }
    ]
  },

  // Cron Triggers
  "triggers": {
    "crons": ["0 * * * *"]
  },

  // R2 (Phase 2)
  "r2_buckets": [{
    "binding": "UPLOADS",
    "bucket_name": "devsage-uploads"
  }]
}
```

## TypeScript Env

Generate the `Env` type automatically from `wrangler.jsonc` — never hand-write it:

```bash
# Run from apps/api/
npx wrangler types
```

This generates `worker-configuration.d.ts` with all binding types inferred from the config. Import it:

```ts
// apps/api/src/types/env.ts
/// <reference path="../worker-configuration.d.ts" />

// The generated Env type includes all bindings (DB, KV, HACKATHON_SM, queues, R2)
// plus all secrets and vars. You can extend it if needed:
export type AppEnv = Env & {
  // Add any runtime-only types here
};
```

### Secrets (set via `wrangler secret put` or `wrangler secret bulk`)

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | HMAC signing key for session tokens |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_WEBHOOK_SECRET` | HMAC key for verifying GitHub webhook payloads |
| `RESEND_API_KEY` | Resend email service API key |

### Vars (non-secret config, set in `wrangler.jsonc` `[vars]`)

| Var | Purpose | Example |
|-----|---------|---------|
| `FRONTEND_URL` | Frontend origin for CORS / redirects | `https://devsage.org` |
| `PLATFORM_URL` | Platform dashboard origin | `https://platform.devsage.org` |
| `ADMIN_URL` | Admin panel origin | `https://admin.devsage.org` |
| `API_URL` | Public API base URL | `https://api.devsage.org` |
| `EMAIL_FROM` | Sender address for transactional email | `noreply@devsage.org` |

> **Why Resend instead of SMTP?** Cloudflare Workers cannot open raw TCP sockets — SMTP libraries won't work. Resend provides an HTTP API that works from Workers with zero configuration.

## DO Re-export Requirement

Durable Objects **must** be re-exported from `apps/api/src/index.ts`:

```ts
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
```

Without this export, wrangler deploy fails silently.

## Implementation Notes

- `migrations_dir` path is relative from `apps/api/` — uses `../../packages/db/migrations`
- `new_sqlite_classes` in migrations enables SQLite-backed DO storage (not KV-backed)
- `nodejs_compat` flag enables Node.js APIs (needed for some crypto operations)
- Secrets are NOT in wrangler.jsonc — deployed via `wrangler secret put` or `wrangler secret bulk`
- Dev secrets go in `apps/api/.dev.vars` (gitignored)
