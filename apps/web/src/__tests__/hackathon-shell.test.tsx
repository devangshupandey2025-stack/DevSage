import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { HackathonShellPageForTest } from './test-helpers';

describe('HackathonShellPage', () => {
  it('renders hackathon name', () => {
    render(<HackathonShellPageForTest />);
    expect(screen.getByText('DevSage Launch Hackathon 2026')).toBeInTheDocument();
  });

  it('shows "Live data coming soon" badge', () => {
    render(<HackathonShellPageForTest />);
    expect(screen.getByText('Live data coming soon')).toBeInTheDocument();
  });

  it('displays rules list', () => {
    render(<HackathonShellPageForTest />);
    expect(screen.getByText(/teams of 2–5 members/i)).toBeInTheDocument();
    expect(screen.getByText(/no plagiarism/i)).toBeInTheDocument();
  });

  it('shows git tag submission section', () => {
    render(<HackathonShellPageForTest />);
    expect(screen.getByText('Submit via Git Tags')).toBeInTheDocument();
    expect(screen.getByText(/r1_submission_v1 && git push origin --tags/)).toBeInTheDocument();
  });

  it('shows disabled manual SHA upload button', () => {
    render(<HackathonShellPageForTest />);
    const button = screen.getByRole('button', { name: /upload commit sha/i });
    expect(button).toBeDisabled();
  });
});
