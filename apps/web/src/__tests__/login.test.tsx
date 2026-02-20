import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Better Auth client
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

// Import after mocks
import { LoginPageForTest } from './test-helpers';

describe('LoginPage', () => {
  it('renders Sign in with GitHub button (primary)', () => {
    render(<LoginPageForTest />);
    expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
  });

  it('renders Sign in with Google button (secondary)', () => {
    render(<LoginPageForTest />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('shows terms of participation text', () => {
    render(<LoginPageForTest />);
    expect(screen.getByText(/terms of participation/i)).toBeInTheDocument();
  });
});
