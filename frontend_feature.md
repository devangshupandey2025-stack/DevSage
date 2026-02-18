# Frontend Feature Inventory

This document lists implemented frontend features across the three apps in the monorepo: `apps/admin`, `apps/platform`, and `apps/web`. It highlights where to find pages, key components, libraries used, and suggested next steps.

## Summary
- Stack: React 18, TypeScript, Vite, Tailwind CSS (v4), Framer Motion, Lucide icons, Radix/shadcn UI primitives.
- Auth pattern: `AuthProvider` / `useAuth` + `apiRequest` wrapper with silent refresh and cookie credentials.

---

## Admin (apps/admin)
- Purpose: Platform administration (users, workspaces, invites, platform admins).
- Pages: dashboard, invites, hackathons, admins, users, workspaces, profile, login.
  - See: [apps/admin/src/pages](apps/admin/src/pages)
- Key features:
  - Platform metrics dashboard (API-backed stat cards and quick actions) — [apps/admin/src/pages/dashboard.tsx](apps/admin/src/pages/dashboard.tsx)
  - Admin user management (add/remove admins, list) — [apps/admin/src/pages/admins.tsx](apps/admin/src/pages/admins.tsx)
  - Invite & workspace management UIs — [apps/admin/src/pages/invites.tsx](apps/admin/src/pages/invites.tsx), [apps/admin/src/pages/workspaces.tsx](apps/admin/src/pages/workspaces.tsx)
- Utilities: `apiRequest` in [apps/admin/src/lib/api.ts](apps/admin/src/lib/api.ts); toasts via `sonner`.

---

## Platform (apps/platform)
- Purpose: Organizer and judge dashboard (hackathon management, judging, analytics).
- Pages: hackathon manage/overview, dashboard, teams, submissions, judging flows, analytics, leaderboard, judge invite/assignments.
  - See: [apps/platform/src/pages](apps/platform/src/pages)
- Key features:
  - Analytics dashboard with animated stat cards and charts (custom `BarChartSimple`, `StatCard`) — [apps/platform/src/pages/analytics.tsx](apps/platform/src/pages/analytics.tsx)
  - Hackathon lifecycle management, phase advancement, countdown timers — [apps/platform/src/pages/hackathon-overview.tsx](apps/platform/src/pages/hackathon-overview.tsx)
  - Judging workflow pages (invite, assign, scoring) — [apps/platform/src/pages/judging.tsx](apps/platform/src/pages/judging.tsx), [apps/platform/src/pages/judge-scoring.tsx](apps/platform/src/pages/judge-scoring.tsx)
  - Team & submissions management — [apps/platform/src/pages/teams.tsx](apps/platform/src/pages/teams.tsx), [apps/platform/src/pages/submissions.tsx](apps/platform/src/pages/submissions.tsx)
- Auth: `AuthProvider` / `useAuth` used to gate organizer/judge features — [apps/platform/src/contexts/auth-context.tsx](apps/platform/src/contexts/auth-context.tsx)

---

## Web (apps/web)
- Purpose: Public site and participant flows (home/marketing, register, team management, hackathon directory).
- Pages: home (rich hero + animations), register, login, hackathon detail, team management, leaderboard.
  - See: [apps/web/src/pages](apps/web/src/pages)
- Key features:
  - Marketing home with parallax, marquee, bento grid, custom cursor, typing effect — [apps/web/src/pages/home.tsx](apps/web/src/pages/home.tsx)
  - Registration and team flows (create/join/accept invites) — [apps/web/src/pages/register.tsx](apps/web/src/pages/register.tsx)
  - Participant-facing leaderboard and hackathon detail — [apps/web/src/pages/leaderboard.tsx](apps/web/src/pages/leaderboard.tsx), [apps/web/src/pages/hackathon-detail.tsx](apps/web/src/pages/hackathon-detail.tsx)
- Utilities: `apiRequest` wrapper with silent refresh — [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts)

---

## Shared packages & conventions
- `@devsage/shared`: Zod schemas, types, constants used by frontends.
- `packages/config`: tsconfig and ESLint shared configs.
- Styling: Tailwind + project theme variables (see `apps/*/src/index.css`).
- Testing: Vitest (frontend: jsdom + testing-library).

---

## Notable UX / Visual features
- Brand accent: `--lime: #CCFF00` used across the apps for glow/CTA.
- Framer Motion-based transitions everywhere (cards, popups, page entrances).
- Specialized UI: analytics glitter border, SVG/map popups, animated charts, custom cursor.

---

## Where to look (quick pointers)
- Admin pages: [apps/admin/src/pages](apps/admin/src/pages)
- Platform pages: [apps/platform/src/pages](apps/platform/src/pages)
- Web pages: [apps/web/src/pages](apps/web/src/pages)
- Auth context: [apps/platform/src/contexts/auth-context.tsx](apps/platform/src/contexts/auth-context.tsx)
- API wrapper: [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) and [apps/admin/src/lib/api.ts](apps/admin/src/lib/api.ts)

---

## Next steps (suggested)
1. Commit this file to the repo.
2. Optionally generate a per-page CSV/JSON inventory for automated audits.
3. Expand each feature line into detailed README sections per app (tasks, owners, tests).

If you want I can commit this file and open a PR — tell me and I will create the commit.
