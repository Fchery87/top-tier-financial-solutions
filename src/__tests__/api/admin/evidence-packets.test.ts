import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

describe('POST /api/admin/evidence-packets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('creates an evidence packet for a client dispute claim from owned documents and confirmations', async () => {
    const { POST } = await import('@/app/api/admin/evidence-packets/route');
    const created = [{
      id: 'packet-1',
      clientId: 'client-1',
      disputeId: 'dispute-1',
      claimType: 'verification_required',
      documentIds: JSON.stringify(['doc-1']),
      confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1' }]) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/evidence-packets', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        dispute_id: 'dispute-1',
        claim_type: 'verification_required',
        document_ids: ['doc-1'],
        confirmations: [{ key: 'client_authorized_review', confirmed: true }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: 'packet-1',
      client_id: 'client-1',
      dispute_id: 'dispute-1',
      claim_type: 'verification_required',
      document_ids: ['doc-1'],
      confirmations: [{ key: 'client_authorized_review', confirmed: true }],
    });
  }, 30000);

  it('requires explicit client confirmation before creating a high-risk evidence packet', async () => {
    const { POST } = await import('@/app/api/admin/evidence-packets/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1' }]) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/evidence-packets', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        dispute_id: 'dispute-1',
        claim_type: 'identity_theft',
        document_ids: ['doc-1'],
        confirmations: [{ key: 'client_authorized_review', confirmed: true }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'High-risk claims require explicit client factual confirmation' });
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('creates a high-risk evidence packet after explicit client factual confirmation', async () => {
    const { POST } = await import('@/app/api/admin/evidence-packets/route');
    const created = [{
      id: 'packet-2',
      clientId: 'client-1',
      disputeId: 'dispute-1',
      claimType: 'identity_theft',
      documentIds: JSON.stringify(['doc-1']),
      confirmations: JSON.stringify([
        { key: 'client_authorized_review', confirmed: true },
        { key: 'client_factual_claim_confirmed', confirmed: true },
      ]),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1' }]) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/evidence-packets', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        dispute_id: 'dispute-1',
        claim_type: 'identity_theft',
        document_ids: ['doc-1'],
        confirmations: [
          { key: 'client_authorized_review', confirmed: true },
          { key: 'client_factual_claim_confirmed', confirmed: true },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: 'packet-2',
      claim_type: 'identity_theft',
      confirmations: [
        { key: 'client_authorized_review', confirmed: true },
        { key: 'client_factual_claim_confirmed', confirmed: true },
      ],
    });
  }, 30000);
});
