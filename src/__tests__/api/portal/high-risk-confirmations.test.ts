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
    const updateWhere = vi.fn().mockResolvedValue(undefined);
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
  }, 30000);
});
