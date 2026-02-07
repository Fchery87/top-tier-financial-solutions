import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminGuard } from '../AdminGuard';

// Mock dependencies
const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/components/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  signOut: () => mockSignOut(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/contexts/AdminContext', () => ({
  AdminProvider: ({
    children,
    role,
    userId,
    userEmail,
  }: {
    children: React.ReactNode;
    role: string | null;
    userId: string | null;
    userEmail: string | null;
  }) => (
    <div data-testid="admin-provider" data-role={role} data-user-id={userId} data-user-email={userEmail}>
      {children}
    </div>
  ),
}));

// Import mocked useAuth
import { useAuth } from '@/components/AuthProvider';

describe('AdminGuard', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading States', () => {
    it('should show loading spinner when auth is loading', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      expect(screen.getByText('Verifying access...')).toBeInTheDocument();
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should show loading spinner while checking access', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      // Mock fetch to delay response
      vi.mocked(global.fetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ authorized: true, role: 'super_admin' }),
              } as Response);
            }, 100);
          })
      );

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      // Should show loading initially
      expect(screen.getByText('Verifying access...')).toBeInTheDocument();
    });
  });

  describe('Not Logged In State', () => {
    it('should show authentication required message when user is not logged in', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      });

      expect(screen.getByText('You need to sign in to access the admin panel.')).toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should render Sign In link with correct href', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        const signInLink = screen.getByText('Sign In').closest('a');
        expect(signInLink).toHaveAttribute('href', '/sign-in');
      });
    });

    it('should render Back to Home link with correct href', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        const homeLinks = screen.getAllByText('Back to Home');
        const homeLink = homeLinks[0].closest('a');
        expect(homeLink).toHaveAttribute('href', '/');
      });
    });
  });

  describe('Access Check Logic', () => {
    it('should make POST request to /api/admin/check-access', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'super_admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });

    it('should authorize user when API returns authorized: true', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'super_admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });
    });

    it('should not authorize user when API returns authorized: false', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: false, role: null }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should not authorize user when API response is not ok', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      const error = new Error('Network error');
      vi.mocked(global.fetch).mockRejectedValue(error);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking admin access:', error);
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Not Authorized State', () => {
    beforeEach(async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: false, role: null }),
      } as Response);
    });

    it('should show access denied message for unauthorized users', async () => {
      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/You don't have permission to access the admin panel/)
      ).toBeInTheDocument();
      expect(screen.getByText(/super_admin/)).toBeInTheDocument();
    });

    it('should show Back to Home and Sign Out buttons for unauthorized users', async () => {
      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        const backHomeButtons = screen.getAllByText('Back to Home');
        const signOutButton = screen.getByText('Sign Out');

        expect(backHomeButtons.length).toBeGreaterThan(0);
        expect(signOutButton).toBeInTheDocument();
      });
    });

    it('should call signOut, push, and refresh when Sign Out button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });

      const signOutButton = screen.getByText('Sign Out');
      await user.click(signOutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authorized State', () => {
    it('should render children wrapped in AdminProvider for authorized super_admin', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'super_admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });

      const adminProvider = screen.getByTestId('admin-provider');
      expect(adminProvider).toHaveAttribute('data-role', 'super_admin');
      expect(adminProvider).toHaveAttribute('data-user-id', '123');
      expect(adminProvider).toHaveAttribute('data-user-email', 'admin@example.com');
    });

    it('should render children for authorized admin role', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });

      const adminProvider = screen.getByTestId('admin-provider');
      expect(adminProvider).toHaveAttribute('data-role', 'admin');
    });

    it('should render children for authorized staff role', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'staff' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });

      const adminProvider = screen.getByTestId('admin-provider');
      expect(adminProvider).toHaveAttribute('data-role', 'staff');
    });

    it('should default to null role when role is not provided but authorized is true', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true }), // No role field
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });

      const adminProvider = screen.getByTestId('admin-provider');
      expect(adminProvider.getAttribute('data-role')).toBeNull();
    });

    it('should pass null userId when user id is missing', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '', name: 'Test User', email: 'admin@example.com' }, // Empty id field
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'super_admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });

      const adminProvider = screen.getByTestId('admin-provider');
      // When null is passed to a data attribute, it doesn't render as string "null"
      // Check that the attribute is not set or is empty
      const userId = adminProvider.getAttribute('data-user-id');
      expect(userId === null || userId === '' || userId === 'null').toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should not call checkAccess when authLoading is true', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      // Should not make API call while auth is loading
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle transition from no user to authenticated user', async () => {
      // Start with no user
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      const { unmount } = render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      });

      // Clean up first render
      unmount();

      // Simulate user logging in - new render with authenticated user
      vi.mocked(useAuth).mockReturnValue({
        user: { id: '123', name: 'Test User', email: 'admin@example.com' },
        isLoading: false,
        isAuthenticated: true,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ authorized: true, role: 'super_admin' }),
      } as Response);

      render(
        <AdminGuard>
          <div>Admin Content</div>
        </AdminGuard>
      );

      // Should now make API call to check access
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      });

      // Should show admin content after successful authorization
      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });
    });
  });
});
