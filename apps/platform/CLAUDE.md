# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/platform

Organizer/Judge dashboard React SPA at `platform.devsage.org` (port 5174). For hackathon organizers and judges — team management, submissions review, judging workflows, analytics, announcements. Not for participant-facing features (those go in `apps/web`).

## Commands

```bash
# From repo root
pnpm --filter @devsage/platform run dev       # Vite dev server on port 5174
pnpm --filter @devsage/platform run build     # Type-check + Vite production build
pnpm --filter @devsage/platform run test      # vitest run --passWithNoTests
pnpm --filter @devsage/platform run deploy    # Build + wrangler deploy
```

## Source Layout

```
src/
├── App.tsx               # Route definitions (createBrowserRouter, direct imports)
├── main.tsx              # React root — QueryClientProvider + AuthProvider + RouterProvider
├── index.css             # Tailwind v4 theme (#CCFF00 lime accent, dark-first)
├── components/
│   ├── ui/               # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── common/           # Reusable: PageHeader, MetricCard, StatusBadge, CountdownTimer, EmptyState
│   ├── layout/           # AppLayout (sidebar + topbar), Sidebar (collapsible), TopBar
│   ├── dashboard-layout.tsx
│   └── protected-route.tsx  # Auth + organizer role check
├── contexts/
│   └── auth-context.tsx  # useAuth() — API cookie auth via /auth/me
├── lib/
│   ├── api.ts            # apiRequest<T>() — credentials: include, 401->/auth/refresh retry
│   ├── queries.ts        # React Query factories + TypeScript types for all entities
│   └── utils.ts          # cn() utility
└── pages/                # 21 page components (direct imports, no lazy loading)
```

## Key Patterns

### Auth (API Cookie Sessions)
- Login calls API `/auth/login` and receives HttpOnly cookies.
- `AuthProvider` loads `GET /auth/me`, and logout uses `POST /auth/logout`.
- Role/access state is server-derived; no client token getter or JWT decoding.

### API Client (`lib/api.ts`)
- `apiRequest<T>()` sends `credentials: 'include'` with each request
- On 401: calls `POST /auth/refresh`, then retries
- Uses `VITE_API_URL` or `VITE_API_ORIGIN` for API base URL
- Cookie-based auth only

### Routing
React Router v7, no lazy loading. Routes nest under `ProtectedRoute` → `AppLayout`. Most are hackathon-scoped: `/hackathons/:slug/*`.

```
Public: /login, /invite/:code, /invite/judge/:token
Protected: /dashboard, /profile, /hackathons/:slug/[teams|submissions|judging|leaderboard|rounds|announcements|activity|audit|analytics|settings|judge|judge/assignments]
```

### Access Control
`ProtectedRoute` checks `isAuthenticated` and `isOrganizer`. Non-organizers see "Access Denied".

### Query Factories (`lib/queries.ts`)
Centralized React Query definitions with types: `hackathonQueries`, `judgeQueries`, `notificationQueries`, `roundQueries`, `organizerQueries`. All use hierarchical query keys: `['hackathons', slug, 'teams', id]`.

### Layout
`AppLayout` = collapsible Sidebar (240px → 72px) + TopBar. Context-aware nav: hackathon-specific links when in hackathon detail view. Framer Motion page transitions.

### Page Pattern
Pages use `PageHeader` + Skeleton loading + `EmptyState` + Framer Motion staggered list animations + Sonner toasts.

### Vite Dev Proxy
Proxies `/api/v1`, `/auth` → `http://localhost:8787`.

### Path Alias
`@/` maps to `./src/`.

## Environment Variables
- `VITE_API_URL` / `VITE_API_ORIGIN` — API worker URL
