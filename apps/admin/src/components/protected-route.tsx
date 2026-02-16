import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

function AccessDenied() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
          <ShieldX className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="mt-3 text-white/60">
          You are signed in as <span className="text-white">{user?.name || user?.email}</span>, but
          this account is not a platform administrator.
        </p>
        <p className="mt-2 text-sm text-white/40">
          Only SHIKDD team members can access this portal.
        </p>
        <Button
          variant="outline"
          className="mt-6 border-white/20 text-white hover:border-[#CCFF00] hover:bg-[#CCFF00]/10"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isPlatformAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-[#CCFF00]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isPlatformAdmin) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
