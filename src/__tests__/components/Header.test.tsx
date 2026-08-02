import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/AuthProvider', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn() }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => <button type="button">Theme</button> }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { Header } from '@/components/Header';

describe('Header signed-in navigation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows My Portal in desktop and mobile menus for a client', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'client-1', name: 'Client', email: 'client@example.com', role: 'user' },
      isLoading: false,
    });

    render(<Header />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /client/i })[0]!);
    expect(screen.getAllByText('My Portal')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    expect(screen.getAllByText('My Portal')).toHaveLength(2);
  });

  it('shows Workspace and omits My Portal for team roles', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'staff-1', name: 'Staff', email: 'staff@example.com', role: 'staff' },
      isLoading: false,
    });

    render(<Header />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /staff/i }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: /staff/i })[0]!);

    expect(screen.getAllByText('Workspace').length).toBeGreaterThan(0);
    expect(screen.queryByRole('menuitem', { name: /my portal/i })).not.toBeInTheDocument();
  });
});
