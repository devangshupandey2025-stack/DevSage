# Contributing

> Code style, PR process, and testing standards.

## Code Style

### ESM Strict
All imports use explicit `.js` extensions in barrel exports:
```ts
export { createHackathonSchema } from './schemas/hackathon.js';
```

### Console
```ts
// ❌ Banned (ESLint warn)
console.log('debug');

// ✅ Allowed
console.warn('Non-critical issue');
console.error('Something broke');
```

### Unused Variables
```ts
// ✅ Prefix with _ to suppress lint
const _unusedResult = await someFunction();

function handler(_req: Request, env: Env) { ... }
```

### TypeScript
- `strict: true` everywhere
- No `as any`, `@ts-ignore`, or `@ts-expect-error`
- `no-explicit-any` is a warning — use `unknown` or proper types

### Timestamps & IDs
```ts
const now = new Date().toISOString();       // UTC ISO-8601
const id = crypto.randomUUID();             // Workers-native UUID
```

## Testing

### Framework
- **Vitest** everywhere
- API tests: `@cloudflare/vitest-pool-workers` (real Workers runtime)
- Frontend tests: `jsdom` + `@testing-library/react`

### File Location
```
src/__tests__/
├── auth.test.ts
├── teams.test.ts
└── ...
```

### Running Tests
```bash
pnpm test             # All packages
pnpm --filter @devsage/api test    # API only
```

### Style
- Integration-first, minimal mocking
- Inline test helpers (no shared test utils)
- `singleWorker: true` for API tests (shared D1 state)

## PR Process

1. Create feature branch from `main`
2. Make changes, write tests
3. `pnpm lint && pnpm typecheck && pnpm test`
4. Pre-commit hook runs `secretlint` on staged files
5. Push — pre-push hook runs full secret scan
6. Open PR — CI runs lint, typecheck, test, build, gitleaks
7. Review required before merge
8. Squash merge to `main`

## Commit Messages

Use conventional commits:
```
feat(api): add team invite endpoint
fix(platform): correct leaderboard sorting
docs: update deployment guide
chore: bump dependencies
```

## Project Structure Rules

- `apps/*` never import from each other
- Frontend apps only import from `@devsage/shared` (never `@devsage/db`)
- No circular dependencies
- Durable Objects must be re-exported from `apps/api/src/index.ts`
- New DB tables: add to `packages/db/src/schema/`, re-export from `schema/index.ts`
- New Zod schemas: add to `packages/shared/src/schemas/`, re-export from `src/index.ts`
