# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/admin

Platform admin panel React SPA at `shikdd.devsage.org` (port 5175). For SHIKDD platform administrators only — user management, hackathon oversight, workspace management, platform admin management, organizer invites. Not for organizer or participant features.

## Commands

```bash
# From repo root
pnpm --filter @devsage/admin run dev       # Vite dev server on port 5175
pnpm --filter @devsage/admin run build     # Type-check + Vite production build
pnpm --filter @devsage/admin run test      # vitest run --passWithNoTests
pnpm --filter @devsage/admin run deploy    # Build + wrangler deploy
```

## Source Layout

```
src/
├── App.tsx               # Route definitions (createBrowserRouter)
├── main.tsx              # React root — AuthProvider + RouterProvider (no QueryClientProvider)
├── index.css             # Tailwind v4 theme (#CCFF00 lime accent, dark-first)
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── dashboard-layout.tsx  # Sticky navbar with sidebar nav links
│   └── protected-route.tsx   # Auth + isPlatformAdmin check
├── contexts/
│   └── auth-context.tsx  # useAuth() — API cookie auth via /auth/me
├── lib/
│   ├── api.ts            # apiRequest<T>() — credentials: include, 401->/auth/refresh retry
│   └── utils.ts          # cn() utility
└── pages/                # 10 page components
```

## Key Patterns

### Auth (API Cookie Sessions)
- Login calls API `/auth/login` and receives HttpOnly cookies.
- `AuthProvider` checks `GET /auth/me` and logout uses `POST /auth/logout`.
- Auth state includes `isPlatformAdmin` from server response; no client JWT decoding.

### Access Control
`ProtectedRoute` checks `isAuthenticated` and `isPlatformAdmin`. Non-admins see "Access Denied". Admin status comes from server-side role resolution.

### Data Fetching
No TanStack Query — uses direct `apiRequest()` calls in `useState` + `useEffect`. Intentionally simpler than platform.

### API Client (`lib/api.ts`)
`apiRequest()` uses `credentials: 'include'`, and on 401 calls `POST /auth/refresh` then retries. Uses `VITE_API_URL` or `VITE_API_ORIGIN`.

### Routing
Flat structure, all protected except `/login`:
```
/           → Dashboard
/users      → User management
/hackathons → Hackathon list
/hackathons/:id → Hackathon detail
/workspaces, /workspaces/:id → Workspace management
/invites    → Organizer invites
/admins     → Platform admin management
/profile    → User profile
```

### Layout
`DashboardLayout` = sticky top navbar + sidebar nav. Simpler than platform's collapsible sidebar.

### Vite Dev Proxy
Proxies `/api/v1`, `/auth` → `http://localhost:8787`.

### Path Alias
`@/` maps to `./src/`.

## Environment Variables
- `VITE_API_URL` / `VITE_API_ORIGIN` — API worker URL
