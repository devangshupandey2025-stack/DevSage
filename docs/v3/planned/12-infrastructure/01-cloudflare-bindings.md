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

All bindings must be typed in `apps/api/src/types/env.ts`:

```ts
export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  WEBHOOK_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  UPLOADS: R2Bucket;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
  ADMIN_URL: string;
  SMTP_URL: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_EMAIL_ADDR: string;
};
```

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
