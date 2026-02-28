# Frontend Overview

Current state of all apps and shared packages.

## Apps at a Glance

| App | Domain | Port | Purpose | Auth | Backend | Status |
|-----|--------|------|---------|------|---------|--------|
| `web` | devsage.org | 5173 | Marketing site | No | No | Exists (9 pages) |
| `app` | app.devsage.org | 5178 | Participant portal | Yes | Yes | **NEW — not built yet** |
| `platform` | platform.devsage.org | 5174 | Organizer dashboard | Yes | Yes | Exists (21 pages) |
| `admin` | shikdd.devsage.org | 5175 | Platform admin panel | Yes | Yes | Exists (11 pages) |
| `judge` | judge.devsage.org | 5176 | Judge scoring portal | Yes | Yes | Exists (8 pages) |
| `status` | status.devsage.org | 5179 | Service status page | No | Self-contained | **NEW — not built yet** |

### Key Distinction

- **`web`** = Pure marketing. Static pages. No login, no API calls, no auth. Just content + SEO.
- **`app`** = Where participants actually log in, join hackathons, manage teams, submit code, view results. This is the primary participant-facing application.
- **`status`** = Self-contained app with its own backend + frontend in one folder. Monitors API, frontend apps, and infrastructure health.

## Shared Tech Stack

All React apps (web, app, platform, admin, judge):
- React 18 + Vite + TypeScript strict
- Tailwind CSS v4 + shadcn/ui (Radix-based)
- Framer Motion (page transitions, stagger animations)
- React Router v7
- lucide-react icons
- sonner (toast notifications)
- Brand: `#CCFF00` (lime green), dark-first theme

Status app has its own stack (see `06-status.md`).

## Shared Package: `@devsage/shared`

26 Zod schema files in `packages/shared/src/schemas/`:
- Response wrappers: `successResponseSchema<T>`, `errorResponseSchema`
- Pagination: offset-based + cursor-based
- Per-entity: hackathon, team, submission, judge, workspace, round, rubric, score, etc.
- Types exported via `z.infer<>` convention
- All re-exported from `src/index.ts` with `.js` extensions

Used by: `app`, `platform`, `admin`, `judge` (NOT `web` — no API calls, NOT `status` — self-contained)

## API Client Pattern

Authenticated apps (`app`, `platform`, `admin`, `judge`) share:

```typescript
// lib/api.ts
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (res.status === 401) {
    await refreshToken();
    // Retry original request
  }

  const data = await res.json();
  if (!data.ok) throw new ApiError(res.status, data.error.message);
  return data.data;
}
```

**Data fetching by app**:
- `app` (new): React Query v5 (recommended — match platform/judge)
- `platform` + `judge`: React Query v5 with `lib/queries.ts`
- `admin`: Direct `apiRequest()` + `useState/useEffect`
- `web`: No API calls at all
- `status`: Own backend fetches health data

## Auth Pattern (app, platform, admin, judge)

```
AuthProvider (context)
├── On mount: GET /auth/me
├── On 401: POST /auth/refresh → retry
├── Exposes: useAuth()
│   ├── user: { id, email, name, image }
│   ├── isAuthenticated: boolean
│   ├── isPlatformAdmin: boolean
│   ├── isOrganizer: boolean
│   ├── hackathonRoles: Record<slug, role[]>
│   ├── workspaceRoles: Record<id, role>
│   ├── refreshToken(): Promise<void>
│   └── logout(): Promise<void>
└── ProtectedRoute guard component
```

**`web`**: No AuthProvider (static marketing site).
**`status`**: No AuthProvider (public status page).

## Component Architecture (authenticated apps)

```
src/
├── components/
│   ├── ui/          — shadcn primitives (button, card, dialog, input, etc.)
│   ├── common/      — reusable (PageHeader, MetricCard, StatusBadge, EmptyState)
│   └── layout/      — AppLayout, Sidebar, TopBar
├── contexts/
│   └── auth-context.tsx
├── lib/
│   ├── api.ts       — fetch wrapper
│   ├── queries.ts   — React Query factories
│   └── utils.ts     — cn(), formatDate(), etc.
└── pages/           — route components
```

## What's Working Well

- Consistent dark-first theme across all apps
- Cookie-based auth with automatic 401 refresh
- Collapsible sidebar layout (240px → 72px)
- Skeleton loading states
- Framer Motion page transitions
- Role-based route protection

## What's Missing (cross-app)

1. **Participant portal (`app`) doesn't exist yet** — participants have no frontend
2. **Status page (`status`) doesn't exist yet** — no service health visibility
3. **Zero frontend tests** — Vitest configured, testing-library installed, but no test files
4. **No shared component library** — each app copies shadcn/ui primitives independently
5. **Inconsistent data fetching** — React Query in 2 apps, raw fetch in 1, none in 1
6. **No error boundary on routes** — only web app has ErrorBoundary
7. **Accessibility** — no a11y audit done, keyboard navigation untested
