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
│   └── auth-context.tsx  # useAuth() — better-auth session + role-enriched JWT
├── lib/
│   ├── api.ts            # apiRequest<T>() — Bearer token from auth, 401 auto-refresh
│   ├── auth-client.ts    # better-auth/react client (signIn, signUp, signOut, useSession)
│   └── utils.ts          # cn() utility
└── pages/                # 10 page components
```

## Key Patterns

### Auth (better-auth + Bearer Token)
Same pattern as `apps/platform`:
- `lib/auth-client.ts` creates `better-auth/react` client pointing at `VITE_AUTH_URL` (default `http://localhost:8788`)
- Plugins: `twoFactorClient`, `passkeyClient`, `magicLinkClient`
- `AuthProvider` gets session via `authClient.getSession()`, calls `GET {AUTH_URL}/token` for role-enriched JWT
- `setTokenGetter(refreshToken)` wires token refresh into `apiRequest()`
- Decoded JWT provides `isPlatformAdmin`, `isOrganizer`, `hackathonRoles`, `workspaceRoles`

### Access Control
`ProtectedRoute` checks `isAuthenticated` and `isPlatformAdmin`. Non-admins see "Access Denied". Admin status comes from `platform_admins` table (embedded in JWT by auth worker).

### Data Fetching
No TanStack Query — uses direct `apiRequest()` calls in `useState` + `useEffect`. Intentionally simpler than platform.

### API Client (`lib/api.ts`)
Same Bearer token pattern as platform — `apiRequest()` injects `Authorization: Bearer` header, auto-refreshes on 401. Uses `VITE_API_URL` or `VITE_API_ORIGIN`.

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
- `VITE_AUTH_URL` — Auth worker URL (default `http://localhost:8788`)
- `VITE_API_URL` / `VITE_API_ORIGIN` — API worker URL
