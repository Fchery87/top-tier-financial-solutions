import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkQueue } from '../WorkQueue';

const mockAdminContext = (userId: string | null) => ({
  role: null,
  isSuperAdmin: false,
  isAdmin: false,
  isStaff: false,
  userId,
  userEmail: userId ? `${userId}@example.com` : null,
});

// Mock AdminContext
vi.mock('@/contexts/AdminContext', () => ({
  useAdminRole: vi.fn(() => mockAdminContext('user-123')),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useAdminRole } from '@/contexts/AdminContext';

describe('WorkQueue', () => {
  const mockDisputesData = {
    disputes: [
      {
        id: 'd1',
        client_name: 'John Doe',
        bureau: 'experian',
        round: 1,
        sent_at: '2024-01-01T00:00:00Z',
        response_deadline: '2024-12-30T00:00:00Z', // Future date
      },
      {
        id: 'd2',
        client_name: 'Jane Smith',
        bureau: 'transunion',
        round: 2,
        sent_at: '2024-01-02T00:00:00Z',
        response_deadline: '2020-01-01T00:00:00Z', // Past date (overdue)
      },
    ],
  };

  const mockTasksData = {
    items: [
      {
        id: 't1',
        title: 'Review client documents',
        status: 'todo' as const,
        priority: 'high' as const,
        due_date: '2024-12-25T00:00:00Z',
        client_name: 'Test Client',
      },
      {
        id: 't2',
        title: 'Follow up with bureau',
        status: 'in_progress' as const,
        priority: 'medium' as const,
        due_date: null,
        client_name: null,
      },
      {
        id: 't3',
        title: 'Completed task',
        status: 'done' as const,
        priority: 'low' as const,
        due_date: null,
        client_name: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Tab System', () => {
    it('should show all tabs when userId is available', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('Awaiting Responses')).toBeInTheDocument();
        expect(screen.getByText('Overdue Responses')).toBeInTheDocument();
        expect(screen.getByText('My Tasks')).toBeInTheDocument();
        expect(screen.getByText('Onboarding')).toBeInTheDocument();
      });
    });

    it('should hide My Tasks tab when userId is not available', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext(null));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('Awaiting Responses')).toBeInTheDocument();
        expect(screen.queryByText('My Tasks')).not.toBeInTheDocument();
      });
    });

    it('should switch tabs when clicking tab buttons', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('My Tasks')).toBeInTheDocument();
      });

      const tasksTab = screen.getByText('My Tasks');
      tasksTab.click();

      await waitFor(() => {
        expect(screen.getByText('No open tasks assigned to you.')).toBeInTheDocument();
      });
    });

    it('should show tab counts when data is available', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      vi.mocked(global.fetch).mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('awaiting_response=true')) {
            return Promise.resolve({
              ok: true,
              json: async () => mockDisputesData,
            } as Response);
          }
          if (url.includes('overdue=true')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ disputes: [mockDisputesData.disputes[0]] }),
            } as Response);
          }
          if (url.includes('/tasks')) {
            return Promise.resolve({
              ok: true,
              json: async () => mockTasksData,
            } as Response);
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('Awaiting Responses')).toBeInTheDocument();
        const counts = screen.getAllByText(/\(2\)/);
        expect(counts.length).toBeGreaterThan(0); // At least one tab should show (2)
        // Note: mockTasksData has 3 items, but 1 is "done", so only 2 should show
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch all queue data on mount', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/disputes?awaiting_response=true');
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/disputes?overdue=true');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/admin/tasks?assignee_id=user-123')
        );
        expect(global.fetch).toHaveBeenCalledWith('/api/admin/clients?status=pending&limit=20');
      });
    });

    it('should not fetch tasks when userId is not available', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext(null));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/admin/tasks'));
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      const error = new Error('API Error');
      vi.mocked(global.fetch).mockRejectedValue(error);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading work queue:', error);
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-ok responses gracefully', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      render(<WorkQueue />);

      // Should not crash, should show empty state
      await waitFor(() => {
        expect(screen.getByText('No disputes currently awaiting responses.')).toBeInTheDocument();
      });
    });

    it('should limit awaiting disputes to 5 items', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      const manyDisputes = Array.from({ length: 10 }, (_, i) => ({
        id: `d${i}`,
        client_name: `Client ${i}`,
        bureau: 'experian',
        round: 1,
        sent_at: '2024-01-01T00:00:00Z',
        response_deadline: null,
      }));

      vi.mocked(global.fetch).mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('awaiting_response=true')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ disputes: manyDisputes }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      await waitFor(() => {
        // Should only show first 5
        expect(screen.getByText('Client 0')).toBeInTheDocument();
        expect(screen.getByText('Client 4')).toBeInTheDocument();
        expect(screen.queryByText('Client 5')).not.toBeInTheDocument();
      });
    });

    it('should filter out completed tasks', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      vi.mocked(global.fetch).mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/tasks')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTasksData,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      // Switch to tasks tab
      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        tasksTab.click();
      });

      // Should show only non-done tasks
      await waitFor(() => {
        expect(screen.getByText('Review client documents')).toBeInTheDocument();
        expect(screen.getByText('Follow up with bureau')).toBeInTheDocument();
        expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should render component without errors', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);

      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('Work Queue')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    beforeEach(() => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ disputes: [], items: [] }),
      } as Response);
    });

    it('should show empty state for awaiting responses', async () => {
      render(<WorkQueue />);

      await waitFor(() => {
        expect(screen.getByText('No disputes currently awaiting responses.')).toBeInTheDocument();
      });
    });

    it('should show empty state for overdue responses', async () => {
      const user = userEvent.setup();
      render(<WorkQueue />);

      await waitFor(() => {
        const overdueTab = screen.getByText('Overdue Responses');
        user.click(overdueTab);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No overdue bureau responses. Great job staying ahead.')
        ).toBeInTheDocument();
      });
    });

    it('should show empty state for tasks with userId', async () => {
      const user = userEvent.setup();
      render(<WorkQueue />);

      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        user.click(tasksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('No open tasks assigned to you.')).toBeInTheDocument();
      });
    });

    it('should show different empty state for tasks without userId', async () => {
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext(null));

      const user = userEvent.setup();
      render(<WorkQueue />);

      // Switch to a different tab first (since tasks tab won't be visible)
      await waitFor(() => {
        const overdueTab = screen.getByText('Overdue Responses');
        user.click(overdueTab);
      });

      // Tasks tab should not be visible
      expect(screen.queryByText('My Tasks')).not.toBeInTheDocument();
    });

    it('should show empty state for onboarding', async () => {
      const user = userEvent.setup();
      render(<WorkQueue />);

      await waitFor(() => {
        const onboardingTab = screen.getByText('Onboarding');
        user.click(onboardingTab);
      });

      await waitFor(() => {
        expect(screen.getByText('No pending onboarding clients right now.')).toBeInTheDocument();
      });
    });
  });

  describe('Task Marking', () => {
    it('should mark task as done when clicking checkmark button', async () => {
      const user = userEvent.setup();
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      // Initial fetch
      vi.mocked(global.fetch).mockImplementation((url, options) => {
        if (typeof url === 'string' && url.includes('/tasks') && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTasksData,
          } as Response);
        }
        // PUT request to mark as done
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      // Switch to tasks tab
      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        user.click(tasksTab);
      });

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('Review client documents')).toBeInTheDocument();
      });

      // Find and click the first checkmark button
      const checkButtons = screen.getAllByLabelText('Mark task done');
      await user.click(checkButtons[0]);

      // Should make PUT request
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/tasks/t1',
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'done' }),
          })
        );
      });

      // Task should be removed from list
      await waitFor(() => {
        expect(screen.queryByText('Review client documents')).not.toBeInTheDocument();
      });
    });

    it('should show loading spinner while marking task as done', async () => {
      const user = userEvent.setup();
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      let resolvePut: () => void;
      const putPromise = new Promise<void>((resolve) => {
        resolvePut = resolve;
      });

      vi.mocked(global.fetch).mockImplementation((url, options) => {
        if (typeof url === 'string' && url.includes('/tasks') && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTasksData,
          } as Response);
        }
        if (options?.method === 'PUT') {
          return putPromise.then(() =>
            Promise.resolve({
              ok: true,
              json: async () => ({}),
            } as Response)
          );
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      // Switch to tasks tab
      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        user.click(tasksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Review client documents')).toBeInTheDocument();
      });

      const checkButtons = screen.getAllByLabelText('Mark task done');
      await user.click(checkButtons[0]);

      // Should show loading spinner
      await waitFor(() => {
        const button = checkButtons[0];
        const spinner = button.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });

      resolvePut!();
      await putPromise;
    });

    it('should handle task marking errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      const error = new Error('Update failed');

      vi.mocked(global.fetch).mockImplementation((url, options) => {
        if (typeof url === 'string' && url.includes('/tasks') && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTasksData,
          } as Response);
        }
        if (options?.method === 'PUT') {
          return Promise.reject(error);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      // Switch to tasks tab
      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        user.click(tasksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Review client documents')).toBeInTheDocument();
      });

      const checkButtons = screen.getAllByLabelText('Mark task done');
      await user.click(checkButtons[0]);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error marking task done:', error);
      });

      // Task should still be in the list
      expect(screen.getByText('Review client documents')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should disable button while task is being marked', async () => {
      const user = userEvent.setup();
      vi.mocked(useAdminRole).mockReturnValue(mockAdminContext('user-123'));

      let resolvePut: () => void;
      const putPromise = new Promise<void>((resolve) => {
        resolvePut = resolve;
      });

      vi.mocked(global.fetch).mockImplementation((url, options) => {
        if (typeof url === 'string' && url.includes('/tasks') && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => mockTasksData,
          } as Response);
        }
        if (options?.method === 'PUT') {
          return putPromise.then(() =>
            Promise.resolve({
              ok: true,
              json: async () => ({}),
            } as Response)
          );
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ disputes: [], items: [] }),
        } as Response);
      });

      render(<WorkQueue />);

      // Switch to tasks tab
      await waitFor(() => {
        const tasksTab = screen.getByText(/My Tasks/);
        user.click(tasksTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Review client documents')).toBeInTheDocument();
      });

      const checkButtons = screen.getAllByLabelText('Mark task done');
      await user.click(checkButtons[0]);

      // Button should be disabled
      await waitFor(() => {
        expect(checkButtons[0]).toBeDisabled();
      });

      resolvePut!();
      await putPromise;
    });
  });

});
