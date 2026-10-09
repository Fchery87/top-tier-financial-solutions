import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useHighRiskConfirmations } from '../useHighRiskConfirmations';
import type { HighRiskClaimTarget } from '../../services/highRiskClaims';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const target: HighRiskClaimTarget = {
  key: 'inquiry:inq-1:unauthorized_inquiry',
  itemKind: 'inquiry',
  itemId: 'inq-1',
  itemLabel: 'Inquiry Bank',
  bureau: 'equifax',
  claimType: 'unauthorized_inquiry',
};
const targets = [target];

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

describe('useHighRiskConfirmations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads each item claim state from the evidence-packets GET filtered by client and item', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ packets: [], claims: { unauthorized_inquiry: { state: 'awaiting_client_confirmation', packetId: 'packet-1' } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useHighRiskConfirmations({ clientId: 'client-1', targets }));

    expect(result.current.claims[0].loading).toBe(true);
    await waitFor(() => expect(result.current.claims[0].loading).toBe(false));
    expect(result.current.claims[0].confirmation).toEqual({ state: 'awaiting_client_confirmation', packetId: 'packet-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/evidence-packets?client_id=client-1&item_kind=inquiry&item_id=inq-1');
  });

  it('requests the client confirmation with the item link and the chosen documents, then reloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ packets: [], claims: {} }))
      .mockResolvedValueOnce(jsonResponse({ id: 'packet-1' }, 201))
      .mockResolvedValueOnce(jsonResponse({ packets: [], claims: { unauthorized_inquiry: { state: 'awaiting_client_confirmation', packetId: 'packet-1' } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useHighRiskConfirmations({ clientId: 'client-1', targets }));
    await waitFor(() => expect(result.current.claims[0].loading).toBe(false));
    expect(result.current.claims[0].confirmation).toEqual({ state: 'none' });

    await act(() => result.current.requestClientConfirmation(result.current.claims[0], ['doc-1']));

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/workspace/evidence-packets');
    expect(JSON.parse(init.body)).toEqual({
      client_id: 'client-1',
      claim_type: 'unauthorized_inquiry',
      item_kind: 'inquiry',
      item_id: 'inq-1',
      document_ids: ['doc-1'],
    });
    expect(result.current.claims[0].confirmation.state).toBe('awaiting_client_confirmation');
  });
});
