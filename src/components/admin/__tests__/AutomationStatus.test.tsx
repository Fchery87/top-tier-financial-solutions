import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutomationStatus } from '@/components/admin/AutomationStatus';

const fetchMock = vi.fn();

describe('AutomationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  function mockStatsResponse() {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        emailsSentToday: 1,
        emailsFailedToday: 0,
        pendingEmails: 0,
        automationsActive: 4,
        disputeEscalations: {
          eligibleNow: 2,
          escalatedLast24h: 1,
          lastRunAt: new Date().toISOString(),
          lastRunSuccess: true,
          lastRunDryRun: false,
          lastRunChecked: 2,
          lastRunEscalated: 1,
          lastRunWouldEscalate: 0,
          lastRunSkipped: 1,
          lastRunError: null,
          health: 'healthy',
        },
        recentFailures: [],
      }),
    });
  }

  it('runs escalation dry run from the dashboard', async () => {
    mockStatsResponse();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, dry_run: true, checked: 2, escalated: 0, would_escalate: 2, skipped: 0 }),
    });
    mockStatsResponse();

    render(<AutomationStatus />);

    const dryRunButton = await screen.findByRole('button', { name: /run dry-run/i });
    await userEvent.click(dryRunButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/automation/dispute-escalations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
    });

    expect(await screen.findByText(/dry run complete/i)).toBeInTheDocument();
  });

  it('runs escalation live from the dashboard', async () => {
    mockStatsResponse();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, dry_run: false, checked: 2, escalated: 1, would_escalate: 0, skipped: 1 }),
    });
    mockStatsResponse();

    render(<AutomationStatus />);

    const runLiveButton = await screen.findByRole('button', { name: /run live/i });
    await userEvent.click(runLiveButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/automation/dispute-escalations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
    });

    expect(await screen.findByText(/live run complete/i)).toBeInTheDocument();
  });
});
