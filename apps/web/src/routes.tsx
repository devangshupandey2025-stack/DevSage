import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { ProtectedRoute } from './components/protected-route';
import { Skeleton } from './components/ui/skeleton';

// Lazy imports with named exports handling
const HomePage = lazy(() => import('./pages/home').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('./pages/login').then(module => ({ default: module.LoginPage })));
const AuthCallbackPage = lazy(() => import('./pages/auth-callback').then(module => ({ default: module.AuthCallbackPage })));
const DashboardPage = lazy(() => import('./pages/dashboard').then(module => ({ default: module.DashboardPage })));
const OrganiserDashboardPage = lazy(() => import('./pages/organiser-dashboard').then(module => ({ default: module.OrganiserDashboardPage })));
const HackathonDetailPage = lazy(() => import('./pages/hackathon-detail').then(module => ({ default: module.HackathonDetailPage })));
const TeamManagementPage = lazy(() => import('./pages/team-management').then(module => ({ default: module.TeamManagementPage })));
const NotFoundPage = lazy(() => import('./pages/not-found').then(module => ({ default: module.NotFoundPage })));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center p-8">
     <div className="space-y-4 w-full max-w-md">
       <Skeleton className="h-12 w-full" />
       <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

const SuspenseLayout = () => (
  <Suspense fallback={<PageLoader />}>
    <Outlet />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    element: <SuspenseLayout />,
    children: [
       {
         path: '/',
         element: <HomePage />,
       },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/hackathons/:id',
            element: <HackathonDetailPage />,
          },
          {
            path: '/hackathons/:id/teams',
            element: <TeamManagementPage />,
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['organiser']} />,
        children: [
          {
            path: '/organiser',
            element: <OrganiserDashboardPage />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ]
  }
]);
