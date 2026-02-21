# @devsage/config

**Shared Configuration**

Shared TypeScript and ESLint configuration for the DevSage monorepo. This package contains no runtime code -- only configuration files consumed by other packages and apps.

## Files

| File | Purpose |
|------|---------|
| `tsconfig.base.json` | Base TypeScript config: strict mode, ESM, ES2022 target |
| `tsconfig.react.json` | Extends base, adds JSX support for the web app |
| `tsconfig.worker.json` | Extends base, adds Cloudflare Workers types |
| `eslint.config.mjs` | ESLint 9+ flat config shared across all packages |

## Usage

### TypeScript

Reference the appropriate config variant from any package's `tsconfig.json`:

```json
{
  "extends": "@devsage/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Available variants:

- `tsconfig.base.json` -- for library packages (`packages/db`, `packages/shared`)
- `tsconfig.react.json` -- for the web app (`apps/web`)
- `tsconfig.worker.json` -- for the API worker (`apps/api`)

### ESLint

Import and spread the base config in any package's `eslint.config.mjs`:

```javascript
import baseConfig from '@devsage/config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Package-specific overrides
  },
];
```

## Key ESLint Rules

| Rule | Severity | Notes |
|------|----------|-------|
| `no-unused-vars` | error | Args prefixed with `_` are ignored (`argsIgnorePattern: '^_'`) |
| `no-explicit-any` | warn | Discouraged but not blocking |
| `no-console` | warn | `console.warn` and `console.error` are allowed; `console.log` is not |

## Notes

- This package has no build step. Configuration files are consumed directly.
- There are no runtime dependencies.
- All TypeScript configs enforce strict mode and ESM module resolution.
- The ESLint config uses the flat config format introduced in ESLint 9+.
