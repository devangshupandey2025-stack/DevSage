# Source Tree Analysis — DevSage

**Generated:** 2026-02-18

---

## Annotated Directory Tree

```
DevSage/                                    # Monorepo root (Turborepo + pnpm)
├── apps/
│   ├── api/                                # @devsage/api — Cloudflare Worker
│   │   ├── src/
│   │   │   ├── index.ts                    # ★ Entry point: Hono app, route mounting, Worker exports
│   │   │   ├── routes/                     # REST API route handlers (15 files)
│   │   │   │   ├── auth.ts                 # /auth — Registration, login, session management
│   │   │   │   ├── hackathons.ts           # /api/v1/hackathons — CRUD, state transitions
│   │   │   │   ├── teams.ts               # /api/v1/.../teams — Team lifecycle
│   │   │   │   ├── team-repos.ts          # /api/v1/.../teams/:id/repo — GitHub repo linking
│   │   │   │   ├── submissions.ts         # /api/v1/.../submissions — Tag-based submissions
│   │   │   │   ├── judging.ts             # /api/v1/.../judging — Rubric, scoring, leaderboard
│   │   │   │   ├── rounds.ts             # /api/v1/.../rounds — Multi-round management
│   │   │   │   ├── organizers.ts          # /api/v1/.../organizers — Organizer role management
│   │   │   │   ├── announcements.ts       # /api/v1/.../announcements — Hackathon announcements
│   │   │   │   ├── audit.ts              # /api/v1/.../audit — Audit event queries
│   │   │   │   ├── workspaces.ts          # /api/v1/workspaces — Workspace management
│   │   │   │   ├── admin.ts              # /api/v1/admin — Platform admin operations
│   │   │   │   ├── notifications.ts       # /api/v1/notifications — In-app notifications
│   │   │   │   ├── invites.ts            # /api/v1/invites — Team/judge invite acceptance
│   │   │   │   └── webhooks.ts            # /webhooks/github — GitHub webhook receiver
│   │   │   ├── middleware/                 # Request pipeline middleware (8 files)
│   │   │   │   ├── cors.ts               # Dynamic origin validation
│   │   │   │   ├── request-id.ts          # X-Request-Id UUID generation
│   │   │   │   ├── auth.ts               # JWT extraction (optionalAuth, authMiddleware)
│   │   │   │   ├── error-handler.ts       # Global error → structured response
│   │   │   │   ├── hackathon.ts           # Slug → hackathon context resolution
│   │   │   │   ├── role.ts               # Per-request role resolution (6-tier)
│   │   │   │   ├── platform-admin.ts      # Platform admin guard
│   │   │   │   └── rate-limit.ts          # KV-backed per-IP/user rate limiting
│   │   │   ├── durable-objects/
│   │   │   │   └── hackathon-state-machine.ts  # ★ Core DO: 5-state lifecycle, alarms
│   │   │   ├── queue/                     # Queue consumers (6 files)
│   │   │   │   ├── index.ts              # Queue dispatcher
│   │   │   │   ├── push-handler.ts        # GitHub push event processing
│   │   │   │   ├── tag-create-handler.ts  # Submission creation from tags
│   │   │   │   ├── tag-delete-handler.ts  # Tag deletion handling
│   │   │   │   ├── installation-handler.ts # GitHub App installation events
│   │   │   │   ├── notification-handler.ts # Notification delivery (email + in-app)
│   │   │   │   └── notification-logic.ts  # Notification recipient resolution
│   │   │   ├── cron/
│   │   │   │   └── index.ts              # Hourly: deadline checks, reminders
│   │   │   ├── services/                  # External service integrations
│   │   │   │   ├── email.ts              # SMTP email (fail-open, 10s timeout)
│   │   │   │   ├── github.ts             # GitHub API client
│   │   │   │   └── judging-service.ts     # Scoring calculation logic
│   │   │   ├── lib/                       # Shared utilities (14 files)
│   │   │   │   ├── jwt.ts                # HMAC SHA-256 sign/verify (crypto.subtle)
│   │   │   │   ├── refresh-token.ts       # Rotating refresh tokens, replay detection
│   │   │   │   ├── response.ts           # Response envelope helpers
│   │   │   │   ├── audit.ts              # Hash-chain audit logging
│   │   │   │   ├── cookies.ts            # HttpOnly cookie helpers
│   │   │   │   ├── do-client.ts          # Durable Object client wrapper
│   │   │   │   ├── webhook-normalize.ts   # GitHub payload → typed events
│   │   │   │   ├── allowed-origin.ts      # Origin validation logic
│   │   │   │   ├── password.ts           # Password hashing (bcrypt alternative)
│   │   │   │   ├── submission-tag.ts      # Tag parsing for submissions
│   │   │   │   ├── queue-utils.ts        # Queue producer helpers
│   │   │   │   ├── etag.ts              # ETag generation
│   │   │   │   ├── constants.ts          # API constants
│   │   │   │   └── utils.ts             # General utilities
│   │   │   ├── types/
│   │   │   │   ├── env.ts                # Worker bindings type (AppEnv)
│   │   │   │   ├── auth.ts              # Auth-related types
│   │   │   │   └── cloudflare-test.d.ts   # Test type augmentation
│   │   │   └── __tests__/                # Integration tests (vitest-pool-workers)
│   │   ├── wrangler.jsonc                 # Worker config: D1, KV, DOs, Queues, Cron
│   │   └── package.json
│   │
│   ├── web/                               # @devsage/web — devsage.org
│   │   ├── src/
│   │   │   ├── main.tsx                   # ★ Entry: React 18 + Router + Query + Auth
│   │   │   ├── App.tsx                    # Route definitions (lazy-loaded pages)
│   │   │   ├── pages/                     # 12 routes
│   │   │   │   ├── home.tsx              # Landing page (GSAP animations)
│   │   │   │   ├── login.tsx, register.tsx
│   │   │   │   ├── dashboard.tsx, profile.tsx
│   │   │   │   ├── browse-hackathons.tsx, hackathon-detail.tsx
│   │   │   │   ├── leaderboard.tsx
│   │   │   │   ├── accept-invite.tsx
│   │   │   │   └── participant-dashboard/  # Complex nested feature module
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn/radix primitives
│   │   │   │   ├── protected-route.tsx
│   │   │   │   ├── dashboard-layout.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── contexts/
│   │   │   │   └── auth-context.tsx       # AuthProvider (user state, auto-refresh)
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                # Fetch wrapper (401→refresh→retry)
│   │   │   │   └── utils.ts             # cn() class merging
│   │   │   └── __tests__/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── platform/                          # @devsage/platform — platform.devsage.org
│   │   ├── src/
│   │   │   ├── main.tsx                   # ★ Entry: React 18 + Router + Query + Auth
│   │   │   ├── App.tsx                    # Route definitions (21 pages)
│   │   │   ├── pages/                     # 21 routes (organizer + judge)
│   │   │   │   ├── hackathon-manage.tsx, hackathon-overview.tsx
│   │   │   │   ├── teams.tsx, team-detail.tsx
│   │   │   │   ├── submissions.tsx
│   │   │   │   ├── judging.tsx, judge-scoring.tsx
│   │   │   │   ├── judge-assignments.tsx, judge-invite-accept.tsx
│   │   │   │   ├── rounds.tsx, announcements.tsx
│   │   │   │   ├── activity.tsx, analytics.tsx
│   │   │   │   ├── leaderboard.tsx, settings.tsx
│   │   │   │   └── login.tsx, dashboard.tsx, profile.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn/radix primitives
│   │   │   │   ├── layout/              # Sidebar + topbar layout system
│   │   │   │   └── common/              # Reusable: status-badge, metric-card, etc.
│   │   │   ├── contexts/
│   │   │   │   └── auth-context.tsx
│   │   │   ├── lib/
│   │   │   │   ├── queries.ts            # React Query factory pattern
│   │   │   │   ├── api.ts
│   │   │   │   └── utils.ts
│   │   │   └── __tests__/
│   │   └── package.json
│   │
│   └── admin/                             # @devsage/admin — shikdd.devsage.org
│       ├── src/
│       │   ├── main.tsx                   # ★ Entry: React 18 + Router + Auth (no Query)
│       │   ├── App.tsx                    # Route definitions (11 pages)
│       │   ├── pages/                     # 11 routes (platform admin)
│       │   │   ├── dashboard.tsx, users.tsx
│       │   │   ├── hackathons.tsx, hackathon-detail.tsx
│       │   │   ├── workspaces.tsx, workspace-detail.tsx
│       │   │   ├── admins.tsx, invites.tsx
│       │   │   └── login.tsx, profile.tsx
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── protected-route.tsx
│       │   │   └── dashboard-layout.tsx
│       │   ├── contexts/
│       │   │   └── auth-context.tsx
│       │   └── lib/
│       │       ├── api.ts
│       │       └── utils.ts
│       └── package.json
│
├── packages/
│   ├── shared/                            # @devsage/shared — Zod schemas + types
│   │   ├── src/
│   │   │   ├── index.ts                   # Barrel export (26 schema files)
│   │   │   └── schemas/                   # 26 schema files by domain
│   │   │       ├── constants.ts          # Enums: hackathon status, roles, etc.
│   │   │       ├── api.ts               # Response envelope, pagination schemas
│   │   │       ├── user.ts, team.ts, hackathon.ts, workspace.ts
│   │   │       ├── submission.ts, judging.ts, scoring.ts
│   │   │       └── ... (notification, audit, webhook, etc.)
│   │   └── package.json
│   │
│   ├── db/                                # @devsage/db — Drizzle ORM + D1
│   │   ├── src/
│   │   │   ├── index.ts                   # DB exports
│   │   │   ├── client.ts                 # createDb() D1 client factory
│   │   │   └── schema/                   # 46 schema files across domain modules
│   │   │       └── index.ts              # Schema barrel export
│   │   ├── migrations/                    # D1 SQL migrations
│   │   └── package.json
│   │
│   └── config/                            # @devsage/config — Shared configs
│       ├── tsconfig.base.json             # Base TypeScript config
│       ├── tsconfig.react.json            # React-specific config
│       ├── tsconfig.worker.json           # Workers-specific config
│       ├── eslint.config.mjs              # ESLint 9 flat config
│       └── package.json
│
├── scripts/                               # Build & deploy scripts
│   ├── generate-hackathon-pages.js
│   ├── generate-hackathon-site.js
│   └── dev-reset-db.mjs
│
├── templates/                             # Hackathon site template
│   └── hackathon-site/                    # Template for {slug}.devsage.org
│
├── docs/                                  # Project documentation
│   ├── api/                              # 14 API endpoint docs
│   └── frontend/                         # Frontend app guides
│
├── turbo.json                             # Turborepo pipeline config
├── pnpm-workspace.yaml                    # Workspace definition
├── package.json                           # Root: scripts, devDeps, engines
└── .github/
    ├── workflows/secret-scan.yml          # CI: gitleaks on PR/push
    ├── copilot-instructions.md            # AI coding context
    ├── prompts/                           # AI prompt templates
    └── agents/                            # AI agent definitions
```

---

## Critical Folders Summary

| Folder | Purpose | Complexity |
|--------|---------|------------|
| `apps/api/src/routes/` | 15 route files, ~90+ endpoints | High |
| `apps/api/src/middleware/` | 8 middleware (auth chain, RBAC, rate limit) | High |
| `apps/api/src/durable-objects/` | HackathonStateMachine (5-state lifecycle) | Very High |
| `apps/api/src/queue/` | 6 queue handlers (webhooks, notifications) | High |
| `apps/api/src/lib/` | 14 utility modules (JWT, audit, cookies) | Medium |
| `apps/api/src/services/` | 3 external services (email, GitHub, judging) | Medium |
| `packages/db/src/schema/` | 36 Drizzle table definitions | Medium |
| `packages/shared/src/schemas/` | 26 Zod schema files | Medium |
| `apps/platform/src/pages/` | 21 organizer/judge pages | Medium |
| `apps/web/src/pages/` | 12 participant pages | Medium |
| `apps/admin/src/pages/` | 11 admin pages | Low |
