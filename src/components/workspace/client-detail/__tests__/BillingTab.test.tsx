import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingTab } from '@/components/workspace/client-detail/BillingTab';
import type { ClientBillingView } from '@/lib/client-billing';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const gateCheck = (key: string, label: string, source: 'derived' | 'attested', passed: boolean) => ({
  key, label, source, passed, checked_at: null, notes: null,
}) as ClientBillingView['engagements'][number]['gate']['checks'][number];

const view: ClientBillingView = {
  client_id: 'client-1',
  fee_plan: null,
  fee_configs: [{ id: 'fee-1', name: 'Flat', fee_model: 'flat_fee', amount_cents: 50000, frequency: 'one_time', setup_fee_cents: 0 }],
  engagements: [{
    id: 'engagement-1',
    service_type: 'credit_restoration',
    status: 'active',
    lifecycle_stage: 'active_dispute_cycle',
    opened_at: '2026-01-01T00:00:00.000Z',
    sales_channel: null,
    service_period_ends_at: null,
    results_achieved_at: null,
    results_verification_report_id: null,
    results_verification_report_date: null,
    results_verified_at: null,
    gate: {
      checks: [
        gateCheck('fee_terms_disclosed', 'Fee terms disclosed', 'derived', true),
        gateCheck('onboarding_review_complete', 'Onboarding review complete', 'attested', false),
      ],
      is_ready_for_first_work: false,
    },
    payable: false,
    blockers: [{
      kind: 'sales_channel_unknown',
      message: 'Record how this sale was made (telemarketing, online or in person) before invoicing.',
    }],
  }],
  services_rendered: [],
  invoices: [{
    id: 'invoice-1',
    invoice_number: 'INV-2603-ABCDEF0123',
    service_engagement_id: 'engagement-1',
    services_rendered_event_id: 'event-1',
    amount_cents: 50000,
    description: null,
    due_date: null,
    created_at: '2026-03-01T00:00:00.000Z',
    paid_cents: 0,
    refunded_cents: 0,
    net_paid_cents: 0,
    balance_cents: 50000,
    status: 'pending',
  }],
  ledger: [],
  credit_reports: [],
};

describe('BillingTab', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows payable blockers beside disabled invoice and payment buttons', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => view });
    vi.stubGlobal('fetch', fetchMock);

    render(<BillingTab clientId="client-1" />);

    expect(await screen.findByText('Record how this sale was made (telemarketing, online or in person) before invoicing.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/clients/client-1/billing');
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Void' })).toBeEnabled();
    expect(screen.getByText('No fee plan. Agreements cannot be sent until one is set.')).toBeInTheDocument();
  });

  it('offers attestation only on attested checks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => view }));

    render(<BillingTab clientId="client-1" />);

    expect(await screen.findByRole('button', { name: 'Attest' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Attest|Revoke/ })).toHaveLength(1);
    expect(screen.getByText('From records')).toBeInTheDocument();
  });
});
