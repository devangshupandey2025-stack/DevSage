import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoginPage } from '@/pages/login';
import { AuthCallbackPage } from '@/pages/auth-callback';
import { DashboardPage } from '@/pages/dashboard';
import { OrganiserDashboardPage } from '@/pages/organiser-dashboard';
import { HackathonDetailPage } from '@/pages/hackathon-detail';
import { TeamManagementPage } from '@/pages/team-management';
import { LeaderboardPage } from '@/pages/leaderboard';
import { ProfilePage } from '@/pages/profile';
import { AboutPage } from '@/pages/about';
import { NotFoundPage } from '@/pages/not-found';
import { HomePage } from '@/pages/home';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/hackathons/:id" element={<HackathonDetailPage />} />
          <Route path="/hackathons/:id/teams" element={<TeamManagementPage />} />
          <Route path="/hackathons/:id/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['organiser']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/organiser" element={<OrganiserDashboardPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
