# DevSage — Documentation Index

**Generated:** 2026-02-18  
**Type:** Monorepo (Turborepo + pnpm) with 7 parts  
**Primary Language:** TypeScript (strict)  
**Architecture:** Edge-native serverless (Cloudflare Workers)

---

## Quick Reference

### API Backend (`@devsage/api`)
- **Type:** Cloudflare Worker (Hono)
- **Tech:** Hono, D1, Drizzle ORM, Durable Objects, Queues, KV
- **Root:** `apps/api/`
- **Deploy:** `api.devsage.org`

### Web Frontend (`@devsage/web`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4, React Query
- **Root:** `apps/web/`
- **Deploy:** `devsage.org`

### Platform Frontend (`@devsage/platform`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4, React Query (factory pattern)
- **Root:** `apps/platform/`
- **Deploy:** `platform.devsage.org`

### Admin Frontend (`@devsage/admin`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4
- **Root:** `apps/admin/`
- **Deploy:** `shikdd.devsage.org`

### Shared Packages
- **@devsage/shared** — Zod schemas, types, constants (`packages/shared/`)
- **@devsage/db** — Drizzle ORM schemas, D1 client, 36 tables (`packages/db/`)
- **@devsage/config** — tsconfig variants, ESLint flat config (`packages/config/`)

---

## Generated Documentation

- [Project Overview](./project-overview.md) — Executive summary, tech stack, structure
- [Architecture — API](./architecture-api.md) — Backend architecture, bindings, auth, middleware
- [Architecture — Frontends](./architecture-frontends.md) — React apps, routing, state management
- [API Contracts](./api-contracts.md) — All 90+ REST endpoints with auth/role requirements
- [Data Models](./data-models.md) — 36-table database schema with relationships
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory tree, critical folders
- [Integration Architecture](./integration-architecture.md) — Cross-part communication, data flows
- [Development Guide](./development-guide.md) — Setup, commands, testing, deployment

---

## Other Documentation

- [Backend-Frontend Integration](./backend-frontend-integration.md)

### App-Level READMEs
- [API README](../apps/api/README.md)
- [Web README](../apps/web/README.md)
- [DB Package README](../packages/db/README.md)
- [Shared Package README](../packages/shared/README.md)
- [Config Package README](../packages/config/README.md)

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up API secrets
# Create apps/api/.dev.vars with required secrets (see Development Guide)

# 3. Build shared packages
pnpm build

# 4. Start all apps
pnpm dev
# API: http://localhost:8787
# Web: http://localhost:5173
# Platform: http://localhost:5174
# Admin: http://localhost:5175
```

For detailed setup instructions, see the [Development Guide](./development-guide.md).
