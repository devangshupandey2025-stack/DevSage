# Web App — `devsage.org`

Public-facing website and participant portal. Package: `@devsage/web`

## Pages

| Route | Page | Description | API Endpoints |
|-------|------|-------------|---------------|
| `/` | Home | Marketing landing page, team section, features | — |
| `/login` | Login | Email/password sign-in | `POST /auth/login` |
| `/register` | Register | Account creation | `POST /auth/register` |
| `/about` | About | Mission, features, CTA | — |
| `/hackathons` | Browse | Public hackathon listing with search | `GET /api/v1/hackathons` |
| `/dashboard` | Dashboard | User's hackathon overview (upcoming/ongoing/past) | `GET /api/v1/hackathons` |
| `/hackathons/:slug` | Detail | Hackathon info, rules, schedule, team creation/joining | `GET /api/v1/hackathons/:slug`, `GET /teams`, `POST /teams`, `POST /teams/join` |
| `/hackathons/:slug/teams` | Team Management | Members, invite code, repo linking, submissions | `GET /teams/:teamId`, `GET /submissions`, `POST /teams/:teamId/repo`, `POST /teams/:teamId/leave` |
| `/hackathons/:slug/participant` | Participant Dashboard | Phase-aware dashboard with checklists | `GET /hackathons/:slug`, `GET /teams`, `GET /submissions`, `GET /rubric`, `GET /leaderboard` |
| `/hackathons/:slug/leaderboard` | Leaderboard | Rankings table with scores | `GET /hackathons/:slug`, `GET /teams`, `GET /submissions` |
| `/profile` | Profile | Account info, session management, delete account | `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:familyId`, `DELETE /auth/sessions`, `POST /auth/delete-account`, `POST /auth/delete-account/confirm` |
| `/invite/:token` | Accept Invite | Team invite acceptance flow | `GET /api/v1/invites/:token`, `POST /api/v1/invites/:token/accept` |

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| `DashboardLayout` | `components/dashboard-layout.tsx` | Navbar with notification bell, profile dropdown, nav links |
| `ProtectedRoute` | `components/protected-route.tsx` | Auth guard redirecting to `/login` |
| `ProfileCard` | `components/ProfileCard.tsx` | 3D tilt card with pointer tracking |
| `TextType` | `components/TextType.tsx` | GSAP typing animation |
| `CustomCursor` | `components/custom-cursor.tsx` | Framer-motion custom cursor |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | Error boundary with fallback |

## Notifications

The dashboard layout includes a notification bell that:
- Fetches unread count from `GET /api/v1/notifications/unread-count`
- Shows dropdown with recent notifications from `GET /api/v1/notifications?limit=10`
- Supports "Mark all read" via `PATCH /api/v1/notifications/read-all`

## Session Management

Profile page (`/profile`) connects to:
- `GET /auth/sessions` — List active token families
- `DELETE /auth/sessions/:familyId` — Revoke individual session
- `DELETE /auth/sessions` — Logout everywhere

## Account Deletion

Two-step flow:
1. `POST /auth/delete-account` — sends confirmation token to email
2. `POST /auth/delete-account/confirm` — executes deletion with token

## Additional Libraries

- **GSAP** — typing animations on home page
- **Framer Motion** — page transitions, hover effects
- **Custom hooks** — `useHackathon`, `useTeams`, `useSubmissions`, `useRubric` in participant dashboard
