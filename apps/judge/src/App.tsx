import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/components/layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ProfilePage } from '@/pages/profile';
import { JudgeScoringPage } from '@/pages/judge-scoring';
import { JudgeAssignmentsPage } from '@/pages/judge-assignments';
import { JudgeInviteAcceptPage } from '@/pages/judge-invite-accept';
import { LeaderboardPage } from '@/pages/leaderboard';
import { ChangePasswordPage } from '@/pages/change-password';

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/judge/:token', element: <JudgeInviteAcceptPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },

  // Protected routes (judge-only) with app shell
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/profile', element: <ProfilePage /> },

          // Hackathon judging routes
          { path: '/hackathons/:slug/score', element: <JudgeScoringPage /> },
          { path: '/hackathons/:slug/assignments', element: <JudgeAssignmentsPage /> },
          { path: '/hackathons/:slug/leaderboard', element: <LeaderboardPage /> },
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
