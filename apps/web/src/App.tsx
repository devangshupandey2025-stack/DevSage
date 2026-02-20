import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { AboutPage } from '@/pages/about';
import { TeamManagementPage } from '@/pages/team-management';
import { LeaderboardPage } from '@/pages/leaderboard';
import { NotFoundPage } from '@/pages/not-found';
import { AcceptInvitePage } from '@/pages/accept-invite';
import { Preloader } from '@/components/preloader';

// Lazy-load route pages to reduce initial bundle size (code-splitting)
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const HackathonDetailPage = lazy(() => import('@/pages/hackathon-detail').then(m => ({ default: m.HackathonDetailPage })));
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })));
const ParticipantDashboardPage = lazy(() => import('@/pages/participant-dashboard/ParticipantDashboardPage').then(m => ({ default: m.ParticipantDashboardPage })));
const BrowseHackathonsPage = lazy(() => import('@/pages/browse-hackathons').then(m => ({ default: m.BrowseHackathonsPage })));
const PrivacyPolicyPage = lazy(() => import('@/pages/privacy-policy').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('@/pages/terms-of-service').then(m => ({ default: m.TermsOfServicePage })));
const FAQPage = lazy(() => import('@/pages/faq').then(m => ({ default: m.FAQPage })));
const AboutUsPage = lazy(() => import('@/pages/about-us').then(m => ({ default: m.AboutUsPage })));

const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-50" />}>{children}</Suspense>
);

const router = createBrowserRouter([
  { path: '/', element: <LazyWrapper><HomePage /></LazyWrapper> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/hackathons', element: <LazyWrapper><BrowseHackathonsPage /></LazyWrapper> },
  { path: '/privacy', element: <LazyWrapper><PrivacyPolicyPage /></LazyWrapper> },
  { path: '/terms', element: <LazyWrapper><TermsOfServicePage /></LazyWrapper> },
  { path: '/faq', element: <LazyWrapper><FAQPage /></LazyWrapper> },
  { path: '/about-us', element: <LazyWrapper><AboutUsPage /></LazyWrapper> },

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
  return (
    <>
      <Preloader />
      <RouterProvider router={router} />
    </>
  );
}
