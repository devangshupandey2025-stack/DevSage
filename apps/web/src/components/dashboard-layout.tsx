import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to={user?.role === 'organiser' ? '/organiser' : '/dashboard'} className="text-xl font-bold">
              DevSage
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user?.role === 'organiser' ? (
                <Link to="/organiser" className={location.pathname === '/organiser' ? 'font-semibold' : 'text-muted-foreground hover:text-foreground'}>
                  Dashboard
                </Link>
              ) : (
                <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'font-semibold' : 'text-muted-foreground hover:text-foreground'}>
                  Dashboard
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
