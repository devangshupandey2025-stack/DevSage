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
  isJudge: boolean;
  hackathonRoles: Record<string, string[]>;
  password_must_change?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isJudge: boolean;
  passwordMustChange: boolean;
  hackathonRoles: Record<string, string[]>;
  refreshToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJudge, setIsJudge] = useState(false);
  const [passwordMustChange, setPasswordMustChange] = useState(false);
  const [hackathonRoles, setHackathonRoles] = useState<Record<string, string[]>>({});

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await apiRequest<{ ok: boolean; data: AuthMeData }>('/auth/me');
      const data = response.data;
      setUser(data.user);
      setIsJudge(data.isJudge);
      setPasswordMustChange(!!data.password_must_change);
      setHackathonRoles(data.hackathonRoles || {});
      // Redirect to change password if forced
      if (data.password_must_change && window.location.pathname !== '/change-password') {
        window.location.href = '/change-password';
      }
      return 'refreshed';
    } catch {
      setUser(null);
      setIsJudge(false);
      setPasswordMustChange(false);
      setHackathonRoles({});
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
      setIsJudge(false);
      setHackathonRoles({});
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
        isJudge,
        passwordMustChange,
        hackathonRoles,
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
