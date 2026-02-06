import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthCallbackPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && user) {
        if (user.role === 'organiser') {
            navigate('/organiser');
        } else {
            navigate('/dashboard');
        }
      } else {
        navigate('/login');
      }
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <p className="text-muted-foreground">Authenticating...</p>
        </div>
    </div>
  );
}
