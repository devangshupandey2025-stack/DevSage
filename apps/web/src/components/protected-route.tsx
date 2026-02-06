import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  allowedRoles?: ('participant' | 'organiser')[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="space-y-4 w-full max-w-md">
           <Skeleton className="h-12 w-full" />
           <Skeleton className="h-4 w-3/4" />
           <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If organiser tries to access participant only, or vice versa (though we don't have participant-only routes really)
    // If generic protected route, it allows both.
    // If specifically for organiser, and user is participant, send to dashboard.
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
