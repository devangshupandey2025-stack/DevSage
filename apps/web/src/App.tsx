import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoginPage } from '@/pages/login';
import { AuthCallbackPage } from '@/pages/auth-callback';
import { LinkRequiredPage } from '@/pages/link-required';
import { TeamManagementPage } from '@/pages/team-management';
import { LeaderboardPage } from '@/pages/leaderboard';
import { NotFoundPage } from '@/pages/not-found';

// Lazy-load route pages to reduce initial bundle size (code-splitting)
// Pages export named functions (e.g. `export function HomePage`) so map to `default` here.
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })));
const OrganiserDashboardPage = lazy(() => import('@/pages/organiser-dashboard').then(m => ({ default: m.OrganiserDashboardPage })));
const HackathonDetailPage = lazy(() => import('@/pages/hackathon-detail').then(m => ({ default: m.HackathonDetailPage })));
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })));


export default function App() {
  return (
    <Suspense fallback={<div className="min-h-50" />}> 
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/link-required" element={<LinkRequiredPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/hackathons/:id" element={<HackathonDetailPage />} />
            <Route path="/hackathons/:id/teams" element={<TeamManagementPage />} />
            <Route path="/hackathons/:id/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        
        <Route element={<ProtectedRoute allowedRoles={['organiser']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/organiser" element={<OrganiserDashboardPage />} />
          </Route>
        </Route>
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
