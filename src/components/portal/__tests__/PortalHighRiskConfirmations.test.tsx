import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortalHighRiskConfirmations from '../PortalHighRiskConfirmations';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('PortalHighRiskConfirmations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the client which item and which claim they are confirming', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        packets: [{
          id: 'packet-1',
          claim_type: 'unauthorized_inquiry',
          dispute_id: null,
          item: { kind: 'inquiry', name: 'Inquiry Bank', bureaus: ['equifax'] },
          created_at: null,
        }],
      }),
    }));

    render(<PortalHighRiskConfirmations />);

    expect(await screen.findByTestId('confirmation-item-packet-1')).toHaveTextContent('Credit inquiry: Inquiry Bank · reported by Equifax');
    expect(screen.getByText('Unauthorized inquiry')).toBeInTheDocument();
    expect(screen.getByText(/I did not apply for credit with this company or authorize this inquiry/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm claim' })).toBeDisabled();
  });
});
