# apps/api — Cloudflare Worker API

Hono-based API running on Cloudflare Workers. Single Worker handles HTTP routes, Durable Objects, and Queue consumer.

## STRUCTURE

```
src/
├── index.ts              # Entry point — Hono app + DO re-exports + queue handler
├── routes/               # Hono route modules (auth, hackathons, teams, webhooks, submissions)
├── durable-objects/      # HackathonLifecycleDO, SubmissionDO (SQLite-backed)
├── middleware/            # auth, role, error-handler
├── lib/                  # jwt (crypto.subtle), cookies, oauth (manual Google+GitHub)
├── types/                # env.ts (Worker bindings), auth.ts (JWT payload)
└── __tests__/            # Vitest with @cloudflare/vitest-pool-workers
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add route | `src/routes/` | Create file, mount in `src/index.ts` via `app.route()` |
| Add DO | `src/durable-objects/` | MUST re-export class from `src/index.ts` |
| Add middleware | `src/middleware/` | Hono `MiddlewareHandler<AuthAppEnv>` pattern |
| Change bindings | `wrangler.jsonc` | D1, KV, DO, Queue bindings. Also update `types/env.ts` |
| OAuth flow | `src/lib/oauth.ts` | Manual HTTP — Google + GitHub token exchange |
| JWT ops | `src/lib/jwt.ts` | Custom HMAC SHA-256 via `crypto.subtle` |
| Cookie ops | `src/lib/cookies.ts` | HttpOnly, SameSite=Lax (dev) / Strict+Secure (prod) |
| Add test | `src/__tests__/` | Uses `SELF.fetch()` and `env.DB` from `cloudflare:test` |

## BINDINGS (wrangler.jsonc)

| Binding | Type | Name |
|---------|------|------|
| `DB` | D1 Database | `devsage-db` |
| `KV` | KV Namespace | — |
| `HACKATHON_LIFECYCLE` | Durable Object | `HackathonLifecycleDO` |
| `SUBMISSION` | Durable Object | `SubmissionDO` |
| `WEBHOOK_QUEUE` | Queue | `github-webhooks` |

Secrets (in `.dev.vars` locally, `wrangler secret put` for prod):
`JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_URL`

## ROUTES

Production API is hosted at `https://api.devsage.org` and routes are rooted (no extra `/api` prefix):
`/auth/*`, `/hackathons/*`, `/webhooks/*`

## CONVENTIONS

- **Route mounting**: Each route file exports a Hono sub-app, mounted in `index.ts`
- **Auth pattern**: `authMiddleware` extracts JWT → sets `c.get('user')`. Use `requireRole('organiser')` for role gates.
- **DB access**: `createDbClient(c.env.DB)` from `@devsage/db`. Drizzle query builder.
- **Validation**: `@hono/zod-validator` with schemas from `@devsage/shared`
- **DO communication**: Worker calls DO via `stub.fetch('http://do/endpoint')`. DOs NEVER touch D1.
- **Queue**: Webhook route enqueues → `queue()` handler in `index.ts` dequeues → forwards to SubmissionDO
- **Error handler**: Global `app.onError(errorHandler)` returns `{ error, code }` JSON

## ANTI-PATTERNS

- DO classes NOT re-exported from `index.ts` → wrangler deploy fails silently
- Accessing D1 from inside a Durable Object class
- Using `@hono/oauth-providers` (broken on Workers)
- Running `wrangler` from repo root (no config there). Run from `apps/api/` or use `pnpm deploy:api`
- Using external JWT libraries — use `crypto.subtle` only

## TESTING

```bash
pnpm --filter @devsage/api test       # Run API tests
```

Tests use `@cloudflare/vitest-pool-workers` — real Workers runtime with D1/KV/DO bindings. `SELF.fetch()` for integration tests. Inline helpers (JWT signing, DB setup/teardown).

Config: `vitest.config.ts` → `defineWorkersConfig` with `singleWorker: true`.
