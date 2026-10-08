import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TeamManager } from '@/components/workspace/team/TeamManager';

const fetchMock = vi.fn();

function teamPayload() {
  return {
    members: [
      {
        id: 'owner-1',
        email: 'owner@example.com',
        name: 'Owner One',
        role: 'super_admin',
        last_active_at: '2026-08-02T12:00:00.000Z',
        is_last_super_admin: true,
      },
      {
        id: 'member-1',
        email: 'member@example.com',
        name: 'Member One',
        role: 'staff',
        last_active_at: null,
        is_last_super_admin: false,
      },
    ],
    recent_activity: [{
      id: 'activity-1',
      action: 'user_role.changed',
      subject_type: 'user_role',
      subject_id: 'member-1',
      actor_name: 'Owner One',
      created_at: '2026-08-02T12:15:00.000Z',
    }],
  };
}

describe('TeamManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders a loading state before the team response arrives', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined));

    render(<TeamManager currentUserId="owner-1" />);

    expect(screen.getByText('Loading team members…')).toBeInTheDocument();
  });

  it('renders the forbidden state when the Team API returns 403', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });

    render(<TeamManager currentUserId="owner-1" />);

    expect(await screen.findByText('You do not have permission to manage team roles.')).toBeInTheDocument();
  });

  it('updates a member role and refreshes the displayed team data', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => teamPayload() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ member: { id: 'member-1', role: 'admin' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => teamPayload() });

    render(<TeamManager currentUserId="owner-1" />);

    const roleSelect = await screen.findByLabelText('Role for Member One');
    await userEvent.selectOptions(roleSelect, 'admin');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/workspace/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'member-1', role: 'admin' }),
      });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it('keeps the roster visible and explains a failed role update', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => teamPayload() })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'last_super_admin' }) });

    render(<TeamManager currentUserId="owner-1" />);

    await userEvent.selectOptions(await screen.findByLabelText('Role for Member One'), 'admin');

    expect(await screen.findByText('The final super admin cannot be demoted.')).toBeInTheDocument();
    expect(screen.getByLabelText('Role for Owner One')).toBeInTheDocument();
  });

  it('disables the current final super admin role control with explanatory copy', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => teamPayload() });

    render(<TeamManager currentUserId="owner-1" />);

    expect(await screen.findByLabelText('Role for Owner One')).toBeDisabled();
    expect(screen.getByText('Final super admin — assign another owner first.')).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });
});
