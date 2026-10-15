import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeldFindingsPanel } from '@/components/workspace/client-detail/HeldFindingsPanel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const finding = {
  negative_item_id: 'item-1',
  creditor_name: 'Example Bank',
  bureau: 'experian',
  text: 'The account is reported as charge_off but still shows a scheduled monthly payment of $45.00.',
  review: null,
};

describe('HeldFindingsPanel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists held findings and records an approval', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ findings: [finding] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ review: 'approved' })));
    vi.stubGlobal('fetch', fetchMock);

    render(<HeldFindingsPanel clientId="client-1" />);

    expect(await screen.findByText(finding.text)).toBeInTheDocument();
    expect(screen.getByText('Example Bank • Experian')).toBeInTheDocument();
    expect(screen.getByText(/1 awaiting review/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(screen.getByText('Approved for letters')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith('/api/workspace/clients/client-1/held-findings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ negative_item_id: 'item-1', finding_text: finding.text, decision: 'approved' }),
    }));
  });

  it('renders nothing when no findings are held', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ findings: [] }))));

    const { container } = render(<HeldFindingsPanel clientId="client-1" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
