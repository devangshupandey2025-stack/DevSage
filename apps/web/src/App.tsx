import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardLayout } from '@/components/dashboard-layout';
import { LoginPage } from '@/pages/login';
import { AuthCallbackPage } from '@/pages/auth-callback';
import { DashboardPage } from '@/pages/dashboard';
import { OrganiserDashboardPage } from '@/pages/organiser-dashboard';
import { HackathonDetailPage } from '@/pages/hackathon-detail';
import { TeamManagementPage } from '@/pages/team-management';
import { NotFoundPage } from '@/pages/not-found';
import { LandingPage } from '@/pages/landing';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/hackathons/:id" element={<HackathonDetailPage />} />
          <Route path="/hackathons/:id/teams" element={<TeamManagementPage />} />
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
