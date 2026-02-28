# Participant App (app.devsage.org)

**Status: NEW — not built yet.**

Primary participant-facing application. Where users browse hackathons, register, manage teams, submit code, and view results.

## Source Docs
- `role-participant.md` — Full participant journey (discovery → registration → team → build → submit → results)

## Why a Separate App

Previously, participant features were scattered across `web` (hackathon browsing) and `platform` (some team management). The participant portal deserves its own app because:
- Participants have a distinct auth flow (register/login with GitHub, join via invite link)
- The UX is fundamentally different from organizer dashboards — it's task-focused, not admin-focused
- Keeps `web` as a pure static marketing site
- Keeps `platform` focused on organizer workflows

## Pages to Build

### Authentication
| Route | Purpose |
|-------|---------|
| `/login` | Email/password + GitHub/Google OAuth |
| `/register` | Account creation |
| `/invite/team/:token` | Team invite acceptance (creates account if needed) |
| `/forgot-password` | Password reset flow |

### Dashboard
| Route | Purpose |
|-------|---------|
| `/dashboard` | My hackathons, active team, upcoming deadlines |
| `/profile` | Profile settings, linked accounts, 2FA |

### Hackathon Discovery
| Route | Purpose |
|-------|---------|
| `/hackathons` | Browse public hackathons (migrated from `web`) |
| `/hackathons/:slug` | Hackathon detail with dynamic theming (migrated from `web`) |
| `/hackathons/:slug/register` | Registration form (create team or join via code) |

### Team & Participation
| Route | Purpose |
|-------|---------|
| `/hackathons/:slug/team` | My team dashboard (members, invite link, status) |
| `/hackathons/:slug/team/settings` | Team name, track selection |
| `/hackathons/:slug/repo` | Linked repository, commit history, bot status |
| `/hackathons/:slug/submit` | Submission form (title, description, demo URL, video URL) |
| `/hackathons/:slug/submissions` | My submission history per round |

### Results & Info
| Route | Purpose |
|-------|---------|
| `/hackathons/:slug/leaderboard` | Public leaderboard (scores, rankings) |
| `/hackathons/:slug/rounds` | Round schedule, deadlines, current round status |
| `/hackathons/:slug/announcements` | Organizer announcements feed |

**Total: ~17 pages**

## Key Flows

### Flow A — Private Hackathon (Invite-Only)

```
1. Participant receives invite link (email from organizer)
2. → /invite/team/:token
3. Create account or login
4. Auto-joined to team → /hackathons/:slug/team
5. Link repo → /hackathons/:slug/repo
6. Build & submit via git tag or /hackathons/:slug/submit
```

### Flow B — Public Hackathon

```
1. Browse → /hackathons
2. View detail → /hackathons/:slug
3. Register → /hackathons/:slug/register
   - Create new team (become leader) OR
   - Join existing team via invite code
4. → /hackathons/:slug/team
5. Link repo → Build → Submit
```

### Flow C — Multi-Round

```
1. Submit in Round 1
2. View results → /hackathons/:slug/leaderboard
3. If advancing: submit again for Round 2
4. If eliminated: see "Eliminated" status, read-only access
```

## Architecture

```
apps/app/
├── src/
│   ├── components/
│   │   ├── ui/            — shadcn/ui primitives
│   │   ├── common/        — PageHeader, StatusBadge, CountdownTimer, EmptyState
│   │   ├── layout/        — AppLayout, Sidebar, TopBar
│   │   ├── hackathon/     — HackathonCard, HackathonDetail, ThemedContainer
│   │   ├── team/          — TeamDashboard, MemberList, InviteLink
│   │   └── submission/    — SubmissionForm, SubmissionHistory, RepoStatus
│   ├── contexts/
│   │   └── auth-context.tsx
│   ├── lib/
│   │   ├── api.ts         — apiRequest with 401 refresh
│   │   ├── queries.ts     — React Query factories
│   │   └── utils.ts
│   ├── pages/             — Route components (see table above)
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json           — @devsage/app
```

## API Endpoints Used

From the existing API — no new backend routes needed for basic functionality:

| Feature | Endpoints |
|---------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/oauth/*`, `GET /auth/me`, `POST /auth/refresh` |
| Hackathon browse | `GET /api/v1/hackathons` (public listing) |
| Hackathon detail | `GET /api/v1/hackathons/:slug` |
| Registration | `POST /api/v1/hackathons/:slug/register` (**new** — see `backend/08-remaining-gaps.md`) |
| Team | `GET /api/v1/hackathons/:slug/teams/me`, `POST /api/v1/hackathons/:slug/teams`, `PATCH .../teams/:id` |
| Team invites | `POST /api/v1/invites/team/:token` |
| Repo | `POST /api/v1/hackathons/:slug/teams/:id/repo`, `GET .../repos` |
| Submissions | `POST /api/v1/hackathons/:slug/submissions`, `GET .../submissions/:id` |
| Leaderboard | `GET /api/v1/hackathons/:slug/judging/leaderboard` |
| Rounds | `GET /api/v1/hackathons/:slug/rounds` |
| Announcements | `GET /api/v1/hackathons/:slug/announcements` |
| Notifications | `GET /api/v1/notifications`, `PATCH .../read` |
| Profile | `GET /auth/me`, 2FA endpoints |

## Data Fetching

Use React Query v5 (same as platform/judge):

```typescript
// lib/queries.ts
export const participantKeys = {
  hackathons: {
    all: ['hackathons'] as const,
    detail: (slug: string) => ['hackathons', slug] as const,
  },
  team: {
    mine: (slug: string) => ['hackathons', slug, 'teams', 'me'] as const,
  },
  submissions: {
    mine: (slug: string) => ['hackathons', slug, 'submissions', 'mine'] as const,
  },
  leaderboard: (slug: string) => ['hackathons', slug, 'leaderboard'] as const,
  announcements: (slug: string) => ['hackathons', slug, 'announcements'] as const,
  notifications: ['notifications'] as const,
};
```

## Dynamic Theming

Hackathon detail and sub-pages should apply the hackathon's theme colors:

```typescript
function ThemedContainer({ hackathon, children }) {
  const style = {
    '--hackathon-primary': hackathon.settings?.primary_color || '#CCFF00',
    '--hackathon-secondary': hackathon.settings?.secondary_color || '#1a1a1a',
  } as React.CSSProperties;

  return <div style={style}>{children}</div>;
}
```

Use CSS variables in Tailwind: `bg-[var(--hackathon-primary)]`.

## Components to Build

| Component | Purpose |
|-----------|---------|
| `HackathonCard` | Hackathon listing card (status, dates, participant count) |
| `HackathonDetail` | Full hackathon info (tracks, prizes, sponsors, timeline) |
| `RegistrationForm` | Multi-step: account → team choice (create/join) → confirm |
| `TeamDashboard` | Team overview (members, status, invite link) |
| `MemberList` | Team members with roles |
| `InviteLink` | Copy-to-clipboard invite code |
| `RepoStatus` | Linked repo info, bot status, recent commits |
| `SubmissionForm` | Title, description, demo URL, video URL |
| `SubmissionHistory` | Past submissions per round with status |
| `LeaderboardTable` | Rankings with scores |
| `AnnouncementFeed` | Chronological announcement list |
| `RoundTimeline` | Visual round schedule with deadlines |
| `CountdownTimer` | Deadline countdown |
| `NotificationBell` | Header notification icon with unread count |
| `ThemedContainer` | Applies hackathon colors to child pages |

## Scaffolding Steps

1. Create `apps/app/` using Vite React-TS template
2. Add to `pnpm-workspace.yaml` and `turbo.json`
3. Install shared deps: `@devsage/shared`, `@tanstack/react-query`, `react-router-dom`, `framer-motion`, `lucide-react`, `sonner`
4. Copy shadcn/ui primitives from `apps/platform/src/components/ui/`
5. Copy auth context from `apps/platform/src/contexts/auth-context.tsx`
6. Copy API client from `apps/platform/src/lib/api.ts`
7. Add Vite dev proxy config (same as platform)
8. Build pages incrementally: auth → dashboard → hackathon browse → team → submissions
