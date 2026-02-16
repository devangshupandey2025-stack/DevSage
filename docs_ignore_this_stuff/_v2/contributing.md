# Contributing Guidelines

Thank you for your interest in contributing to DevSage. This document covers the conventions, workflows, and expectations for all contributions.

## Getting Started

Set up your local development environment by following the [Developer Setup Guide](./setup.md). Make sure `pnpm dev`, `pnpm test`, `pnpm typecheck`, and `pnpm lint` all pass before making changes.

## Branch Strategy

- All work happens on feature branches created from `main`.
- Pull requests are required for merging into `main`.
- Name branches descriptively: `feat/team-invitations`, `fix/oauth-callback-redirect`, `docs/setup-guide`.

## Code Style

DevSage enforces TypeScript strict mode across the entire monorepo. The following conventions are non-negotiable.

### General Rules

- **ESM only.** Use explicit `.js` extensions in all barrel export re-exports (e.g., `export * from './auth.js'`).
- **No `console.log`.** Use `console.warn` or `console.error` for structured logging. `console.log` triggers a lint warning.
- **Unused variables** must be prefixed with `_` (e.g., `_unused`). The lint rule `argsIgnorePattern: '^_'` suppresses warnings for these.
- **No type escape hatches.** Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`. The `no-explicit-any` rule is set to warn.
- **Timestamps** are always UTC ISO-8601: `new Date().toISOString()`.
- **IDs** are generated with `crypto.randomUUID()` (native to the Workers runtime).

### Formatting

ESLint flat config (ESLint 9+) is defined in `packages/config/eslint.config.mjs`. Run `pnpm lint` to check compliance.

## Project Structure

When adding new code, place it in the correct location:

| What you are adding | Where it goes | Notes |
|---------------------|---------------|-------|
| API route | `apps/api/src/routes/` | Hono router; mount in `src/index.ts` |
| Durable Object | `apps/api/src/durable-objects/` | Must re-export from `src/index.ts` |
| DB table | `packages/db/src/schema/` | Drizzle SQLite; re-export from `schema/index.ts` |
| Zod schema | `packages/shared/src/schemas/` | Re-export from `src/index.ts` |
| UI page | `apps/web/src/pages/` | Add route in `App.tsx` |
| UI component | `apps/web/src/components/` | shadcn/ui components live in `components/ui/` |
| Middleware | `apps/api/src/middleware/` | Hono middleware pattern |

New schemas, types, and modules must be re-exported from their package's barrel file (`index.ts`). Failing to do so will break downstream imports.

For a full architecture overview, see the [architecture docs](./architecture/00-overview.md).

## Testing Expectations

All contributions should include tests where applicable.

**API tests** (`apps/api/src/__tests__/`):
- Use `@cloudflare/vitest-pool-workers` to run inside the Workers runtime.
- Tests have access to real D1, KV, and Durable Object bindings.
- Prefer integration tests over unit tests. Minimize mocking.

**Web tests** (`apps/web/src/__tests__/`):
- Use jsdom with `@testing-library/react`.
- Test component behavior, not implementation details.

Run the full test suite before submitting a PR:

```bash
pnpm test
```

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

## Pull Request Checklist

Before requesting review, confirm the following:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm test` passes with no failures
- [ ] No secrets or credentials in committed files
- [ ] New schemas and types are re-exported from barrel files
- [ ] Durable Objects are re-exported from `apps/api/src/index.ts`
- [ ] Migrations (if any) are generated via `drizzle-kit generate`

## Anti-Patterns to Avoid

These patterns are known to cause issues in this project. Do not use them.

| Anti-pattern | Why | Use instead |
|--------------|-----|-------------|
| `@hono/oauth-providers` | Broken on Cloudflare Workers | Manual OAuth 2.0 implementation |
| Prisma | Incompatible with Workers and D1 | Drizzle ORM |
| D1 access from inside Durable Objects | Worker must mediate all D1 writes | Pass data through the Worker |
| `wrangler.toml` | Project uses JSONC format | `wrangler.jsonc` |
| `console.log` | Banned by lint config | `console.warn` / `console.error` |
| Secrets in `VITE_*` env vars | Client-visible, never safe for secrets | Use Worker secrets via `wrangler secret put` |
| `as any` / `@ts-ignore` | Undermines type safety | Proper typing or `unknown` with narrowing |

## Questions

If something is unclear or you are unsure where a change belongs, open an issue or ask in the PR discussion. We would rather help you get it right than review a large PR that needs rework.
