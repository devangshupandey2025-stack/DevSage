# DevSage — Project Overview

**Generated:** 2026-02-18  
**Type:** Monorepo (Turborepo + pnpm)  
**Primary Language:** TypeScript (strict)  
**Architecture:** Edge-native serverless (Cloudflare Workers)  
**Domain:** GitHub-native hackathon platform

---

## Executive Summary

DevSage is a hackathon management platform built entirely on Cloudflare's edge infrastructure. It provides end-to-end hackathon lifecycle management — from workspace creation and team formation through submission tracking, judging, and results publication. The platform integrates deeply with GitHub for repository linking, webhook-driven submission tracking, and bot-assisted workflows.

The system is organized as a **Turborepo monorepo** with 7 parts: one API backend (Cloudflare Workers with Hono), three React SPA frontends (each deployed as Workers Static Assets), and three shared packages.

---

## Technology Stack

| Category | Technology | Version | Part(s) |
|----------|-----------|---------|---------|
| Monorepo | Turborepo + pnpm | pnpm 10.28.2 | Root |
| Language | TypeScript (strict) | 5.9.3 | All |
| Runtime | Node.js ≥20, Cloudflare Workers | — | All / API |
| API Framework | Hono | 4.6.14 | API |
| Database | Cloudflare D1 (SQLite) | — | API |
| ORM | Drizzle ORM | 0.36.4 | API, DB |
| Durable Objects | HackathonStateMachine (SQLite-backed) | — | API |
| Queues | Cloudflare Queues | — | API |
| KV Store | Cloudflare KV | — | API |
| Validation | Zod + @hono/zod-validator | 3.25.0 | API, Shared |
| Frontend | React | 18.3.1 | Web, Platform, Admin |
| Build Tool | Vite | 6.0.0 | Web, Platform, Admin |
| Styling | Tailwind CSS v4 | 4.0.0 | Web, Platform, Admin |
| UI Components | Radix UI + shadcn/ui | — | Web, Platform, Admin |
| Routing | React Router DOM | 7.0.0 | Web, Platform, Admin |
| Server State | TanStack React Query | 5.90.21 | Web, Platform |
| Animation | Framer Motion + GSAP | — | Web |
| Testing | Vitest | 3.2.4 | All |
| API Testing | @cloudflare/vitest-pool-workers | 0.12.10 | API |
| Frontend Testing | @testing-library/react + jsdom | — | Web, Platform, Admin |
| Deploy | Wrangler (Workers Static Assets) | 4.63.0 | All apps |
| Linting | ESLint 9 (flat config) | 9.39.2 | All |
| Secret Scanning | secretlint + husky + lint-staged | — | Root |

---

## Repository Structure

```
DevSage/                          # Monorepo root
├── apps/
│   ├── api/                      # Cloudflare Worker — Hono API, DOs, Queues, Cron
│   ├── admin/                    # shikdd.devsage.org — Platform admin panel
│   ├── platform/                 # platform.devsage.org — Organizer/Judge dashboard
│   └── web/                      # devsage.org — Main participant website
├── packages/
│   ├── config/                   # Shared tsconfig + ESLint flat config
│   ├── db/                       # Drizzle ORM schemas (~36 tables) + D1 migrations
│   └── shared/                   # Zod schemas, types, constants (only dep: zod)
├── docs/                         # Project documentation
├── scripts/                      # Build/deploy scripts
└── templates/                    # Hackathon site template
```

---

## Part Summary

| Part | Package | Type | Domain | Deploy Target |
|------|---------|------|--------|---------------|
| API | `@devsage/api` | Backend (Cloudflare Worker) | REST API, auth, webhooks, queues, cron | `api.devsage.org` |
| Web | `@devsage/web` | Frontend (React SPA) | Participant-facing: browse, register, submit | `devsage.org` |
| Platform | `@devsage/platform` | Frontend (React SPA) | Organizer/Judge: manage hackathons, scoring | `platform.devsage.org` |
| Admin | `@devsage/admin` | Frontend (React SPA) | Platform admins: user/workspace management | `shikdd.devsage.org` |
| Shared | `@devsage/shared` | Library | Zod schemas, types, constants | npm package |
| DB | `@devsage/db` | Library | Drizzle ORM schemas, D1 client | npm package |
| Config | `@devsage/config` | Library | tsconfig variants, ESLint config | npm package |

---

## Dependency Graph

```
apps/api      → @devsage/shared, @devsage/db, @devsage/config
apps/admin    → @devsage/shared
apps/platform → @devsage/shared
apps/web      → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone, configs only)
```

**Rules:** No circular dependencies. No cross-app imports. Frontend apps import from `@devsage/shared` only.

---

## Links to Detailed Documentation

- [Source Tree Analysis](./source-tree-analysis.md)
- [Architecture — API](./architecture-api.md)
- [Architecture — Frontends](./architecture-frontends.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Integration Architecture](./integration-architecture.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
