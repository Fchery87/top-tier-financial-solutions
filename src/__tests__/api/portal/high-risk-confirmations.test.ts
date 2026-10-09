import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('POST /api/portal/high-risk-confirmations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('records explicit factual confirmation on an evidence packet owned by the authenticated client', async () => {
    const { POST } = await import('@/app/api/portal/high-risk-confirmations/route');
    const updateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ confirmations: '[]' }]) });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        id: 'packet-1',
        clientId: 'client-1',
        claimType: 'identity_theft',
        confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
      }]) }) }) });
    dbMock.update.mockReturnValue({ set: updateSet });

    const response = await POST(new NextRequest('http://localhost/api/portal/high-risk-confirmations', {
      method: 'POST',
      body: JSON.stringify({
        evidence_packet_id: 'packet-1',
        confirmation_text: 'I confirm this identity theft claim is accurate to the best of my knowledge.',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confirmations).toEqual([
      { key: 'client_authorized_review', confirmed: true },
      expect.objectContaining({
        key: 'client_factual_claim_confirmed',
        confirmed: true,
        source: 'portal',
        text: 'I confirm this identity theft claim is accurate to the best of my knowledge.',
      }),
    ]);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      confirmations: expect.stringContaining('client_factual_claim_confirmed'),
    }));
    expect(updateWhere).toHaveBeenCalled();
  }, 30000);

  it('returns the existing factual confirmation without appending another one', async () => {
    const { POST } = await import('@/app/api/portal/high-risk-confirmations/route');
    const existing = [
      { key: 'client_authorized_review', confirmed: true },
      { key: 'client_factual_claim_confirmed', confirmed: true, source: 'portal', text: 'Already confirmed' },
    ];
    const updateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        id: 'packet-1',
        clientId: 'client-1',
        claimType: 'fraud',
        confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
      }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        confirmations: JSON.stringify(existing),
      }]) }) }) });
    dbMock.update.mockReturnValue({ set: updateSet });

    const response = await POST(new NextRequest('http://localhost/api/portal/high-risk-confirmations', {
      method: 'POST',
      body: JSON.stringify({
        evidence_packet_id: 'packet-1',
        confirmation_text: 'Second attempt',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ confirmations: existing });
    expect(updateWhere).toHaveBeenCalled();
  }, 30000);
});

describe('GET /api/portal/high-risk-confirmations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('names the disputed item and its bureau for each claim awaiting the client', async () => {
    const { GET } = await import('@/app/api/portal/high-risk-confirmations/route');
    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: 'packet-1', claimType: 'unauthorized_inquiry', disputeId: null, itemKind: 'inquiry', itemId: 'inq-1', createdAt: new Date('2026-10-01T00:00:00Z'), confirmations: '[]' },
        { id: 'packet-2', claimType: 'not_mine', disputeId: null, itemKind: 'tradeline', itemId: 'neg-1', createdAt: null, confirmations: JSON.stringify([{ key: 'client_factual_claim_confirmed', confirmed: true }]) },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: 'inq-1', clientId: 'client-1', creditorName: 'Inquiry Bank', bureau: 'equifax' },
      ]) }) });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.packets).toEqual([{
      id: 'packet-1',
      claim_type: 'unauthorized_inquiry',
      dispute_id: null,
      item: { kind: 'inquiry', name: 'Inquiry Bank', bureaus: ['equifax'] },
      created_at: '2026-10-01T00:00:00.000Z',
    }]);
    expect(dbMock.select).toHaveBeenCalledTimes(3);
  }, 30000);

  it('never names an item that belongs to another client', async () => {
    const { GET } = await import('@/app/api/portal/high-risk-confirmations/route');
    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: 'packet-1', claimType: 'unauthorized_inquiry', disputeId: null, itemKind: 'inquiry', itemId: 'inq-9', createdAt: null, confirmations: '[]' },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: 'inq-9', clientId: 'client-2', creditorName: 'Someone Else', bureau: 'equifax' },
      ]) }) });

    const body = await (await GET()).json();

    expect(body.packets[0].item).toBeNull();
  });
});
