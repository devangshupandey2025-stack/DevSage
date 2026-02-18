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
