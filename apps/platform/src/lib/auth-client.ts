import { createAuthClient } from 'better-auth/react';
import { twoFactorClient, magicLinkClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:8788',
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/2fa';
      },
    }),
    passkeyClient(),
    magicLinkClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
