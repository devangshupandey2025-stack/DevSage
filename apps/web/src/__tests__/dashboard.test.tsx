import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Better Auth client with authenticated session
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user-id',
          name: 'Test User',
          email: 'test@example.com',
          image: 'https://example.com/avatar.jpg',
        },
        session: { id: 'test-session' },
      },
      isPending: false,
    }),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
  redirect: vi.fn(),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// Mock API
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn().mockResolvedValue({ ok: true, data: [], meta: {} }),
  ApiError: class extends Error {},
}));

import { DashboardPageForTest } from './test-helpers';

function renderWithProviders(ui: JSX.Element) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('renders welcome message with user name', () => {
    renderWithProviders(<DashboardPageForTest />);
    expect(screen.getByText(/welcome back, test/i)).toBeInTheDocument();
  });

  it('displays user avatar', () => {
    const { container } = renderWithProviders(<DashboardPageForTest />);
    const avatar = container.querySelector('img[src="https://example.com/avatar.jpg"]');
    expect(avatar).toBeInTheDocument();
  });

  it('displays user email', () => {
    renderWithProviders(<DashboardPageForTest />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows hackathon tabs (Upcoming, Ongoing, Past)', () => {
    renderWithProviders(<DashboardPageForTest />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Ongoing')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
  });
});
