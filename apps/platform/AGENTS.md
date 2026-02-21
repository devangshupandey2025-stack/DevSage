# apps/platform — Organizer/Judge Dashboard

Vite + React 18 + React Router v7 + React Query v5 + Tailwind CSS v4 + shadcn/ui + Framer Motion. Hackathon management and judging interface. Deployed at `platform.devsage.org`.

## STRUCTURE

```
src/
├── main.tsx              # Bootstrap: QueryClient (5min stale) + AuthProvider + Toaster
├── App.tsx               # All routes (4 public + 18 protected)
├── pages/                # 20 page components
│   ├── dashboard.tsx         # Hackathon list + create + phase advancement
│   ├── hackathon-overview.tsx # Detail + state machine progress + metrics
│   ├── teams.tsx             # Team list with member avatars
│   ├── team-detail.tsx       # Individual team view
│   ├── submissions.tsx       # Submission list (git tag, SHA, status)
│   ├── judging.tsx           # Judge management + leaderboard + rubric
│   ├── judge-scoring.tsx     # Scoring form with rubric criteria
│   ├── judge-assignments.tsx # Judge's assignment queue
│   ├── judge-invite-accept.tsx # Judge invite acceptance
│   ├── leaderboard.tsx       # Final rankings
│   ├── rounds.tsx            # Round management
│   ├── announcements.tsx     # Announcement CRUD
│   ├── activity.tsx          # Audit log / activity feed (reused for /audit route)
│   ├── analytics.tsx         # Hackathon analytics
│   ├── settings.tsx          # Hackathon configuration
│   ├── hackathon-manage.tsx  # Advanced hackathon management
│   ├── invite-accept.tsx     # Team invite acceptance
│   ├── login.tsx             # OAuth login
│   ├── auth-callback.tsx     # OAuth redirect handler
│   └── profile.tsx           # User profile with role badges
├── components/
│   ├── layout/               # AppLayout (sidebar + topbar + animated outlet)
│   │   ├── app-layout.tsx    # Main shell, sidebar collapse state
│   │   ├── sidebar.tsx       # Collapsible nav, hackathon-context-aware
│   │   └── topbar.tsx        # Search, notifications, user menu
│   ├── common/               # Reusable domain components
│   │   ├── page-header.tsx   # Title + description + badge + actions
│   │   ├── status-badge.tsx  # Status indicator with pulse (5 states)
│   │   ├── metric-card.tsx   # KPI card with icon + value + change %
│   │   ├── empty-state.tsx   # Placeholder with icon + CTA
│   │   └── countdown-timer.tsx # Deadline countdown
│   ├── protected-route.tsx   # Auth + organizer role guard
│   ├── ui/                   # shadcn/ui primitives
│   └── dashboard-layout.tsx  # Legacy (unused)
├── contexts/             # auth-context.tsx (user + isOrganizer + isPlatformAdmin)
├── lib/
│   ├── api.ts            # apiRequest() — cookies, 401 → auto-refresh → retry
│   ├── queries.ts        # React Query factory functions for all endpoints
│   └── utils.ts          # cn() helper
└── vite.config.ts        # Port 5174, @/ alias, proxy to :8787
```

## ROUTING

Public: `/login`, `/auth/callback`, `/invite/:code`, `/invite/judge/:token`

Protected (ProtectedRoute → AppLayout):
- `/dashboard` — hackathon list + create
- `/profile` — user profile
- `/hackathons/:slug/*` — all management pages (overview, teams, submissions, judging, leaderboard, rounds, announcements, activity, audit, analytics, settings, judge scoring)
- `/judge/assignments`, `/judge/score/:teamId` — judge-specific routes

Root `/` and `*` redirect to `/dashboard`.

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add page | `src/pages/` | Add route in `App.tsx` |
| Add API query | `src/lib/queries.ts` | React Query factory with `queryOptions()` |
| API calls | `src/lib/api.ts` | `apiRequest<T>()` — auto-refresh on 401 |
| Auth state | `src/contexts/auth-context.tsx` | `useAuth()` → user, isOrganizer, isPlatformAdmin |
| Add layout section | `src/components/layout/` | Sidebar, topbar, app shell |
| Add common component | `src/components/common/` | PageHeader, StatusBadge, MetricCard, EmptyState |
| Add shadcn component | `src/components/ui/` | Follow existing pattern |

## CONVENTIONS

- **React Query**: `staleTime: 5min`, `gcTime: 60min`, `retry: 1`. Query factories in `lib/queries.ts`
- **Page pattern**: `PageHeader` + content. Framer Motion stagger for card lists
- **Auth guard**: Checks `isAuthenticated` (redirect to /login) + `isOrganizer` (access denied UI)
- **Dev mode**: Auth bypassed with mock DEV_USER when `DEV_AUTH_BYPASS` set
- **Styling**: Dark theme, accent `#CCFF00`, `bg-black` with grid overlay
- **State management**: React Query for server state, useState for local, no Redux/Zustand
- **Animations**: Framer Motion stagger, sidebar collapse, page transitions

## ANTI-PATTERNS

- Putting participant-facing features here — those belong in `apps/web`
- Direct `fetch()` instead of `apiRequest()` — loses cookie handling + 401 refresh
- Adding routes outside `App.tsx`
