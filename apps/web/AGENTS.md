# apps/web — React SPA

Vite + React 18 + React Router v7 + Tailwind CSS v4 + shadcn/ui. Participant and organizer dashboards. Deployed as Cloudflare Workers Static Assets.

## STRUCTURE

```
src/
├── main.tsx              # Bootstrap: BrowserRouter + AuthProvider + Toaster
├── App.tsx               # All routes defined here (single file)
├── index.css             # Tailwind v4 directives + theme (CSS vars, custom scrollbar)
├── pages/                # Page components (11 pages)
├── components/           # Layout + shared components
│   ├── protected-route.tsx   # Auth guard with `allowedRoles` prop
│   ├── dashboard-layout.tsx  # Sticky navbar + profile dropdown + Outlet
│   ├── custom-cursor.tsx     # Animated cursor (Framer Motion)
│   └── ui/               # shadcn/ui primitives (button, card, dialog, dropdown-menu, badge, input, skeleton, tabs)
├── contexts/             # auth-context.tsx (AuthProvider + useAuth hook)
├── lib/                  # api.ts (fetch wrapper), utils.ts (cn helper)
└── __tests__/            # Vitest + @testing-library/react + jsdom
```

## PAGES

| Page | Route | Access | Status |
|------|-------|--------|--------|
| home.tsx | `/` | Public | Complete (1054 LOC — hero, bento grid, gallery) |
| login.tsx | `/login` | Public | Complete |
| auth-callback.tsx | `/auth/callback` | Public | Complete |
| dashboard.tsx | `/dashboard` | Auth | Complete (tabs, filtering) |
| profile.tsx | `/profile` | Auth | Complete |
| not-found.tsx | `*` | Public | Complete |
| hackathon-detail.tsx | `/hackathons/:id` | Auth | Implemented |
| team-management.tsx | `/hackathons/:id/teams` | Auth | Implemented |
| leaderboard.tsx | `/hackathons/:id/leaderboard` | Auth | Implemented |
| organiser-dashboard.tsx | `/organiser` | Organiser | Implemented |
| about.tsx | — | — | File exists but NO route in App.tsx |

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add page | `src/pages/` | Add route in `App.tsx` |
| Add shadcn component | `src/components/ui/` | Follow existing shadcn/ui pattern |
| Change layout/nav | `src/components/dashboard-layout.tsx` | Shared layout wrapper |
| Auth guard | `src/components/protected-route.tsx` | `allowedRoles` prop for role gates |
| API calls | `src/lib/api.ts` | `apiRequest<T>(endpoint, options)` — uses `VITE_API_ORIGIN` in prod |
| Auth state | `src/contexts/auth-context.tsx` | `useAuth()` → `{ user, isAuthenticated, isLoading, logout }` |
| Styling/theme | `src/index.css` | Tailwind v4 CSS vars, accent color `#CCFF00` |
| Class merging | `src/lib/utils.ts` | `cn()` via clsx + tailwind-merge |

## CONVENTIONS

- **Routing**: `App.tsx` owns all routes. Protected routes wrapped with `<ProtectedRoute>` inside `<DashboardLayout>`
- **Path aliases**: `@/` → `src/` (configured in tsconfig + vite)
- **API client**: All API calls through `apiRequest()` — handles cookies (`credentials: 'include'`), 401→redirect to `/login`
- **Auth flow**: OAuth buttons link to `${VITE_API_ORIGIN}/auth/google` or `/auth/github`. API handles redirect + sets HttpOnly cookie
- **Home page**: `/` is a public landing page (no redirect). Authenticated users go to `/dashboard` via login flow
- **Components**: shadcn/ui for primitives (Radix + CVA variants). Layouts in `components/`. Pages in `pages/`
- **Toast**: `sonner` (Toaster in main.tsx). Use `toast()` from sonner
- **Icons**: Lucide React
- **Animations**: Framer Motion for page transitions and interactive effects
- **Styling**: Tailwind v4 utility-first. Dark theme primary. Accent `#CCFF00`. No Prettier — ESLint only

## DEV PROXY

Vite proxies `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787` (wrangler dev, prefix matching). No CORS needed in dev.

Production: `VITE_API_ORIGIN=https://api.devsage.org` (in `apps/web/.env.production`).

## ANTI-PATTERNS

- Putting secrets in web env — only `VITE_*` vars allowed (client-visible)
- Direct `fetch('/...')` without `apiRequest()` — loses cookie handling + 401 redirect
- Adding routes anywhere other than `App.tsx`

## TESTING

```bash
pnpm --filter @devsage/web test        # Run web tests
```

jsdom environment, `@testing-library/react`. Tests in `src/__tests__/`.
