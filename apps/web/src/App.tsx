import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AboutPage } from '@/pages/about';
import { NotFoundPage } from '@/pages/not-found';
import { Preloader } from '@/components/preloader';
import { AuthProvider } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';

// Lazy-load route pages to reduce initial bundle size (code-splitting)
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const BrowseHackathonsPage = lazy(() => import('@/pages/browse-hackathons').then(m => ({ default: m.BrowseHackathonsPage })));
const PrivacyPolicyPage = lazy(() => import('@/pages/privacy-policy').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('@/pages/terms-of-service').then(m => ({ default: m.TermsOfServicePage })));
const FAQPage = lazy(() => import('@/pages/faq').then(m => ({ default: m.FAQPage })));
const AboutUsPage = lazy(() => import('@/pages/about-us').then(m => ({ default: m.AboutUsPage })));
const HackathonDetailPage = lazy(() => import('@/pages/hackathon-detail').then(m => ({ default: m.HackathonDetailPage })));
const LoginPage = lazy(() => import('@/pages/login').then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })));
const TeamPage = lazy(() => import('@/pages/team').then(m => ({ default: m.TeamPage })));
const LeaderboardPage = lazy(() => import('@/pages/leaderboard').then(m => ({ default: m.LeaderboardPage })));

const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-50" />}>{children}</Suspense>
);

const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <LazyWrapper><HomePage /></LazyWrapper> },
  { path: '/about', element: <AboutPage /> },
  { path: '/hackathons', element: <LazyWrapper><BrowseHackathonsPage /></LazyWrapper> },
  { path: '/hackathons/:slug', element: <LazyWrapper><HackathonDetailPage /></LazyWrapper> },
  { path: '/hackathons/:slug/leaderboard', element: <LazyWrapper><LeaderboardPage /></LazyWrapper> },
  { path: '/login', element: <LazyWrapper><LoginPage /></LazyWrapper> },
  { path: '/privacy', element: <LazyWrapper><PrivacyPolicyPage /></LazyWrapper> },
  { path: '/terms', element: <LazyWrapper><TermsOfServicePage /></LazyWrapper> },
  { path: '/faq', element: <LazyWrapper><FAQPage /></LazyWrapper> },
  { path: '/about-us', element: <LazyWrapper><AboutUsPage /></LazyWrapper> },

  // Protected routes (require authentication)
  { path: '/dashboard', element: <LazyWrapper><ProtectedRoute><DashboardPage /></ProtectedRoute></LazyWrapper> },
  { path: '/profile', element: <LazyWrapper><ProtectedRoute><ProfilePage /></ProtectedRoute></LazyWrapper> },
  { path: '/hackathons/:slug/team', element: <LazyWrapper><ProtectedRoute><TeamPage /></ProtectedRoute></LazyWrapper> },

  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return (
    <AuthProvider>
      <Preloader />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
