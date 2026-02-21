# apps/web — Main Website

Vite + React 18 + React Router v7 + React Query + Tailwind CSS v4 + shadcn/ui. Public website and participant dashboard. Deployed as Cloudflare Workers Static Assets at `devsage.org`.

## STRUCTURE

```
src/
├── main.tsx              # Bootstrap: BrowserRouter + QueryClient + AuthProvider + Toaster
├── App.tsx               # All routes defined here (single file, code-split via lazy())
├── index.css             # Tailwind v4 directives + theme (CSS vars, accent #CCFF00)
├── pages/                # Page components (13 pages, 6 lazy-loaded)
│   ├── participant-dashboard/
│   │   └── components/   # Dashboard widgets (9 components)
│   └── hackathons/       # Per-hackathon custom pages
├── components/           # Layout + shared components
│   ├── protected-route.tsx   # Auth guard with role check
│   ├── dashboard-layout.tsx  # Sticky navbar + profile dropdown + Outlet
│   ├── custom-cursor.tsx     # Animated cursor (Framer Motion)
│   └── ui/               # shadcn/ui primitives (8 components)
├── contexts/             # auth-context.tsx (AuthProvider + useAuth hook)
├── hooks/                # Custom hooks (use-custom-hackathon-page.ts)
├── lib/                  # api.ts (fetch wrapper), utils.ts (cn helper)
└── __tests__/            # Vitest + @testing-library/react + jsdom
```

## PAGES

| Page | Route | Access | Notes |
|------|-------|--------|-------|
| home.tsx | `/` | Public | Hero, bento grid, gallery (lazy) |
| login.tsx | `/login` | Public | OAuth buttons |
| register.tsx | `/register` | Public | Registration flow |
| auth-callback.tsx | `/auth/callback` | Public | OAuth redirect handler |
| about.tsx | `/about` | Public | — |
| browse-hackathons.tsx | `/hackathons` | Public | Hackathon listing (lazy) |
| dashboard.tsx | `/dashboard` | Auth | Tabs, filtering (lazy) |
| hackathon-detail.tsx | `/hackathons/:slug` | Auth | Hackathon info (lazy) |
| team-management.tsx | `/hackathons/:slug/teams` | Auth | Team view |
| participant-dashboard.tsx | `/hackathons/:slug/participant` | Auth | Dashboard widgets (lazy) |
| leaderboard.tsx | `/hackathons/:slug/leaderboard` | Auth | Rankings |
| profile.tsx | `/profile` | Auth | User profile (lazy) |
| accept-invite.tsx | `/invite/:token` | Auth | Invite acceptance |
| not-found.tsx | `*` | Public | 404 fallback |

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add page | `src/pages/` | Add route in `App.tsx`, use `lazy()` for large pages |
| Add shadcn component | `src/components/ui/` | Follow existing shadcn/ui pattern |
| Change layout/nav | `src/components/dashboard-layout.tsx` | Shared layout wrapper |
| Auth guard | `src/components/protected-route.tsx` | Role-based access |
| API calls | `src/lib/api.ts` | `apiRequest<T>(endpoint, options)` — cookies + 401 redirect |
| Auth state | `src/contexts/auth-context.tsx` | `useAuth()` → `{ user, isAuthenticated, isLoading, logout }` |
| Styling/theme | `src/index.css` | Tailwind v4 CSS vars, accent `#CCFF00` |
| Class merging | `src/lib/utils.ts` | `cn()` via clsx + tailwind-merge |

## CONVENTIONS

- **Routing**: `App.tsx` owns all routes. 6 pages lazy-loaded via `React.lazy()` with `<LazyWrapper>` Suspense boundary
- **Path aliases**: `@/` → `src/` (tsconfig + vite)
- **API client**: All API calls through `apiRequest()` — handles cookies, 401 → redirect `/login`
- **React Query**: `staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`
- **Auth flow**: OAuth buttons → `${VITE_API_ORIGIN}/auth/google|github` → API handles redirect + sets HttpOnly cookie
- **Components**: shadcn/ui for primitives. Layouts in `components/`. Pages in `pages/`
- **Toast**: `sonner` (Toaster in main.tsx). Use `toast()` from sonner
- **Icons**: Lucide React
- **Animations**: Framer Motion for page transitions
- **Styling**: Tailwind v4 utility-first. Dark theme primary. Accent `#CCFF00`

## DEV PROXY

Vite proxies `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`. No CORS needed in dev.

Production: `VITE_API_ORIGIN=https://api.devsage.org` (in `.env.production`).

## ANTI-PATTERNS

- Putting secrets in web env — only `VITE_*` vars allowed (client-visible)
- Direct `fetch('/...')` without `apiRequest()` — loses cookie handling + 401 redirect
- Adding routes anywhere other than `App.tsx`
- Putting organizer/management features here — those belong in `apps/platform`

## TESTING

```bash
pnpm --filter @devsage/web test
```

jsdom environment, `@testing-library/react`, globals enabled. Tests in `src/__tests__/`.
