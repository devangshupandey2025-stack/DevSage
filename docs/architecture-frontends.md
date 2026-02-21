# Architecture — Frontend Apps

**Generated:** 2026-02-18  
**Framework:** React 18.3.1  
**Build:** Vite 6.0.0  
**Styling:** Tailwind CSS v4 + Radix UI + shadcn/ui  
**Deploy:** Cloudflare Workers Static Assets

---

## Three Frontend Apps

| App | Package | URL | Purpose | Pages |
|-----|---------|-----|---------|-------|
| Web | `@devsage/web` | `devsage.org` | Participant-facing | 12 |
| Platform | `@devsage/platform` | `platform.devsage.org` | Organizer/Judge dashboard | 21 |
| Admin | `@devsage/admin` | `shikdd.devsage.org` | Platform administration | 11 |

---

## Shared Architecture Patterns

### Tech Stack (All Apps)
- **React 18** with `react-router-dom` v7
- **Vite 6** with `@vitejs/plugin-react`
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- **UI Primitives:** Radix UI (`@radix-ui/react-dialog`, `dropdown-menu`, `label`, `slot`, `tabs`)
- **Component Styling:** `class-variance-authority` + `clsx` + `tailwind-merge`
- **Icons:** `lucide-react`
- **Animations:** `framer-motion` (all apps), `gsap` (web only)
- **Notifications:** `sonner` toast library
- **Auth:** Custom `AuthContext` with `apiRequest<T>()` fetch wrapper

### Authentication Pattern
Each app has its own `auth-context.tsx` providing:
```typescript
{ user, isAuthenticated, isLoading, logout }
```
- JWT from HttpOnly cookies (no localStorage)
- Auto-refresh on 401: `apiRequest<T>()` intercepts → `/auth/refresh` → retry
- Protected routes via `<ProtectedRoute>` wrapper component

### API Client
```typescript
apiRequest<T>(path, options?) → T
```
- Prefixed with `VITE_API_ORIGIN` (production) or Vite proxy (dev)
- Dev proxy: `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`

---

## Web App (`devsage.org`)

**Role:** Participant-facing website for browsing hackathons, registering, forming teams, and viewing results.

### Pages (12 routes)
| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/` | home.tsx | — | Landing page (GSAP animations) |
| `/login` | login.tsx | — | Login form |
| `/register` | register.tsx | — | Registration form |
| `/dashboard` | dashboard.tsx | ✓ | User dashboard |
| `/profile` | profile.tsx | ✓ | User profile |
| `/hackathons` | browse-hackathons.tsx | — | Browse all hackathons |
| `/hackathons/:slug` | hackathon-detail.tsx | — | Hackathon details |
| `/hackathons/:slug/leaderboard` | leaderboard.tsx | — | Leaderboard |
| `/hackathons/:slug/dashboard` | participant-dashboard/ | ✓ | Team management, submissions |
| `/invites/:type/:token` | accept-invite.tsx | ✓ | Accept team/judge invite |

### State Management
- **React Query** (30s staleTime, 1 retry) — server data
- **AuthContext** — user session state
- **Code splitting:** Lazy-loaded pages with `Suspense`

---

## Platform App (`platform.devsage.org`)

**Role:** Organizer and Judge dashboard for managing hackathons, reviewing submissions, and scoring.

### Pages (21 routes)
| Route | Page | Auth | Role | Description |
|-------|------|------|------|-------------|
| `/login` | login.tsx | — | — | Login |
| `/dashboard` | dashboard.tsx | ✓ | — | Workspace overview |
| `/profile` | profile.tsx | ✓ | — | User profile |
| `/hackathons/:slug` | hackathon-overview.tsx | ✓ | co_organizer | Hackathon dashboard |
| `/hackathons/:slug/manage` | hackathon-manage.tsx | ✓ | co_organizer | Settings/config |
| `/hackathons/:slug/teams` | teams.tsx | ✓ | co_organizer | Team management |
| `/hackathons/:slug/teams/:id` | team-detail.tsx | ✓ | co_organizer | Team details |
| `/hackathons/:slug/submissions` | submissions.tsx | ✓ | co_organizer | Submission review |
| `/hackathons/:slug/judging` | judging.tsx | ✓ | co_organizer | Judge management |
| `/hackathons/:slug/judge-scoring` | judge-scoring.tsx | ✓ | judge | Score submissions |
| `/hackathons/:slug/judge-assignments` | judge-assignments.tsx | ✓ | judge | View assignments |
| `/hackathons/:slug/rounds` | rounds.tsx | ✓ | co_organizer | Round management |
| `/hackathons/:slug/announcements` | announcements.tsx | ✓ | co_organizer | Announcements |
| `/hackathons/:slug/activity` | activity.tsx | ✓ | co_organizer | Audit log |
| `/hackathons/:slug/analytics` | analytics.tsx | ✓ | co_organizer | Analytics |
| `/hackathons/:slug/leaderboard` | leaderboard.tsx | ✓ | — | Leaderboard |
| `/hackathons/:slug/settings` | settings.tsx | ✓ | organizer | Hackathon settings |
| `/judge/invite/:id` | judge-invite-accept.tsx | — | — | Judge invite acceptance |

### State Management
- **React Query** (5min staleTime, 1hr gcTime, 1 retry) — server data
- **Query Factory Pattern:** Centralized `queryOptions` factories in `lib/queries.ts`
  - `hackathonQueries`, `judgeQueries`, `notificationQueries`, `roundQueries`, `organizerQueries`
- **AuthContext** — user session state

### Layout System
- **Advanced layout:** Sidebar + Topbar (`components/layout/`)
- **Common components:** StatusBadge, MetricCard, EmptyState, CountdownTimer, PageHeader

---

## Admin App (`shikdd.devsage.org`)

**Role:** Platform-level administration for managing all users, workspaces, and hackathons across the platform.

### Pages (11 routes)
| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/login` | login.tsx | — | Login |
| `/dashboard` | dashboard.tsx | ✓ | System stats |
| `/users` | users.tsx | ✓ | All users management |
| `/hackathons` | hackathons.tsx | ✓ | All hackathons management |
| `/hackathons/:id` | hackathon-detail.tsx | ✓ | Hackathon admin view |
| `/workspaces` | workspaces.tsx | ✓ | All workspaces |
| `/workspaces/:id` | workspace-detail.tsx | ✓ | Workspace details |
| `/admins` | admins.tsx | ✓ | Platform admin management |
| `/invites` | invites.tsx | ✓ | Invite management |
| `/profile` | profile.tsx | ✓ | Admin profile |

### State Management
- **Context API only** — No React Query (simpler admin panel)
- **AuthContext** — user session state
- Direct `apiRequest<T>()` calls in page components

---

## Testing Strategy

| App | Framework | Environment | Pattern |
|-----|-----------|------------|---------|
| Web | Vitest + @testing-library/react | jsdom | Component + integration tests |
| Platform | Vitest + @testing-library/react | jsdom | Component + integration tests |
| Admin | Vitest + @testing-library/react | jsdom | Component + integration tests |

---

## Cross-App Comparison

| Feature | Web | Platform | Admin |
|---------|-----|----------|-------|
| React Query | ✓ (30s stale) | ✓ (5min stale, factory) | ✗ |
| Layout | Simple dashboard | Sidebar + Topbar | Simple dashboard |
| Pages | 12 | 21 | 11 |
| UI Components | Basic shadcn | Extended + common | Basic shadcn |
| Animation | GSAP + Framer | Framer | Framer |
| Target Users | Participants | Organizers, Judges | Platform admins |
