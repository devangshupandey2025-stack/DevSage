import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiRequest } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
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
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isOrganizer: boolean;
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [hackathonRoles, setHackathonRoles] = useState<Record<string, string[]>>({});
  const [workspaceRoles, setWorkspaceRoles] = useState<Record<string, string>>({});

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await apiRequest<{ ok: boolean; data: AuthMeData }>('/auth/me');
      const data = response.data;
      setUser(data.user);
      setIsPlatformAdmin(data.isPlatformAdmin);
      setIsOrganizer(data.isOrganizer);
      setHackathonRoles(data.hackathonRoles || {});
      setWorkspaceRoles(data.workspaceRoles || {});
      return 'refreshed';
    } catch {
      setUser(null);
      setIsPlatformAdmin(false);
      setIsOrganizer(false);
      setHackathonRoles({});
      setWorkspaceRoles({});
      return null;
    }
  }, []);

  useEffect(() => {
    async function init() {
      await refreshToken();
      setIsLoading(false);
    }
    void init();
  }, [refreshToken]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setIsPlatformAdmin(false);
      setIsOrganizer(false);
      setHackathonRoles({});
      setWorkspaceRoles({});
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isPlatformAdmin,
        isOrganizer,
        hackathonRoles,
        workspaceRoles,
        refreshToken,
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
