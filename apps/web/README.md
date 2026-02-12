# @devsage/web

**React SPA Frontend**

## Overview

React 18 single-page application built with Vite, Tailwind CSS v4, and shadcn/ui components. Provides participant and organizer dashboards for the DevSage hackathon platform. Deployed as Cloudflare Workers Static Assets.

## Directory Structure

```
src/
├── main.tsx              # Bootstrap: BrowserRouter + AuthProvider + Toaster
├── App.tsx               # All routes defined here
├── pages/                # Page components (home, login, dashboard, organiser-dashboard,
│                         #   hackathon-detail, team-management, leaderboard, profile, about, not-found, auth-callback)
├── components/           # Layout + shared components
│   ├── ui/               # shadcn/ui primitives (button, card, dialog, dropdown-menu, etc.)
│   ├── dashboard-layout.tsx  # Shared layout wrapper for dashboard pages
│   ├── protected-route.tsx   # Auth + role guard
│   └── custom-cursor.tsx     # Custom cursor effect
├── contexts/             # auth-context.tsx (AuthProvider + useAuth hook)
└── lib/                  # api.ts (fetch wrapper), utils.ts (cn helper)
```

## Development

```bash
# From repo root
pnpm dev                         # All apps in parallel

# Web only
pnpm --filter @devsage/web dev   # http://localhost:5173
```

## Dev Proxy

Vite proxies these paths to `http://localhost:8787` (wrangler dev) during local development:

- `/api/v1/*`
- `/auth/*`
- `/hackathons/*`
- `/webhooks/*`

In production, set `VITE_API_ORIGIN=https://api.devsage.org` (already configured in `.env.production`).

## Key Pages

| Page | Route | Role |
|------|-------|------|
| Home | `/` | Public |
| Login | `/login` | Public |
| Auth Callback | `/auth/callback` | Public |
| Dashboard | `/dashboard` | Authenticated |
| Organiser Dashboard | `/organiser` | Organiser roles |
| Hackathon Detail | `/hackathon/:slug` | Public |
| Team Management | `/hackathon/:slug/team` | Team members |
| Leaderboard | `/hackathon/:slug/leaderboard` | Public (when visible) |
| Profile | `/profile` | Authenticated |
| About | `/about` | Public |

## Auth Flow

1. OAuth buttons on the login page link to API endpoints (`/auth/github`, `/auth/google`).
2. The API handles the full OAuth exchange and sets an HttpOnly JWT cookie on the response.
3. `AuthProvider` (`contexts/auth-context.tsx`) fetches `/auth/me` on mount to hydrate user state.
4. The `useAuth()` hook exposes `{ user, isAuthenticated, isLoading }` to the component tree.
5. `ProtectedRoute` wraps guarded pages and redirects unauthenticated or unauthorized users.

## API Client

All API calls go through `apiRequest()` in `lib/api.ts`:

- Sends cookies automatically (`credentials: 'include'`).
- Auto-redirects to `/login` on 401 responses.
- Prepends `VITE_API_ORIGIN` when set (production), otherwise uses the Vite dev proxy.

For API route details, see [apps/api/README.md](../api/README.md).

## UI Stack

- **React 18** -- component framework
- **Tailwind CSS v4** -- utility-first styling
- **shadcn/ui** -- Radix-based UI primitives
- **Framer Motion** -- page transitions and animations
- **Lucide** -- icon set
- **Sonner** -- toast notifications

## Testing

```bash
pnpm --filter @devsage/web test
```

Vitest + jsdom + `@testing-library/react`. Tests live in `src/__tests__/`.

## Build and Deploy

```bash
pnpm --filter @devsage/web build    # tsc --noEmit && vite build
pnpm deploy:web                      # Build + wrangler deploy
```

Output is a static bundle deployed to Cloudflare Workers Static Assets via `wrangler deploy`.

## Conventions

- **Path alias:** `@/` maps to `src/` in imports.
- **Route definitions:** All routes live in `App.tsx`. The file `routes.tsx` exists but is unused.
- **Root redirect:** `/` redirects authenticated organisers to `/organiser` and participants to `/dashboard`.
- **Environment variables:** Only `VITE_*` variables are exposed to the client. Never place secrets in the web app.
