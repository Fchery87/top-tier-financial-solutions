import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EvidencePacketPanel } from '@/components/workspace/disputes/EvidencePacketPanel';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('EvidencePacketPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows the empty state after loading the client evidence inventory', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({
        documents: [{
          id: 'doc-1',
          file_name: 'Proof of address.pdf',
          file_type: 'proof_of_address',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ packets: [] }));

    render(<EvidencePacketPanel clientId="client-1" disputeId="dispute-1" />);

    expect(await screen.findByLabelText(/proof of address.pdf/i)).toBeInTheDocument();
    expect(screen.getByText('No evidence packets yet.')).toBeInTheDocument();
  });

  it('creates a low-risk packet from selected controlled evidence and refreshes the list', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({
        documents: [{
          id: 'doc-1',
          file_name: 'Bureau response.pdf',
          file_type: 'correspondence',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ packets: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'packet-1' }, 201))
      .mockResolvedValueOnce(jsonResponse({
        packets: [{
          id: 'packet-1',
          client_id: 'client-1',
          dispute_id: 'dispute-1',
          claim_type: 'verification_required',
          document_ids: ['doc-1'],
          confirmations: [{ key: 'client_authorized_review', confirmed: true }],
          created_by_id: 'staff-1',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }));

    render(<EvidencePacketPanel clientId="client-1" disputeId="dispute-1" />);

    fireEvent.click(await screen.findByLabelText(/bureau response.pdf/i));
    fireEvent.click(screen.getByRole('button', { name: 'Create evidence packet' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/workspace/evidence-packets', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"document_ids":["doc-1"]'),
      }));
    });
    expect(await screen.findByText(/packet-1/i)).toBeInTheDocument();
  });

  it('shows the client-confirmation requirement for high-risk claims', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ documents: [] }))
      .mockResolvedValueOnce(jsonResponse({ packets: [] }));

    render(<EvidencePacketPanel clientId="client-1" disputeId="dispute-1" />);

    fireEvent.change(await screen.findByLabelText('Claim type'), { target: { value: 'identity_theft' } });

    expect(screen.getByText(/client must confirm the factual claim through the portal/i)).toBeInTheDocument();
  });
});
