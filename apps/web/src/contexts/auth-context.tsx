import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiRequest } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  github_username: string | null;
}

interface AuthMeData {
  user: User;
  isPlatformAdmin: boolean;
  isOrganizer: boolean;
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hackathonRoles: Record<string, string[]>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hackathonRoles, setHackathonRoles] = useState<Record<string, string[]>>({});

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiRequest<{ ok: boolean; data: AuthMeData }>('/auth/me');
      const data = response.data;
      setUser(data.user);
      setHackathonRoles(data.hackathonRoles || {});
    } catch {
      setUser(null);
      setHackathonRoles({});
    }
  }, []);

  useEffect(() => {
    async function init() {
      await refreshUser();
      setIsLoading(false);
    }
    void init();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setHackathonRoles({});
      window.location.href = '/';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        hackathonRoles,
        refreshUser,
        logout,
      }}
    >
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
