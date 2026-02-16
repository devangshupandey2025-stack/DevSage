# Platform App

> `apps/platform/` — `platform.devsage.org` — Organizer and judge dashboard.

## Purpose

The primary management interface for hackathon organizers and judges. This is the most complex frontend app with the most pages and features.

## Key Pages

### Organizer Pages
| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | My hackathons overview |
| `/hackathons/new` | Create | New hackathon form |
| `/hackathons/:slug` | Overview | Hackathon dashboard |
| `/hackathons/:slug/settings` | Settings | Config, tracks, prizes |
| `/hackathons/:slug/teams` | Teams | Team list, create, invite |
| `/hackathons/:slug/teams/:id` | Team Detail | Members, repo, submissions |
| `/hackathons/:slug/submissions` | Submissions | All submissions, status |
| `/hackathons/:slug/judging` | Judging Setup | Rubric, judge management |
| `/hackathons/:slug/leaderboard` | Leaderboard | Scores, rankings |
| `/hackathons/:slug/audit` | Audit Log | Activity timeline |

### Judge Pages
| Route | Page | Description |
|-------|------|-------------|
| `/judge/assignments` | My Assignments | Teams to review |
| `/judge/score/:teamId` | Score | Rubric scoring form |
| `/invite/judge/:token` | Accept Invite | Judge invite acceptance |

## State Management

- **Auth**: `useAuth()` context (global)
- **Server state**: TanStack Query for API data
- **Local state**: React `useState` / `useReducer` for forms
- **URL state**: React Router params and search params

## Routing

Uses React Router's data mode (`createBrowserRouter`) for loaders, actions, pending UI, and optimistic updates. Do NOT use the legacy `<BrowserRouter>` + `<Routes>` JSX pattern.

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'hackathons/:slug',
        element: <HackathonLayout />,
        loader: hackathonLoader, // data loading at route level
        children: [
          { index: true, element: <HackathonOverview /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'teams/:id', element: <TeamDetailPage /> },
          { path: 'submissions', element: <SubmissionsPage /> },
          { path: 'judging', element: <JudgingPage /> },
          { path: 'leaderboard', element: <LeaderboardPage /> },
        ],
      },
      { path: 'judge/assignments', element: <JudgeAssignmentsPage /> },
      { path: 'judge/score/:teamId', element: <ScorePage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

## Layout

```
├── RootLayout
│   ├── Sidebar (navigation, hackathon switcher)
│   ├── Header (user menu, notifications)
│   └── Main content area
```

## Implementation Notes

- Protected routes redirect to `/auth/login` if not authenticated
- Hackathon context is determined by `:slug` URL param
- Role-based UI: menu items and actions shown/hidden based on resolved role
- shadcn/ui provides all interactive components (dialogs, forms, tables, toasts)
- Real-time features (presence, live updates) are Phase 2
