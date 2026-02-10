# apps/web — React SPA

Vite + React 18 + React Router + Tailwind CSS v4 + shadcn/ui. Participant and organizer dashboards.

## STRUCTURE

```
src/
├── main.tsx              # Bootstrap: BrowserRouter + AuthProvider + Toaster
├── App.tsx               # All routes defined here (NOT routes.tsx)
├── pages/                # Page components (10 pages)
├── components/           # Layout + shared components
│   └── ui/               # shadcn/ui primitives (button, card, dialog, etc.)
├── contexts/             # auth-context.tsx (AuthProvider + useAuth hook)
├── lib/                  # api.ts (fetch wrapper), utils.ts (cn helper)
└── __tests__/            # Vitest + @testing-library/react + jsdom
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add page | `src/pages/` | Add route in `App.tsx` |
| Add shadcn component | `src/components/ui/` | Follow existing shadcn/ui pattern |
| Change layout/nav | `src/components/dashboard-layout.tsx` | Shared layout wrapper |
| Auth guard | `src/components/protected-route.tsx` | `allowedRoles` prop for role gates |
| API calls | `src/lib/api.ts` | `apiRequest<T>(endpoint, options)` — uses `VITE_API_ORIGIN` in prod, includes cookies |
| Auth state | `src/contexts/auth-context.tsx` | `useAuth()` → `{ user, isAuthenticated, isLoading }` |
| Styling | `src/index.css` | Tailwind v4 directives |

## CONVENTIONS

- **Routing**: `App.tsx` owns all routes. `routes.tsx` exists but is UNUSED.
- **Path aliases**: `@/` → `src/` (configured in tsconfig + vite)
- **API client**: All API calls go through `apiRequest()` — handles 401 → redirect to `/login`
- **Auth flow**: OAuth buttons link to `${VITE_API_ORIGIN}/auth/google` or `${VITE_API_ORIGIN}/auth/github` (API handles redirect)
- **Role routing**: Root `/` redirects organizer → `/organizer`, participant → `/dashboard`
- **Components**: shadcn/ui for primitives. Layouts in `components/`. Pages in `pages/`.
- **Toast**: `sonner` (Toaster in main.tsx). Use `toast()` from sonner.

## DEV PROXY

Vite proxies `/auth/*`, `/hackathons/*`, `/webhooks/*` → `http://localhost:8787` (wrangler dev). No CORS config needed in dev.

In production, set `VITE_API_ORIGIN=https://api.devsage.org` (see `apps/web/.env.production`).

## ANTI-PATTERNS

- Importing from `routes.tsx` (it's dead code)
- Putting secrets in web env — only `VITE_*` vars allowed (client-visible)
- Direct `fetch('/...')` without `apiRequest()` — loses cookie handling + 401 redirect

## TESTING

```bash
pnpm --filter @devsage/web test        # Run web tests
```

jsdom environment, `@testing-library/react`. Tests in `src/__tests__/`.
