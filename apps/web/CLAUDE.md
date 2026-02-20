# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/web

Public-facing React SPA at `devsage.org` (port 5173). Participant-facing: landing page, hackathon browsing, team management, participant dashboard, leaderboard. Not for organizer/management features (those belong in `apps/platform`).

## Commands

```bash
# From repo root
pnpm --filter @devsage/web run dev       # Vite dev server on port 5173
pnpm --filter @devsage/web run build     # Type-check + Vite production build
pnpm --filter @devsage/web run test      # Run vitest (jsdom)
pnpm --filter @devsage/web run preview   # Preview production build
pnpm --filter @devsage/web run deploy    # Build + wrangler deploy
```

## Source Layout

```
src/
├── App.tsx               # Route definitions (createBrowserRouter, lazy-loaded pages)
├── main.tsx              # React root — QueryClientProvider + AuthProvider + RouterProvider
├── index.css             # Tailwind v4 theme (CSS variables, brand color #CCFF00)
├── components/
│   ├── ui/               # shadcn/ui primitives (button, card, dialog, input, tabs, etc.)
│   ├── dashboard-layout.tsx   # Authenticated layout wrapper (navbar + outlet)
│   ├── protected-route.tsx    # Auth guard — redirects to /login if unauthenticated
│   ├── preloader.tsx          # Loading animation component
│   └── ErrorBoundary.tsx
├── contexts/
│   └── auth-context.tsx  # useAuth() — cookie-based, calls /auth/me + /auth/refresh
├── hooks/
│   └── use-custom-hackathon-page.ts  # Dynamic import via import.meta.glob
├── lib/
│   ├── api.ts            # apiRequest<T>() — cookie-based fetch with 401→auto-refresh→retry
│   └── utils.ts          # cn() — clsx + tailwind-merge
├── pages/                # Route pages (lazy-loaded)
│   ├── participant-dashboard/  # Feature module with sub-components, hooks, types, utils
│   └── hackathons/       # Custom per-hackathon landing pages (import.meta.glob)
└── __tests__/            # jsdom + @testing-library/react tests
```

## Key Patterns

### Auth (Cookie-Based — Legacy)
Unlike platform/admin which use better-auth client + Bearer tokens, web still uses cookie-based auth:
- `AuthProvider` calls `GET /auth/me` on mount with `credentials: 'include'`
- `apiRequest()` sends cookies, on 401 tries `POST /auth/refresh`, retries original request
- No `auth-client.ts` — migration to better-auth pending

### Routing
React Router v7 with `createBrowserRouter`. All pages use `lazy()` + dynamic `import()` for code splitting. Protected routes wrap with `ProtectedRoute` → `DashboardLayout` → `Outlet`.

### API Client (`lib/api.ts`)
`apiRequest<T>(endpoint, options)` — typed fetch wrapper:
- Sends `credentials: 'include'` (HttpOnly cookies)
- On 401: silently calls `POST /auth/refresh`, retries original request
- Supports `VITE_API_ORIGIN` env var for API base URL
- Throws `ApiError { status, message }`

### Data Fetching
TanStack React Query v5 with stale time defaults. Query key factories for hierarchical cache invalidation (see `pages/participant-dashboard/hooks.ts`). Polling on submissions (30s) and activity feeds (60s).

### Participant Dashboard
Feature module in `pages/participant-dashboard/` with:
- `ParticipantDashboardPage.tsx` — main layout
- `hooks.ts` — TanStack Query hooks for hackathon data
- `types.ts` — local interfaces (DashboardPhase, ApiEnvelope, etc.)
- `utils.ts` — pure functions: `resolveDashboardPhase()`, `buildChecklist()`, etc.
- `components/` — PhaseHeader, DeadlineBar, ChecklistPanel, TeamRepoCard, SubmissionStatusCard, ActivityFeed, etc.

### Vite Dev Proxy
Proxies `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787` (API worker).

### Path Alias
`@/` maps to `./src/`.

### Styling
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Brand color: `#CCFF00` (lime green), dark-first theme
- shadcn/ui components in `components/ui/` using CVA for variants
- Animations: framer-motion for page transitions, GSAP available

### Custom Hackathon Pages
Per-hackathon landing pages in `pages/hackathons/` loaded dynamically via `import.meta.glob`. Hook: `useCustomHackathonPage(slug)`.

## Testing
- **Environment**: jsdom + `@testing-library/react`
- **Config**: `vitest.config.ts` — globals enabled, path alias configured
- **Location**: `src/__tests__/`

## Environment Variables
Only `VITE_*` variables are client-visible. Never put secrets in this app.
- `VITE_API_ORIGIN` — API base URL (optional, defaults to same-origin proxy in dev)
