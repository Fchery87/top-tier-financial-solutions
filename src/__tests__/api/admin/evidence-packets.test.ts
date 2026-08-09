import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

describe('POST /api/workspace/evidence-packets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  it('creates an evidence packet for a client dispute claim from owned documents and confirmations', async () => {
    const { POST } = await import('@/app/api/workspace/evidence-packets/route');
    const created = [{
      id: 'packet-1',
      clientId: 'client-1',
      disputeId: 'dispute-1',
      claimType: 'verification_required',
      documentIds: JSON.stringify(['doc-1']),
      confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
      createdById: 'staff-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1', fileUrl: 'client-documents/user-1/evidence/doc-1.pdf' }]) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/evidence-packets', {
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
    expect(requireCapabilityMock).toHaveBeenCalledWith('disputes:write');
    expect(body).toMatchObject({
      id: 'packet-1',
      client_id: 'client-1',
      dispute_id: 'dispute-1',
      claim_type: 'verification_required',
      created_by_id: 'staff-1',
      document_ids: ['doc-1'],
      confirmations: [{ key: 'client_authorized_review', confirmed: true }],
    });
  }, 30000);

  it('requires explicit client confirmation before creating a high-risk evidence packet', async () => {
    const { POST } = await import('@/app/api/workspace/evidence-packets/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1', fileUrl: 'client-documents/user-1/evidence/doc-1.pdf' }]) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/evidence-packets', {
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
    const { POST } = await import('@/app/api/workspace/evidence-packets/route');
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
      createdById: 'staff-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1', fileUrl: 'client-documents/user-1/evidence/doc-1.pdf' }]) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/evidence-packets', {
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
      created_by_id: 'staff-1',
      claim_type: 'identity_theft',
      confirmations: [
        { key: 'client_authorized_review', confirmed: true },
        { key: 'client_factual_claim_confirmed', confirmed: true },
      ],
    });
  }, 30000);

  it('rejects evidence documents owned by another client', async () => {
    const { POST } = await import('@/app/api/workspace/evidence-packets/route');
    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'doc-2', userId: 'user-2', fileUrl: 'client-documents/user-2/evidence/doc-2.pdf' }]) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/evidence-packets', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        dispute_id: 'dispute-1',
        claim_type: 'verification_required',
        document_ids: ['doc-2'],
        confirmations: [{ key: 'client_authorized_review', confirmed: true }],
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Evidence packet documents must belong to the client',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('lists packets scoped to the requested client and dispute', async () => {
    const { GET } = await import('@/app/api/workspace/evidence-packets/route');
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([{
            id: 'packet-1',
            clientId: 'client-1',
            disputeId: 'dispute-1',
            claimType: 'verification_required',
            documentIds: JSON.stringify(['doc-1']),
            confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
            createdById: 'staff-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          }]),
        }),
      }),
    });

    const response = await GET(new NextRequest(
      'http://localhost/api/workspace/evidence-packets?client_id=client-1&dispute_id=dispute-1',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      packets: [expect.objectContaining({
        id: 'packet-1',
        client_id: 'client-1',
        dispute_id: 'dispute-1',
        created_by_id: 'staff-1',
      })],
    });
    expect(requireCapabilityMock).toHaveBeenCalledWith('disputes:read');
  });
});
