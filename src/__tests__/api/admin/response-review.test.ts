import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const getUserRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => ({
  getUserRole: getUserRoleMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/email-service', () => ({
  triggerAutomation: vi.fn(),
}));

describe('PUT /api/workspace/disputes/[id] response review intake', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    getUserRoleMock.mockResolvedValue('super_admin');
  });

  it('requires response document and classification when recording a received response', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseNotes: 'Bureau responded by mail.',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Response Review requires a response document and outcome classification' });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('rejects generic success as a response review outcome', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentUrl: 'portal-documents/user-1/response.pdf',
          outcome: 'success',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Outcome must use structured response review vocabulary' });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('rejects obsolete automatic next-cycle creation requests', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: 'item-1',
      bureau: 'experian',
      round: 1,
      responseReceivedAt: null,
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      escalationHistory: null,
    }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({ createNextRound: true }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Response review cannot create a next-cycle draft automatically',
    });
  }, 30000);

  it('requires a received date for an actual response outcome', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
      id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1,
      responseReceivedAt: null, responseDeadline: new Date('2026-02-01T00:00:00.000Z'), escalationHistory: null,
    }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'responded',
          outcome: 'verified',
          responseDocumentUrl: 'portal-documents/user-1/response.pdf',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Response Review requires a response date and response document for this outcome',
    });
  }, 30000);

  it('allows an overdue no-response review without fabricated response evidence', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');
    const updatedDispute = {
      id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1,
      status: 'responded', outcome: 'no_response', responseNotes: 'No response by the deadline.',
      trackingNumber: null, responseChannel: null, submissionMethod: null, submissionRecipient: null,
      submissionProofDocumentUrl: null, scoreImpact: null, analysisConfidence: null, autoSelected: false,
      sentAt: new Date('2026-01-01T00:00:00.000Z'),
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt: null, updatedAt: new Date('2026-02-02T00:00:00.000Z'),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1,
        responseReceivedAt: null, responseDeadline: new Date('2026-02-01T00:00:00.000Z'), escalationHistory: null,
      }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([updatedDispute]) }) }) });
    dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'responded',
          outcome: 'no_response',
          responseNotes: 'No response by the deadline.',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.next_cycle_recommendation).toMatchObject({
      kind: 'create_next_draft',
      plan: { nextRound: 2, targetRecipient: 'bureau' },
    });
  }, 30000);

  it('recommends method-of-verification after a verified response review', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');
    const updatedDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: null,
      status: 'responded',
      outcome: 'verified',
      responseNotes: 'Verified by bureau.',
      trackingNumber: null,
      responseChannel: 'mail',
      scoreImpact: null,
      analysisConfidence: null,
      autoSelected: false,
      sentAt: new Date('2026-01-02T00:00:00.000Z'),
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt: new Date('2026-02-01T00:00:00.000Z'),
      responseDocumentId: 'doc-1',
      responseDocumentUrl: 'client-documents/user-1/evidence/response.pdf',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, responseChannel: 'mail', escalationHistory: null }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'doc-1', userId: 'user-1', fileUrl: 'client-documents/user-1/evidence/response.pdf' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([updatedDispute]) }) }) });
    dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'responded',
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentId: 'doc-1',
          responseChannel: 'mail',
          outcome: 'verified',
          responseNotes: 'Verified by bureau.',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.next_cycle_recommendation).toMatchObject({
      kind: 'create_next_draft',
      plan: {
        nextRound: 2,
        targetRecipient: 'bureau',
        disputeType: 'method_of_verification',
      },
    });
  }, 30000);

  it('rejects an arbitrary response document URL for a new actual response review', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'dispute-1',
            clientId: 'client-1',
            negativeItemId: null,
            bureau: 'experian',
            round: 1,
            responseReceivedAt: null,
            escalationHistory: null,
          }]),
        }),
      }),
    });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          outcome: 'verified',
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentUrl: 'https://files.example/response.pdf',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Response Review requires a controlled response document for this outcome',
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('persists an owned response document ID and its controlled R2 key', async () => {
    const { PUT } = await import('@/app/api/workspace/disputes/[id]/route');
    const updatedDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      status: 'responded',
      outcome: 'verified',
      responseNotes: null,
      trackingNumber: null,
      responseChannel: 'mail',
      submissionMethod: null,
      submissionRecipient: null,
      submissionProofDocumentUrl: null,
      scoreImpact: null,
      analysisConfidence: null,
      autoSelected: false,
      sentAt: null,
      responseDeadline: null,
      responseReceivedAt: new Date('2026-02-01T00:00:00.000Z'),
      responseDocumentId: 'doc-1',
      responseDocumentUrl: 'client-documents/user-1/evidence/response.pdf',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1,
        responseReceivedAt: null, responseChannel: 'mail', escalationHistory: null,
      }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
        id: 'doc-1', userId: 'user-1', fileUrl: 'client-documents/user-1/evidence/response.pdf',
      }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([updatedDispute]) }) }) });
    dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await PUT(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          outcome: 'verified',
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentId: 'doc-1',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(200);
    expect(dbMock.update).toHaveBeenCalledWith(expect.anything());
    const updateSet = vi.mocked(dbMock.update).mock.results[0].value.set;
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      responseDocumentId: 'doc-1',
      responseDocumentUrl: 'client-documents/user-1/evidence/response.pdf',
    }));
    await expect(response.json()).resolves.toMatchObject({
      dispute: {
        response_document_id: 'doc-1',
        response_document_url: 'client-documents/user-1/evidence/response.pdf',
      },
    });
  });
});
