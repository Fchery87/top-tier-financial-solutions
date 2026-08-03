import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const searchParams = vi.hoisted(() => new URLSearchParams('dispute=dispute-deep-link'));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/contexts/AdminContext', () => ({
  useAdminRole: () => ({ userId: 'staff-user', role: 'staff' }),
}));

vi.mock('@/components/workspace/AdminPageHeader', () => ({
  AdminPageHeader: () => <div data-testid="admin-page-header" />,
}));
vi.mock('@/components/workspace/DisputeCalendar', () => ({
  DisputeCalendar: () => null,
}));
vi.mock('@/components/workspace/disputes/DisputeStatsCards', () => ({
  DisputeStatsCards: () => null,
}));
vi.mock('@/components/workspace/disputes/DisputeFilters', () => ({
  DisputeFilters: () => null,
}));
vi.mock('@/components/workspace/disputes/DisputeDetailPanel', () => ({
  DisputeDetailPanel: ({ open, dispute }: { open: boolean; dispute: { id: string } | null }) => (
    open ? <div data-testid="dispute-detail-panel">{dispute?.id}</div> : null
  ),
}));
vi.mock('@/components/workspace/disputes/ResponseReviewQueue', () => ({
  ResponseReviewQueue: ({
    disputes,
    onReview,
  }: {
    disputes: Array<{ id: string }>;
    onReview: (dispute: { id: string }) => void;
  }) => (
    <button type="button" onClick={() => onReview(disputes[0])}>
      Review queued response
    </button>
  ),
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));
vi.mock('@/components/workspace/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  getStatusVariant: () => 'default',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DisputesPage from '@/app/workspace/disputes/page';

const dispute = {
  id: 'dispute-deep-link',
  client_id: 'client-1',
  client_name: 'Portal Fixture',
  negative_item_id: null,
  bureau: 'transunion',
  dispute_reason: 'Not mine',
  dispute_type: 'identity',
  status: 'sent',
  round: 1,
  tracking_number: null,
  sent_at: null,
  letter_content: null,
  response_deadline: null,
  response_received_at: null,
  outcome: null,
  response_notes: null,
  response_channel: null,
  score_impact: null,
  creditor_name: 'Fixture Card Services',
  account_number: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('Workspace disputes deep links', () => {
  beforeEach(() => {
    searchParams.set('dispute', 'dispute-deep-link');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ disputes: [dispute] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))));
  });

  it('opens the dispute detail panel after the requested dispute loads', async () => {
    render(<DisputesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('dispute-detail-panel')).toHaveTextContent('dispute-deep-link');
    });
  });

  it('loads the response-review queue and opens its selected dispute', async () => {
    searchParams.delete('dispute');
    const queuedDispute = { ...dispute, id: 'queued-response' };
    vi.mocked(global.fetch).mockImplementation((input) => {
      const url = String(input);
      const result = url.includes('awaiting_response=true') ? [queuedDispute] : [dispute];
      return Promise.resolve(new Response(JSON.stringify({ disputes: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    render(<DisputesPage />);

    const reviewButton = await screen.findByRole('button', { name: 'Review queued response' });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.getByTestId('dispute-detail-panel')).toHaveTextContent('queued-response');
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/disputes?awaiting_response=true');
  });
});
