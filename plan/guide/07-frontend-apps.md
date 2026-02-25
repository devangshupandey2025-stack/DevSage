# 07 — Frontend Apps

Four React SPAs. Same tech stack, different audiences.

---

## Shared Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Build | Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Routing | React Router v6 |
| Data Fetching | TanStack Query (React Query) |
| Forms | React Hook Form + Zod validation |
| Animations | Framer Motion |
| Icons | Lucide React |
| Toasts | Sonner |
| Shared Types | `@devsage/shared` (Zod schemas + inferred types) |

## Auth Pattern (all apps)

### Provider
```tsx
// src/contexts/auth-context.tsx
<AuthProvider>
  {/* Provides: user, isAuthenticated, isLoading, logout */}
</AuthProvider>
```

### Bootstrap Flow
1. App mounts → calls `GET /auth/me`
2. If 200 → user authenticated, store user data
3. If 401 → call `POST /auth/refresh`
4. If refresh succeeds → retry `/auth/me`
5. If refresh fails → redirect to login

### API Wrapper
```typescript
// src/lib/api.ts
apiRequest<T>(url, options?)
```
- Automatically includes `credentials: 'include'` (sends cookies)
- On 401 → auto-refresh → retry original request
- Uses `VITE_API_ORIGIN` for production base URL
- Vite dev proxy: `/api/v1`, `/auth` → `http://localhost:8787`

---

## App 1: Web (`devsage.org`, port 5173)

Public-facing website. Anyone can access.

### Pages
| Path | Page | Description |
|------|------|-------------|
| `/` | Home | Landing page (parallax, marquee, bento grid, lime accent) |
| `/hackathons` | Browse Hackathons | Public hackathon listing with filters |
| `/hackathons/:slug` | Hackathon Detail | Single hackathon info, registration link |
| `/about` | About | Company info |
| `/about-us` | About Us | Team page |
| `/faq` | FAQ | Common questions |
| `/privacy` | Privacy Policy | Legal |
| `/terms` | Terms of Service | Legal |
| `*` | 404 | Not found |

### Key Features
- No auth required for any page
- Hackathon listing links to branded participant sites
- Lazy-loaded routes for performance

---

## App 2: Platform (`platform.devsage.org`, port 5174)

Organizer dashboard. For workspace owners, managers, and event leads.

### Pages
| Path | Page | Role | Description |
|------|------|------|-------------|
| `/login` | Login | Public | Email/password + OAuth |
| `/` | Dashboard | Auth | Workspace overview |
| `/profile` | Profile | Auth | User settings |
| `/settings` | Settings | Auth | App settings |
| `/invite` | Invite Accept | Auth | Generic invite handler |
| `/workspace-invite` | Workspace Invite | Auth | Workspace invite accept |
| `/judge-invite` | Judge Invite | Auth | Judge invite accept |
| `/workspaces` | Workspaces | Auth | List user's workspaces |
| `/workspaces/:id` | Workspace Detail | Auth | Workspace members, hackathons |
| `/hackathons/:slug` | Hackathon Overview | Organizer | Hackathon dashboard |
| `/hackathons/:slug/teams` | Teams | Organizer | Team management |
| `/hackathons/:slug/teams/:id` | Team Detail | Organizer | Single team view |
| `/hackathons/:slug/submissions` | Submissions | Organizer | Submission review |
| `/hackathons/:slug/judging` | Judging | Organizer | Judge management, scoring |
| `/hackathons/:slug/leaderboard` | Leaderboard | Organizer | Rankings |
| `/hackathons/:slug/rounds` | Rounds | Organizer | Round config, advancement |
| `/hackathons/:slug/announcements` | Announcements | Organizer | Broadcast to participants |
| `/hackathons/:slug/activity` | Activity | Organizer | Audit log |
| `/hackathons/:slug/analytics` | Analytics | Organizer | Charts and metrics |
| `/privacy` | Privacy Policy | Public | Legal |
| `/terms` | Terms | Public | Legal |

### Layout
- Sidebar navigation (collapsible)
- Topbar with user menu
- Hackathon sub-nav when viewing a hackathon

---

## App 3: Admin (`shikdd.devsage.org`, port 5175)

Platform admin panel. For DevSage team only.

### Pages
| Path | Page | Description |
|------|------|-------------|
| `/login` | Login | Admin login |
| `/` | Dashboard | System stats (users, hackathons, teams, submissions) |
| `/users` | Users | Manage all platform users |
| `/workspaces` | Workspaces | All workspaces + member counts |
| `/workspaces/:id` | Workspace Detail | Workspace drill-down |
| `/hackathons` | Hackathons | All hackathons + status |
| `/hackathons/:id` | Hackathon Detail | Admin hackathon view |
| `/hackathon-requests` | Requests | Review/approve/reject requests |
| `/admins` | Admins | Add/remove platform admins |
| `/invites` | Invites | Manage platform invites |
| `/profile` | Profile | Admin profile |

### Layout
- Dashboard layout with sidebar navigation
- Protected routes (redirect to login if not admin)

---

## App 4: Judge (`judge.devsage.org`, port 5176)

Judge scoring portal. For invited judges only.

### Pages
| Path | Page | Description |
|------|------|-------------|
| `/login` | Login | Email/password only (no OAuth) |
| `/change-password` | Change Password | Forced for temp credential judges |
| `/invite/judge/:token` | Judge Invite | Accept/decline invite |
| `/dashboard` | Dashboard | List assigned hackathons |
| `/profile` | Profile | Judge profile |
| `/hackathons/:slug/assignments` | Assignments | View assigned submissions |
| `/hackathons/:slug/score` | Scoring | Score against rubric criteria |
| `/hackathons/:slug/leaderboard` | Leaderboard | Published results |

### Special Behaviors
- **No OAuth** — email/password only
- **Forced password change** — if `password_must_change = true` (temp credentials)
- **Blind judging** — judges cannot see other judges' scores
- **Read-only repo access** — via DevSage GitHub App, not direct collaborator access

---

## Brand & Styling

| Token | Value | Usage |
|-------|-------|-------|
| `--lime` | `#CCFF00` | Primary accent, CTAs, glow effects |
| Background | Dark (near-black) | All apps use dark theme |
| Typography | System fonts | No custom font loading |
| Animations | Framer Motion | Page transitions, hover effects, loading states |
| Component Library | shadcn/ui | Badge, Button, Card, Dialog, Dropdown, Input, Skeleton, Tabs |

---

## Common Components (per app)

| Component | Description |
|-----------|-------------|
| `PageHeader` | Title + description + optional action button |
| `EmptyState` | Icon + message + CTA for empty lists |
| `StatusBadge` | Color-coded status indicators |
| `MetricCard` | Stat card with label + value |
| `CountdownTimer` | Deadline countdown display |
| `AppLayout` | Sidebar + topbar wrapper |
| `ProtectedRoute` | Auth check wrapper |

---

## Dev Proxy Configuration (all apps)

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api/v1': 'http://localhost:8787',
    '/auth': 'http://localhost:8787',
    '/hackathons': 'http://localhost:8787',
    '/webhooks': 'http://localhost:8787',
  }
}
```

Production: `VITE_API_ORIGIN=https://api.devsage.org`
