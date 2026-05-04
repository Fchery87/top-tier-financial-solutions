import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminAnalyticsPanel } from '@/components/admin/AdminAnalyticsPanel';

const fetchMock = vi.fn();

describe('AdminAnalyticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows operator and client outcome analytics as separate dashboard sections', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          operator_analytics: {
            import_success: { pending_or_failed_reports: 2 },
            response_aging: { due_soon: 3, overdue: 1 },
            cycle_throughput: { active_cycles: 4 },
            billing_readiness: { services_rendered_events: 5 },
            workload: { open_tasks: 6 },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_outcome_analytics: {
            outcomes: { deleted: 7, updated: 8, verified: 9 },
            score_movement: { total: 10 },
            new_negatives: { count: 11 },
            bureau_progress: {
              experian: { deleted: 1, updated: 0, verified: 0, new_negatives: 2 },
              transunion: { deleted: 0, updated: 1, verified: 0, new_negatives: 3 },
              equifax: { deleted: 0, updated: 0, verified: 1, new_negatives: 4 },
            },
          },
        }),
      });

    render(<AdminAnalyticsPanel />);

    expect(await screen.findByRole('heading', { name: /operator analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /client outcome analytics/i })).toBeInTheDocument();

    expect(screen.getByText('Pending imports')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Open tasks')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();

    expect(screen.getByText('Deleted outcomes')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('New negatives')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/operator-analytics');
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/client-outcome-analytics');
    });
  });
});
