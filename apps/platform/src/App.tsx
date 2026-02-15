import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/components/layout';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ProfilePage } from '@/pages/profile';
import { InviteAcceptPage } from '@/pages/invite-accept';
import { AuthCallbackPage } from '@/pages/auth-callback';
import { HackathonOverviewPage } from '@/pages/hackathon-overview';
import { TeamsPage } from '@/pages/teams';
import { SubmissionsPage } from '@/pages/submissions';
import { JudgingPage } from '@/pages/judging';
import { RoundsPage } from '@/pages/rounds';
import { AnnouncementsPage } from '@/pages/announcements';
import { ActivityPage } from '@/pages/activity';
import { AnalyticsPage } from '@/pages/analytics';
import { SettingsPage } from '@/pages/settings';
import { JudgeScoringPage } from '@/pages/judge-scoring';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/invite/:code" element={<InviteAcceptPage />} />

      {/* Protected routes with app shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Hackathon management */}
          <Route path="/hackathons/:slug" element={<HackathonOverviewPage />} />
          <Route path="/hackathons/:slug/teams" element={<TeamsPage />} />
          <Route path="/hackathons/:slug/submissions" element={<SubmissionsPage />} />
          <Route path="/hackathons/:slug/judging" element={<JudgingPage />} />
          <Route path="/hackathons/:slug/rounds" element={<RoundsPage />} />
          <Route path="/hackathons/:slug/announcements" element={<AnnouncementsPage />} />
          <Route path="/hackathons/:slug/activity" element={<ActivityPage />} />
          <Route path="/hackathons/:slug/analytics" element={<AnalyticsPage />} />
          <Route path="/hackathons/:slug/settings" element={<SettingsPage />} />
          <Route path="/hackathons/:slug/judge" element={<JudgeScoringPage />} />
        </Route>
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
