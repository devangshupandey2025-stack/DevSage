import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LoginPage } from '../pages/login';

describe('LoginPage', () => {
  it('renders Continue with Google button', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('renders Continue with GitHub button', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
  });
});
