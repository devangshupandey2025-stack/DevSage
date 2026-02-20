import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authClient } from '../lib/auth-client';
import { setTokenGetter } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [hackathonRoles, setHackathonRoles] = useState<Record<string, string[]>>({});
  const [workspaceRoles, setWorkspaceRoles] = useState<Record<string, string>>({});

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const authUrl = import.meta.env.VITE_AUTH_URL || 'http://localhost:8788';
      const res = await fetch(`${authUrl}/token`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      setToken(data.token);

      const payload = JSON.parse(atob(data.token.split('.')[1]));
      setIsPlatformAdmin(!!payload.platformAdmin);
      setHackathonRoles(payload.hackathonRoles || {});
      setWorkspaceRoles(payload.workspaceRoles || {});
      setIsOrganizer(
        Object.values(payload.hackathonRoles || {}).some((roles: any) =>
          roles.includes('organizer') || roles.includes('co_organizer'),
        ),
      );

      return data.token;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const session = await authClient.getSession();
        if (session.data?.user) {
          setUser({
            id: session.data.user.id,
            email: session.data.user.email,
            name: session.data.user.name,
            image: session.data.user.image || null,
          });
          await refreshToken();
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshToken]);

  useEffect(() => {
    setTokenGetter(refreshToken);
  }, [refreshToken]);

  const logout = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setToken(null);
    setIsPlatformAdmin(false);
    setIsOrganizer(false);
    setHackathonRoles({});
    setWorkspaceRoles({});
    window.location.href = '/login';
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
