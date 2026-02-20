import type { ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * AuthProvider — wraps the app with Better Auth session context.
 * Better Auth's `useSession()` works without an explicit provider,
 * but this wrapper can be extended with additional session logic.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Re-export session hook from Better Auth for convenience.
 */
export const useSession = authClient.useSession;
