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
    isJudge: boolean;
  };
  meta: unknown;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isJudge: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isJudge, setIsJudge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshAuth() {
    try {
      const response = await apiRequest<AuthResponse>('/auth/me');
      setUser(response.data.user);
      setIsJudge(response.data.isJudge);
    } catch (_error) {
      setUser(null);
      setIsJudge(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshAuth();
  }, []);

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      setUser(null);
      setIsJudge(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed', error);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, isJudge, logout, refreshAuth }}>
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
