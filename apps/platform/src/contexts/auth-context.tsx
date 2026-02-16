import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiRequest } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

interface AuthResponse {
  ok: boolean;
  data: {
    user: User;
    roles: string[];
    isPlatformAdmin: boolean;
    isOrganizer: boolean;
  };
  meta: unknown;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOrganizer: boolean;
  isPlatformAdmin: boolean;
  logout: () => Promise<void>;
}

const DEV_USER: User = {
  id: '00000000-0000-0000-0000-dev000000000',
  email: 'dev@localhost',
  name: 'Dev User',
  avatar_url: null,
  created_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In dev mode, skip OAuth entirely and use a mock user
    if (import.meta.env.DEV) {
      setUser(DEV_USER);
      setIsOrganizer(true);
      setIsPlatformAdmin(true);
      setIsLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const response = await apiRequest<AuthResponse>('/auth/me');
        setUser(response.data.user);
        setIsOrganizer(response.data.isOrganizer);
        setIsPlatformAdmin(response.data.isPlatformAdmin);
      } catch (_error) {
        setUser(null);
        setIsOrganizer(false);
        setIsPlatformAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      setUser(null);
      setIsOrganizer(false);
      setIsPlatformAdmin(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed', error);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, isOrganizer, isPlatformAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
