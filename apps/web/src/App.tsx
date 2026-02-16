import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { AuthCallbackPage } from '@/pages/auth-callback';
import { AboutPage } from '@/pages/about';
import { TeamManagementPage } from '@/pages/team-management';
import { LeaderboardPage } from '@/pages/leaderboard';
import { NotFoundPage } from '@/pages/not-found';
import { AcceptInvitePage } from '@/pages/accept-invite';

// Lazy-load route pages to reduce initial bundle size (code-splitting)
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const HackathonDetailPage = lazy(() => import('@/pages/hackathon-detail').then(m => ({ default: m.HackathonDetailPage })));
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })));
const ParticipantDashboardPage = lazy(() => import('@/pages/participant-dashboard/ParticipantDashboardPage').then(m => ({ default: m.ParticipantDashboardPage })));
const BrowseHackathonsPage = lazy(() => import('@/pages/browse-hackathons').then(m => ({ default: m.BrowseHackathonsPage })));

const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-50" />}>{children}</Suspense>
);

const router = createBrowserRouter([
  { path: '/', element: <LazyWrapper><HomePage /></LazyWrapper> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/hackathons', element: <LazyWrapper><BrowseHackathonsPage /></LazyWrapper> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/dashboard', element: <LazyWrapper><DashboardPage /></LazyWrapper> },
          { path: '/hackathons/:slug', element: <LazyWrapper><HackathonDetailPage /></LazyWrapper> },
          { path: '/hackathons/:slug/teams', element: <TeamManagementPage /> },
          { path: '/hackathons/:slug/participant', element: <LazyWrapper><ParticipantDashboardPage /></LazyWrapper> },
          { path: '/hackathons/:slug/leaderboard', element: <LeaderboardPage /> },
          { path: '/profile', element: <LazyWrapper><ProfilePage /></LazyWrapper> },
        ],
      },
      { path: '/invite/:token', element: <AcceptInvitePage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
