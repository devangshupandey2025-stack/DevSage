import { render, screen, waitFor } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../contexts/auth-context';

function AuthStateProbe(): ReactElement {
  const { isLoading, isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? 'present' : 'missing'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise(() => {
          return undefined;
        })
    );

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('handles unauthenticated state when /api/auth/me returns 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('missing');
  });
});
