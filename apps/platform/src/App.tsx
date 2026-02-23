import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/components/layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ProfilePage } from '@/pages/profile';
import { InviteAcceptPage } from '@/pages/invite-accept';
import { WorkspaceInviteAcceptPage } from '@/pages/workspace-invite-accept';
import { HackathonOverviewPage } from '@/pages/hackathon-overview';
import { WorkspacesPage } from '@/pages/workspaces';
import { WorkspaceDetailPage } from '@/pages/workspace-detail';
import { TeamsPage } from '@/pages/teams';
import { TeamDetailPage } from '@/pages/team-detail';
import { SubmissionsPage } from '@/pages/submissions';
import { JudgingPage } from '@/pages/judging';
import { LeaderboardPage } from '@/pages/leaderboard';
import { RoundsPage } from '@/pages/rounds';
import { AnnouncementsPage } from '@/pages/announcements';
import { ActivityPage } from '@/pages/activity';
import { AnalyticsPage } from '@/pages/analytics';
import { SettingsPage } from '@/pages/settings';

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
{ path: '/invite/:code', element: <InviteAcceptPage /> },
{ path: '/invite/workspace/:token', element: <WorkspaceInviteAcceptPage /> },

  // Protected routes with app shell
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/workspaces', element: <WorkspacesPage /> },
          { path: '/workspaces/:slug', element: <WorkspaceDetailPage /> },

          // Hackathon management
          { path: '/hackathons/:slug', element: <HackathonOverviewPage /> },
          { path: '/hackathons/:slug/teams', element: <TeamsPage /> },
          { path: '/hackathons/:slug/teams/:id', element: <TeamDetailPage /> },
          { path: '/hackathons/:slug/submissions', element: <SubmissionsPage /> },
          { path: '/hackathons/:slug/judging', element: <JudgingPage /> },
          { path: '/hackathons/:slug/leaderboard', element: <LeaderboardPage /> },
          { path: '/hackathons/:slug/rounds', element: <RoundsPage /> },
          { path: '/hackathons/:slug/announcements', element: <AnnouncementsPage /> },
          { path: '/hackathons/:slug/activity', element: <ActivityPage /> },
          { path: '/hackathons/:slug/audit', element: <ActivityPage /> },
          { path: '/hackathons/:slug/analytics', element: <AnalyticsPage /> },
          { path: '/hackathons/:slug/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },

  // Redirects
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
