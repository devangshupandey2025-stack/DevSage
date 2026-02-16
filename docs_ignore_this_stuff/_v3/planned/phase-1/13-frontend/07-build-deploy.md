# Build & Deploy

> Vite build config and Cloudflare Pages deployment for frontend apps.

## Vite Configuration

```ts
// apps/*/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api/v1': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
      '/hackathons': 'http://localhost:8787',
      '/webhooks': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

## Build Commands

```bash
# Build all apps (from repo root)
pnpm build                    # turbo build

# Build individual app
pnpm --filter @devsage/web build
pnpm --filter @devsage/platform build
pnpm --filter @devsage/admin build
```

Build output goes to `apps/*/dist/`.

## Cloudflare Pages Deployment

Each frontend app deploys to Cloudflare Pages:

```bash
# Deploy web app
pnpm deploy:web
# → wrangler pages deploy apps/web/dist --project-name devsage-web

# Deploy platform app
pnpm deploy:platform
# → wrangler pages deploy apps/platform/dist --project-name devsage-platform

# Deploy admin app
pnpm deploy:admin
# → wrangler pages deploy apps/admin/dist --project-name devsage-admin
```

## Environment Variables

Frontend env vars are `VITE_*` (client-visible, embedded at build time):

```bash
# apps/web/.env.production
VITE_API_ORIGIN=https://api.devsage.org
```

**Never put secrets in frontend env vars** — they're bundled into JavaScript.

## SPA Routing

Cloudflare Pages needs a `_redirects` file for SPA routing:

```
# apps/*/public/_redirects
/*  /index.html  200
```

This ensures all routes are handled by React Router.

## Implementation Notes

- Turbo handles build ordering: `@devsage/shared` builds first, then apps
- `sourcemap: true` for production debugging (Cloudflare Pages serves them)
- Dev proxy only works in `vite dev` — production uses `VITE_API_ORIGIN`
- Preview deploys: Cloudflare Pages creates preview URLs for each branch
- `@/` alias resolves to `src/` — enables clean imports like `@/components/ui/button`
