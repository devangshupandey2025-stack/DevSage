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

## v3 Contributing Enhancements

v3 raises the bar for contribution quality with structured decision-making processes, automated documentation, code ownership, and expanded CI enforcement.

### Architecture Decision Records (ADRs)

Major technical decisions are documented as ADRs in `docs/decisions/`. Each ADR follows a standard template:

```
# ADR-NNN: Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNN

## Context
What is the issue that we are seeing that is motivating this decision?

## Decision
What is the change that we are proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?
```

Create a new ADR when a change affects architecture, introduces a new dependency, changes a public API contract, or modifies the data model. Number ADRs sequentially and submit them as part of the implementing PR.

### RFC Process for Significant Changes

Changes that affect multiple packages, alter user-facing behavior, or introduce new infrastructure require an RFC before implementation:

1. **Draft:** Open a GitHub Discussion in the "RFCs" category using the RFC template.
2. **Review period:** Minimum 5 business days for team feedback.
3. **Approval:** At least two maintainers must approve. Unresolved objections block approval.
4. **Implementation:** Reference the RFC number in all related PRs.

The RFC template is available at `.github/DISCUSSION_TEMPLATE/rfc.yml`.

### Developer Documentation Auto-Generation

v3 automates documentation generation to keep docs in sync with the codebase:

- **TypeDoc** generates API reference documentation from TSDoc comments in the `apps/api/` and `packages/` source files. Output is published to `docs/api-reference/` on every merge to `main`.
- **Storybook** provides an interactive component library for `apps/web/src/components/`. Each component includes usage examples, prop documentation, and visual states.

Run locally:

```bash
pnpm --filter @devsage/api docs        # Generate API docs
pnpm --filter @devsage/web storybook   # Start Storybook dev server
```

### Code Ownership

A `CODEOWNERS` file at the repository root assigns domain experts to each module. GitHub requires approval from the relevant code owner before a PR touching their area can merge.

```
# CODEOWNERS
apps/api/src/durable-objects/   @core-team
apps/api/src/routes/judging.ts  @judging-team
apps/api/src/routes/webhooks.ts @integrations-team
apps/web/src/pages/             @frontend-team
packages/db/                    @core-team
packages/shared/                @core-team
```

Code ownership reduces review bottlenecks by routing PRs to the people who know the code best.

### Performance Budget Enforcement

CI enforces strict performance budgets on the web app. The build step fails if any of the following limits are exceeded:

| Metric | Limit |
|--------|-------|
| Main JS bundle (gzipped) | 150 KB |
| Main CSS bundle (gzipped) | 30 KB |
| Total initial load (gzipped) | 250 KB |
| Lighthouse Performance score | >= 90 |

Bundle size is tracked over time. The CI step posts a size comparison comment on every PR showing the delta against `main`.

### Accessibility Testing in CI

Automated accessibility checks run on every PR using axe-core:

- The test suite renders each page component and runs `axe.run()` against the DOM.
- Violations at the "critical" or "serious" level fail the build.
- Results are posted as a PR comment with links to remediation guidance.

Accessibility tests live alongside the existing web test suite in `apps/web/src/__tests__/` and use the same jsdom + Testing Library setup.

### v3 Project Structure

v3 reorganizes the codebase toward feature-based modules while preserving backward compatibility:

```
apps/
  api/
    src/
      features/           # Feature modules (self-contained)
        hackathons/       # Routes, handlers, validators for hackathon CRUD
        judging/          # Scoring, rubrics, leaderboard
        teams/            # Team management, invitations
        webhooks/         # GitHub event processing
        notifications/    # Email, push, in-app notifications
      shared/             # Cross-feature utilities (auth, response helpers)
  web/
    src/
      features/           # Feature-based page modules
      components/
        ui/               # shadcn/ui primitives (unchanged)
        shared/           # Cross-feature shared components
packages/
  ui/                     # New: shared component library package
```

Each feature module contains its own routes, handlers, validators, and tests. Shared utilities remain in their current locations. Migration to the new structure is incremental -- existing code continues to work during the transition.

### Expanded Anti-Patterns

v3 adds the following entries to the anti-patterns table:

| Anti-pattern | Why | Use instead |
|--------------|-----|-------------|
| Feature code in `shared/` utilities | Shared utilities become a dumping ground | Place feature logic in the feature module |
| Cross-feature direct imports | Creates tight coupling between features | Use the shared utilities layer or event-based communication |
| Skipping the RFC process | Large changes without consensus cause rework | File an RFC for changes affecting 3+ packages |
| Ignoring CODEOWNERS reviews | Domain experts catch issues others miss | Wait for code owner approval before merging |
| Disabling axe-core checks | Accessibility regressions compound quickly | Fix the violation or document an exception with justification |
| Hardcoded bundle size in tests | Limits drift out of date silently | Use the centralized performance budget config |
