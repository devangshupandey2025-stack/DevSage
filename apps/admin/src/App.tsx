import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginPage } from '@/pages/login';
import { AdminDashboardPage } from '@/pages/dashboard';
import { InvitesPage } from '@/pages/invites';
import { AdminsPage } from '@/pages/admins';
import { ProfilePage } from '@/pages/profile';
import { WorkspacesPage } from '@/pages/workspaces';
import { WorkspaceDetailPage } from '@/pages/workspace-detail';
import { UsersPage } from '@/pages/users';
import { HackathonsPage } from '@/pages/hackathons';
import { HackathonDetailPage } from '@/pages/hackathon-detail';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <AdminDashboardPage /> },
          { path: '/invites', element: <InvitesPage /> },
          { path: '/admins', element: <AdminsPage /> },
          { path: '/workspaces', element: <WorkspacesPage /> },
          { path: '/workspaces/:id', element: <WorkspaceDetailPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/hackathons', element: <HackathonsPage /> },
          { path: '/hackathons/:id', element: <HackathonDetailPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
