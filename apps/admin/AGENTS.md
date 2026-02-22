# apps/admin — Platform Admin Panel

Vite + React 18 + React Router v7 + Tailwind CSS v4 + shadcn/ui. Platform-wide admin features (managing admins, workspaces, invites). Deployed at `shikdd.devsage.org`.

## STRUCTURE

```
src/
├── main.tsx              # Bootstrap: AuthProvider + Toaster (no QueryClient)
├── App.tsx               # Routes: 1 public + 6 protected
├── pages/
│   ├── admin-dashboard.tsx   # Platform overview
│   ├── invites.tsx           # Manage platform invites
│   ├── admins.tsx            # Manage platform admins
│   ├── workspaces.tsx        # List all workspaces
│   ├── workspace-detail.tsx  # Individual workspace view
│   ├── profile.tsx           # Admin profile
│   └── login.tsx             # OAuth login
├── components/
│   ├── protected-route.tsx   # Auth guard (redirects to /login)
│   ├── dashboard-layout.tsx  # Sticky navbar + profile dropdown + Outlet
│   └── ui/                   # shadcn/ui primitives (8 components)
├── contexts/             # auth-context.tsx (AuthProvider + useAuth)
├── lib/                  # api.ts (apiRequest wrapper), utils.ts (cn helper)
└── vite.config.ts        # Port 5175, @/ alias, proxy to :8787
```

## ROUTING

Public: `/login`

Protected (ProtectedRoute → DashboardLayout):
- `/` — AdminDashboardPage
- `/invites` — InvitesPage
- `/admins` — AdminsPage
- `/workspaces` — WorkspacesPage
- `/workspaces/:id` — WorkspaceDetailPage
- `/profile` — ProfilePage

Fallback: `*` → Navigate to `/`

## CONVENTIONS

- **No React Query**: Simpler data fetching needs — direct `apiRequest()` + `useState`
- **Auth**: Same pattern as other apps — `apiRequest()` + `useAuth()` hook
- **Styling**: Same Tailwind v4 + dark theme as other apps
- **Path alias**: `@/` → `src/`

## ANTI-PATTERNS

- Putting hackathon management features here — those belong in `apps/platform`
- This app is for platform-wide admin only (managing admins, workspaces, invites)

## SKILLS

Load these skills from `.agents/skills/` **before starting work** in this package. Each skill contains domain-specific rules and patterns that override general knowledge.

### Skill Routing

| Task | Skills to Load |
|------|---------------|
| Building UI with shadcn/ui components | `shadcn`, `tailwind-v4-shadcn` |
| Styling with Tailwind CSS v4 | `tailwind-v4-shadcn` |
| Dark mode / theming / CSS variables | `tailwind-v4-shadcn`, `shadcn` |
| Writing Zod schemas for API responses | `zod` |
| TypeScript type issues | `typescript-expert`, `typescript-advanced-types` |

### Subagent Strategy for Admin Tasks

Use subagents when a task involves multiple independent workstreams:

| Task | Subagent Decomposition |
|------|----------------------|
| **New admin page** | 1. Page component (`shadcn`, `tailwind-v4-shadcn`) → 2. Wire API calls (`zod`, `typescript-expert`) |
| **New admin page + API endpoint** | 1. API admin route in `apps/api` (`hono-api-scaffolder`, `api-design`) + 2. Admin page (`shadcn`, `tailwind-v4-shadcn`) in parallel |
| **Platform admin feature** | 1. API `requirePlatformAdmin` middleware route (`hono-cloudflare`, `workers-best-practices`) → 2. Admin UI (`shadcn`, `tailwind-v4-shadcn`) |
