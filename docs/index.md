# DevSage — Documentation Index

**Updated:** 2026-02-22  
**Type:** Monorepo (Turborepo + pnpm) with 8 parts  
**Primary Language:** TypeScript (strict)  
**Architecture:** Edge-native serverless (Cloudflare Workers)  
**API:** 108 REST endpoints across 17 route files  
**Database:** 49 tables, 148 indexes (Cloudflare D1)

---

## Quick Reference

### API Backend (`@devsage/api`)
- **Type:** Cloudflare Worker (Hono)
- **Tech:** Hono 4.6, D1, Drizzle ORM, Durable Objects, Queues, KV
- **Root:** `apps/api/`
- **Deploy:** `api.devsage.org`
- **Endpoints:** 108 (48 GET, 37 POST, 10 PATCH, 12 DELETE, 1 PUT)

### Web Frontend (`@devsage/web`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4, React Query
- **Root:** `apps/web/`
- **Deploy:** `devsage.org`

### Platform Frontend (`@devsage/platform`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4, React Query
- **Root:** `apps/platform/`
- **Deploy:** `platform.devsage.org`
- **Pages:** 20+ (dashboard, hackathon management, judging, teams, etc.)

### Admin Frontend (`@devsage/admin`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4
- **Root:** `apps/admin/`
- **Deploy:** `shikdd.devsage.org`

### Judge Frontend (`@devsage/judge`)
- **Type:** React SPA (Workers Static Assets)
- **Tech:** React 18, Vite 6, Tailwind v4
- **Root:** `apps/judge/`
- **Deploy:** `judge.devsage.org`

### Shared Packages
- **@devsage/shared** — Zod schemas, types, constants (`packages/shared/`)
- **@devsage/db** — Drizzle ORM schemas, D1 client, 49 tables (`packages/db/`)
- **@devsage/config** — tsconfig variants, ESLint flat config (`packages/config/`)

---

## Documentation

### Core Docs
- [Project Overview](./project-overview.md) — Executive summary, tech stack, structure
- [User Flows](./user-flows.md) — Complete user journeys for all 4 roles (Admin, Organizer, Judge, Participant)
- [Architecture — API](./architecture-api.md) — Backend architecture, bindings, auth, middleware
- [Architecture — Frontends](./architecture-frontends.md) — React apps, routing, state management
- [API Contracts](./api-contracts.md) — All 108 REST endpoints with auth/role requirements
- [Data Models](./data-models.md) — 49-table database schema with relationships

### Operations
- [Deployment Guide](./deployment.md) — Production deployment, CI/CD, D1 migrations, CLI tool
- [Development Guide](./development-guide.md) — Local setup, commands, testing

### Reference
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory tree
- [Integration Architecture](./integration-architecture.md) — Cross-app communication, data flows
- [Backend-Frontend Integration](./backend-frontend-integration.md) — Auth, CORS, API client patterns

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
# Judge: http://localhost:5176
```

For detailed setup instructions, see the [Development Guide](./development-guide.md).
