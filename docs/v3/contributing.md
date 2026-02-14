# Contributing

> Code conventions, testing expectations, and PR process for DevSage.

**Related docs:** [Developer Setup](./setup.md) | [Architecture](./architecture/00-overview.md)

---

## Getting Started

Set up your local environment by following the [Developer Setup](./setup.md) guide. Confirm these pass before making changes:

```bash
pnpm dev         # All apps start without errors
pnpm typecheck   # No type errors
pnpm lint        # No lint errors
pnpm test        # All tests pass
```

---

## Branch Strategy

- All work happens on feature branches created from `main`.
- Pull requests are required for merging into `main`.
- Name branches descriptively: `feat/team-invitations`, `fix/oauth-callback-redirect`, `docs/setup-guide`.

---

## Code Conventions

### General Rules

| Convention | Rule |
|------------|------|
| **ESM strict** | All imports use explicit `.js` extensions in barrel exports (e.g., `export * from './auth.js'`) |
| **No `console.log`** | Use `console.warn` or `console.error` only. `console.log` triggers a lint warning |
| **Unused variables** | Prefix with `_` (e.g., `_unused`). The lint rule `argsIgnorePattern: '^_'` suppresses warnings |
| **No type escape hatches** | Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`. `no-explicit-any` is set to warn |
| **Timestamps** | Always UTC ISO-8601: `new Date().toISOString()` |
| **UUIDs** | `crypto.randomUUID()` (native to the Workers runtime) |
| **Response envelope** | `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` on all API routes |

### Linting

ESLint flat config (ESLint 9+) is defined in `packages/config/eslint.config.mjs` and shared across all packages. Key rules:

```javascript
'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
'@typescript-eslint/no-explicit-any': 'warn'
'no-console': ['warn', { allow: ['warn', 'error'] }]
```

Run `pnpm lint` to check compliance.

### TypeScript

TypeScript strict mode is enforced everywhere. Shared config variants live in `packages/config/`:

| Config | Used By |
|--------|---------|
| `tsconfig.base.json` | Library packages (`packages/db`, `packages/shared`) |
| `tsconfig.react.json` | Web apps (`apps/web`, `apps/platform`, `apps/admin`) |
| `tsconfig.worker.json` | API worker (`apps/api`) |

---

## Where to Add Things

| What you are adding | Where it goes | Notes |
|---------------------|---------------|-------|
| API route | `apps/api/src/routes/` | Hono router; mount in `src/index.ts` via `app.route()` |
| Durable Object | `apps/api/src/durable-objects/` | Must re-export from `src/index.ts` or wrangler fails |
| Queue handler | `apps/api/src/queue/` | Add handler, wire in `queue/index.ts` dispatcher |
| Middleware | `apps/api/src/middleware/` | `MiddlewareHandler<AuthAppEnv>` pattern |
| External service | `apps/api/src/services/` | Fail-open pattern: 10s timeout, never throw |
| DB table | `packages/db/src/schema/` | Drizzle SQLite; re-export from `schema/index.ts` |
| Zod schema | `packages/shared/src/schemas/` | Re-export from `src/index.ts` with `.js` extension |
| UI page | `apps/web/src/pages/` | Add route in `App.tsx`; wrap with `ProtectedRoute` if auth required |
| UI component | `apps/web/src/components/` | shadcn/ui primitives in `components/ui/` |
| Worker bindings | `apps/api/wrangler.jsonc` | Also update `types/env.ts` |

New schemas, types, and modules must be re-exported from their package's barrel file (`index.ts`). Failing to do so breaks downstream imports.

---

## Testing

All contributions should include tests where applicable.

### API Tests

Location: `apps/api/src/__tests__/`

- Use `@cloudflare/vitest-pool-workers` -- tests run inside the Workers runtime.
- Real D1, KV, and Durable Object bindings are available (no mocking of Cloudflare primitives).
- Prefer integration tests over unit tests.
- Use `SELF.fetch()` for HTTP-level tests and `env.DB` for direct database access.

### Web Tests

Location: `apps/web/src/__tests__/`

- Use jsdom with `@testing-library/react`.
- Test component behavior, not implementation details.

### Running Tests

```bash
pnpm test                          # All tests (via Turborepo)
pnpm --filter @devsage/api test    # API tests only
pnpm --filter @devsage/web test    # Web tests only
```

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add team invitation flow
fix: correct OAuth callback redirect for GitHub
docs: update deployment guide with DNS setup
refactor: extract auth middleware into shared module
test: add integration tests for hackathon state machine
chore: update dependencies
```

Keep the subject line under 72 characters. Use the body for additional context when the change is non-trivial.

---

## Pull Request Checklist

Before requesting review, confirm the following:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm test` passes with no failures
- [ ] No secrets or credentials in committed files
- [ ] New schemas and types are re-exported from barrel files
- [ ] Durable Objects are re-exported from `apps/api/src/index.ts`
- [ ] Migrations (if any) are generated via `drizzle-kit generate`

---

## Anti-Patterns

These patterns are known to cause issues in this project. Do not use them.

| Anti-Pattern | Why | Use Instead |
|--------------|-----|-------------|
| `@hono/oauth-providers` | Broken on Cloudflare Workers | Manual OAuth 2.0 implementation |
| Prisma | Incompatible with Workers and D1 | Drizzle ORM |
| D1 access from inside Durable Objects | Worker must mediate all D1 writes | Pass data through the Worker |
| `wrangler.toml` | Project uses JSONC format | `wrangler.jsonc` |
| `console.log` | Banned by lint config | `console.warn` / `console.error` |
| Secrets in `VITE_*` env vars | Client-visible, never safe for secrets | Worker secrets via `wrangler secret put` |
| `as any` / `@ts-ignore` | Undermines type safety | Proper typing or `unknown` with narrowing |
| External JWT libraries | Project uses `crypto.subtle` only | Custom HMAC SHA-256 implementation |
| Roles stored in JWT | Must be resolved per-request per-hackathon | `resolveRole()` middleware |
| Backward state transitions | State machine is forward-only | Transition through the 7 states in order |
| Cloudflare Pages | Project uses Workers Static Assets | `wrangler deploy` with `assets` config |
| Running wrangler from repo root | No `wrangler.jsonc` at root | Run from `apps/api/` or use `pnpm --filter` |

---

## Questions

If something is unclear or you are unsure where a change belongs, open an issue or ask in the PR discussion.
