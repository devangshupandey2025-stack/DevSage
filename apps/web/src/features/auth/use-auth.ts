import { authClient } from '@/lib/auth-client';

/**
 * useAuth — convenience hook wrapping Better Auth's session and auth methods.
 */
export function useAuth() {
  const session = authClient.useSession();

  return {
    session: session.data,
    user: session.data?.user ?? null,
    isPending: session.isPending,
    isAuthenticated: !!session.data?.user,
    signIn: authClient.signIn,
    signOut: authClient.signOut,
  };
}
